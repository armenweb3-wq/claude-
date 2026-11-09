"""Deal-history processing: normalisation, trade reconstruction and
reconciliation against the raw MT5 deal ledger.

Terminology
-----------
* **deal** - an atomic execution record from MT5 (``history_deals_get``).
* **trade** - a *closed* round-trip reconstructed from deals of one position:
  every OUT / OUT_BY / INOUT deal that closes volume produces one trade row,
  so a partially closed position yields several trades, each carrying the
  volume-weighted entry price and its proportional share of entry costs.

Nothing here estimates. If a position's entry deals are not available, the
resulting trade is flagged ``incomplete`` instead of being guessed.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Iterable

from . import mt5_constants as C

VOLUME_EPS = 1e-6
MONEY_EPS = 0.01


def normalize_deals(deals: Iterable[dict[str, Any]], server_utc_offset_hours: float) -> list[dict[str, Any]]:
    """Return a sorted copy of the deals with ``time_utc`` (true UTC epoch
    seconds) added. MT5 reports times in the broker server's clock."""
    offset = float(server_utc_offset_hours or 0.0) * 3600.0
    out: list[dict[str, Any]] = []
    for d in deals:
        nd = dict(d)
        t = float(nd.get("time") or 0)
        msc = nd.get("time_msc")
        if msc:
            t = float(msc) / 1000.0
        nd["time_utc"] = t - offset
        for key in ("volume", "price", "commission", "swap", "profit", "fee"):
            nd[key] = float(nd.get(key) or 0.0)
        out.append(nd)
    out.sort(key=lambda x: (x["time_utc"], x.get("ticket") or 0))
    return out


def deal_net(d: dict[str, Any]) -> float:
    return d["profit"] + d["commission"] + d["swap"] + d["fee"]


def is_trading_deal(d: dict[str, Any]) -> bool:
    return d.get("type") in C.TRADING_DEAL_TYPES


def classify_balance_deal(d: dict[str, Any]) -> str:
    t = d.get("type")
    if t == C.DEAL_TYPE_BALANCE:
        return "deposit" if d["profit"] >= 0 else "withdrawal"
    if t == C.DEAL_TYPE_CREDIT:
        return "credit"
    if t in (C.DEAL_TYPE_COMMISSION, C.DEAL_TYPE_COMMISSION_DAILY, C.DEAL_TYPE_COMMISSION_MONTHLY,
             C.DEAL_TYPE_COMMISSION_AGENT_DAILY, C.DEAL_TYPE_COMMISSION_AGENT_MONTHLY):
        return "commission"
    if t in (C.DEAL_DIVIDEND, C.DEAL_DIVIDEND_FRANKED):
        return "dividend"
    if t == C.DEAL_TAX:
        return "tax"
    if t == C.DEAL_TYPE_INTEREST:
        return "interest"
    return "adjustment"


@dataclass
class Trade:
    position_id: int
    symbol: str
    direction: str                 # "BUY" or "SELL" (direction of the position)
    entry_time: float | None       # utc epoch seconds (first entry)
    exit_time: float
    entry_price: float | None
    exit_price: float
    volume: float
    gross: float
    commission: float
    swap: float
    fee: float
    net: float
    entries: int = 1
    partial: bool = False
    reversal: bool = False
    incomplete: bool = False
    exit_ticket: int = 0
    exit_order: int = 0
    magic: int = 0
    comment: str = ""
    duration_s: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class TradeBook:
    trades: list[Trade]
    balance_ops: list[dict[str, Any]]
    open_entry_costs: float             # entry commissions/fees of still-open volume
    unresolved_positions: list[int]     # positions with leftover volume per deals
    reconciliation: dict[str, Any] = field(default_factory=dict)


def build_trades(deals: list[dict[str, Any]], open_position_ids: Iterable[int] | None = None) -> TradeBook:
    """Reconstruct closed trades from *normalised* deals (see ``normalize_deals``)."""
    open_ids = set(int(x) for x in (open_position_ids or []))
    by_pos: dict[int, list[dict[str, Any]]] = {}
    balance_ops: list[dict[str, Any]] = []
    for d in deals:
        if is_trading_deal(d):
            by_pos.setdefault(int(d.get("position_id") or 0), []).append(d)
        else:
            balance_ops.append({
                "ticket": d.get("ticket"), "time": d["time_utc"], "type": d.get("type"),
                "type_name": C.DEAL_TYPE_NAMES.get(d.get("type"), f"Type {d.get('type')}"),
                "category": classify_balance_deal(d), "amount": deal_net(d),
                "comment": d.get("comment") or "",
            })

    trades: list[Trade] = []
    open_costs = 0.0
    unresolved: list[int] = []

    for pid, pdeals in by_pos.items():
        pdeals.sort(key=lambda x: (x["time_utc"], x.get("ticket") or 0))
        open_vol = 0.0
        vwap = 0.0
        direction = 0            # +1 long, -1 short
        first_entry_time: float | None = None
        entries = 0
        cost_pool = 0.0          # unallocated entry commission + fees
        symbol = pdeals[0].get("symbol") or ""

        def close_part(d: dict[str, Any], closed_vol: float, deal_comm: float, deal_fee: float,
                       deal_swap: float, profit: float, *, reversal: bool, partial: bool) -> None:
            nonlocal cost_pool
            if open_vol > VOLUME_EPS and closed_vol > VOLUME_EPS:
                share = min(1.0, closed_vol / open_vol)
                alloc = cost_pool * share
                cost_pool -= alloc
            else:
                alloc = 0.0
            commission = deal_comm + alloc
            net = profit + commission + deal_swap + deal_fee
            trades.append(Trade(
                position_id=pid, symbol=d.get("symbol") or symbol,
                direction=("BUY" if direction > 0 else "SELL") if direction else
                          ("BUY" if d.get("type") == C.DEAL_TYPE_SELL else "SELL"),
                entry_time=first_entry_time, exit_time=d["time_utc"],
                entry_price=vwap if direction else None, exit_price=d["price"],
                volume=closed_vol if direction else d["volume"],
                gross=profit, commission=commission, swap=deal_swap, fee=deal_fee, net=net,
                entries=max(entries, 1), partial=partial, reversal=reversal,
                incomplete=not direction, exit_ticket=int(d.get("ticket") or 0),
                exit_order=int(d.get("order") or 0), magic=int(d.get("magic") or 0),
                comment=d.get("comment") or "",
                duration_s=(d["time_utc"] - first_entry_time) if first_entry_time else None,
            ))

        for d in pdeals:
            entry = d.get("entry")
            vol = d["volume"]
            sign = 1 if d.get("type") == C.DEAL_TYPE_BUY else -1
            if entry == C.DEAL_ENTRY_IN:
                if open_vol <= VOLUME_EPS:
                    direction, vwap, first_entry_time, entries, cost_pool = sign, d["price"], d["time_utc"], 0, 0.0
                    open_vol = 0.0
                if vol > 0:
                    vwap = (vwap * open_vol + d["price"] * vol) / (open_vol + vol)
                open_vol += vol
                entries += 1
                cost_pool += d["commission"] + d["fee"]
                # swap on an entry deal is unusual; treat it as a cost of the position
                cost_pool += d["swap"]
            elif entry in (C.DEAL_ENTRY_OUT, C.DEAL_ENTRY_OUT_BY):
                closed = min(vol, open_vol) if open_vol > VOLUME_EPS else 0.0
                partial = open_vol - closed > VOLUME_EPS
                close_part(d, closed, d["commission"], d["fee"], d["swap"], d["profit"],
                           reversal=False, partial=partial)
                open_vol = max(0.0, open_vol - closed)
                if open_vol <= VOLUME_EPS:
                    open_vol, direction, vwap, first_entry_time, entries, cost_pool = 0.0, 0, 0.0, None, 0, 0.0
            elif entry == C.DEAL_ENTRY_INOUT:
                closed = open_vol
                remaining = max(0.0, vol - closed)
                share_closed = (closed / vol) if vol > VOLUME_EPS else 1.0
                close_part(d, closed, d["commission"] * share_closed, d["fee"] * share_closed,
                           d["swap"], d["profit"], reversal=True, partial=False)
                # the leftover opens a new position in the deal's direction
                direction = sign if remaining > VOLUME_EPS else 0
                open_vol = remaining
                vwap = d["price"] if remaining > VOLUME_EPS else 0.0
                first_entry_time = d["time_utc"] if remaining > VOLUME_EPS else None
                entries = 1 if remaining > VOLUME_EPS else 0
                cost_pool = (d["commission"] + d["fee"]) * (1 - share_closed) if remaining > VOLUME_EPS else 0.0
            else:
                continue

        if open_vol > VOLUME_EPS:
            open_costs += cost_pool
            if pid not in open_ids and open_ids:
                unresolved.append(pid)

    trades.sort(key=lambda t: (t.exit_time, t.exit_ticket))

    deals_net = sum(deal_net(d) for d in deals if is_trading_deal(d))
    trades_net = sum(t.net for t in trades)
    diff = deals_net - trades_net - open_costs
    recon = {
        "deals_net": round(deals_net, 2),
        "trades_net": round(trades_net, 2),
        "open_entry_costs": round(open_costs, 2),
        "difference": round(diff, 2),
        "verified": abs(diff) <= MONEY_EPS + 1e-9,
        "incomplete_trades": sum(1 for t in trades if t.incomplete),
        "unresolved_positions": len(unresolved),
    }
    return TradeBook(trades=trades, balance_ops=balance_ops, open_entry_costs=open_costs,
                     unresolved_positions=unresolved, reconciliation=recon)
