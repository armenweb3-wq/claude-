"""Copy trading — followers mirror the leader's (admin's) live trades.

The leader trades normally via ``UserTrader``; every open/close is recorded to
the durable ``leader_signals`` ledger (the proof record). Followers who opted in
(``copy_enabled``) mirror those signals on THEIR OWN exchange account, sized to
THEIR balance at the same risk % — so a 2% leader entry becomes a 2% entry on
each follower, scaled to their equity. The price levels (entry/stop/TP) are the
same, since those are market-wide; only the quantity differs per balance.

Nothing is mirrored until ``COPY_TRADING_ENABLED`` is on, and in dry-run no real
order is placed (the mirror is still ledgered, so proof/audit works in dry too).
"""
from __future__ import annotations

import json
import logging

from ..config import settings
from ..risk.sizing import plan_position
from ..strategy.base import TakeProfit

log = logging.getLogger(__name__)


def record_leader_activity(store, res: dict) -> None:
    """Persist the leader's opens/closes (from a ``UserTrader`` run) to the
    leader_signals ledger. Idempotent — safe to call every cycle."""
    for o in res.get("opened", []):
        if not o.get("entry"):
            continue  # need full detail (entry/stop) to be able to mirror it
        store.record_leader_open(
            o.get("symbol"), o.get("side"), o.get("entry"), o.get("stop_loss"),
            o.get("take_profits"), o.get("leverage"), o.get("risk_pct"))
    # Closes: when a symbol the leader held shows up in realised PnL, close its
    # open signal. Only acts while a signal is still 'open', so it's idempotent.
    seen: set = set()
    for t in res.get("closed", []):
        sym = t.get("symbol")
        if not sym or sym in seen:
            continue
        seen.add(sym)
        store.close_leader_signal(sym, t.get("pnl_pct"))


def _tps_from(raw) -> list:
    """Rebuild the TakeProfit ladder from the stored JSON (or list)."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = []
    out = []
    for tp in (raw or []):
        try:
            out.append(TakeProfit(pct=float(tp.get("pct") or 0),
                                  close_fraction=float(tp.get("close_fraction") or 0),
                                  price=tp.get("price")))
        except Exception:  # malformed rung — skip it, don't fail the trade
            continue
    return out


class CopyTrader:
    """Mirror the leader's open signals onto one follower's account."""

    def __init__(self, exchange, store, user_id: int, *, dry: bool,
                 max_age_s: float, leverage_cap: float) -> None:
        self.ex = exchange
        self.store = store
        self.uid = user_id
        self.dry = dry
        self.max_age_s = max_age_s
        self.leverage_cap = leverage_cap

    def run_once(self) -> dict:
        out: dict = {"opened": [], "mirrored_closed": [], "closed": [], "error": None}

        # 1) CLOSES first — exit positions the leader has closed before opening new.
        for row in self.store.open_copy_execs(self.uid):
            sig = self.store.get_leader_signal(row["signal_id"])
            if not sig or sig.get("status") != "closed":
                continue
            sym = row["symbol"]
            try:
                if not self.dry:
                    pos = self.ex.get_position(sym)
                    if pos.side:
                        self.ex.close_position(sym)
                self.store.close_copy_exec(row["id"])
                out["mirrored_closed"].append(sym)
            except Exception as exc:  # one symbol must not break the rest
                log.warning("copy close failed u=%s %s: %s", self.uid, sym, exc)

        # 2) OPENS — mirror fresh leader signals not yet acted on for this user.
        try:
            equity = self.ex.get_equity()
        except Exception as exc:
            out["error"] = f"equity read failed: {exc}"
            return out
        if equity <= 0:
            out["error"] = "no tradable equity"
            return out
        out["equity"] = round(equity, 2)

        for sig in self.store.open_leader_signals(max_age_s=self.max_age_s):
            sid = sig["id"]
            if self.store.has_copy_exec(sid, self.uid):
                continue  # already decided on this signal for this follower
            sym, side = sig["symbol"], sig["side"]
            action = "long" if side == "Buy" else "short"
            try:
                pos = self.ex.get_position(sym)
            except Exception as exc:
                log.warning("copy position read u=%s %s: %s", self.uid, sym, exc)
                continue
            if pos.side is not None:
                self.store.add_copy_exec(sid, self.uid, sym, side, 0,
                                         "skipped", "already in a position on this symbol")
                continue
            lev_cap = max(1.0, min(self.leverage_cap, float(sig.get("leverage") or 1)))
            plan = plan_position(
                equity=equity,
                risk_pct=float(sig.get("risk_pct") or settings.risk_per_trade_pct),
                entry=float(sig["entry"]), stop=float(sig["stop_loss"]),
                side=action, leverage_cap=lev_cap)
            if plan.qty <= 0:
                self.store.add_copy_exec(sid, self.uid, sym, side, 0,
                                         "skipped", "size below minimum for this balance")
                continue
            if not plan.safe:  # liquidation would sit inside the stop — never trade it
                self.store.add_copy_exec(sid, self.uid, sym, side, 0,
                                         "skipped", "unsafe (liquidation inside stop)")
                continue
            if self.dry:
                self.store.add_copy_exec(sid, self.uid, sym, side, plan.qty,
                                         "open", "dry-run (no real order)")
                out["opened"].append({"symbol": sym, "side": side, "qty": plan.qty, "dry": True})
                continue
            try:
                res = self.ex.open_position(
                    symbol=sym, side=side, qty=plan.qty, leverage=plan.leverage,
                    stop_loss=float(sig["stop_loss"]), take_profits=_tps_from(sig.get("take_profits")))
            except Exception as exc:
                self.store.add_copy_exec(sid, self.uid, sym, side, 0,
                                         "skipped", f"open failed: {exc}"[:120])
                continue
            if getattr(res, "ok", False):
                qty = getattr(res, "qty", plan.qty)
                self.store.add_copy_exec(sid, self.uid, sym, side, qty, "open")
                out["opened"].append({"symbol": sym, "side": side, "qty": qty,
                                      "warning": getattr(res, "warning", "")})
            else:
                self.store.add_copy_exec(sid, self.uid, sym, side, 0,
                                         "skipped", getattr(res, "skipped_reason", "open skipped"))

        # Realised PnL so the runner can persist the follower's performance/proof.
        try:
            out["closed"] = self.ex.closed_pnl(limit=100)
        except Exception:
            out["closed"] = []
        return out
