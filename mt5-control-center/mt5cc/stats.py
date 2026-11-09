"""Performance statistics computed from reconstructed trades and raw deals.

Two different accounting views are deliberately kept apart:

* **deal-based realized P/L** - the sum of profit + commission + swap + fee of
  every BUY/SELL deal in a period. This is exactly how the MT5 terminal's own
  report arrives at "Profit" for a period and is used for day/week/month totals.
* **trade-based statistics** - win rate, averages, profit factor, per-symbol and
  per-session breakdowns, computed on reconstructed closed trades.

Deposits, withdrawals, credit and other balance operations are *never* mixed
into either of those; they are reported separately.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone, tzinfo
from typing import Any, Iterable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .history import Trade, deal_net, is_trading_deal

SESSIONS = (
    # name, start hour (UTC, inclusive), end hour (UTC, exclusive)
    ("Asia", 0, 8),
    ("London", 8, 13),
    ("London / New York overlap", 13, 17),
    ("New York", 17, 22),
    ("Late / off-hours", 22, 24),
)


def resolve_timezone(name: str | None) -> tzinfo:
    if not name or name.lower() in ("local", "system"):
        return datetime.now().astimezone().tzinfo or timezone.utc
    if name.upper() == "UTC":
        return timezone.utc
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return datetime.now().astimezone().tzinfo or timezone.utc


def period_bounds(period: str, tz: tzinfo, now: datetime | None = None) -> tuple[float | None, float | None]:
    """Start/end epoch seconds (UTC) for a named period in the report timezone."""
    now = (now or datetime.now(timezone.utc)).astimezone(tz)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "day":
        start = today
    elif period == "week":
        start = today - timedelta(days=today.weekday())
    elif period == "month":
        start = today.replace(day=1)
    elif period == "year":
        start = today.replace(month=1, day=1)
    else:
        return None, None
    return start.timestamp(), None


def _in_window(t: float | None, start: float | None, end: float | None) -> bool:
    if t is None:
        return False
    if start is not None and t < start:
        return False
    if end is not None and t >= end:
        return False
    return True


# --------------------------------------------------------------------------- #
# Deal based
# --------------------------------------------------------------------------- #

def realized_pl(deals: Iterable[dict[str, Any]], start: float | None, end: float | None) -> dict[str, float]:
    gross = comm = swap = fee = 0.0
    n = 0
    for d in deals:
        if not is_trading_deal(d) or not _in_window(d["time_utc"], start, end):
            continue
        gross += d["profit"]; comm += d["commission"]; swap += d["swap"]; fee += d["fee"]; n += 1
    return {"gross": round(gross, 2), "commission": round(comm, 2), "swap": round(swap, 2),
            "fee": round(fee, 2), "net": round(gross + comm + swap + fee, 2), "deals": n}


def balance_flows(deals: Iterable[dict[str, Any]], start: float | None, end: float | None) -> dict[str, float]:
    out = {"deposits": 0.0, "withdrawals": 0.0, "credit": 0.0, "adjustments": 0.0}
    from .history import classify_balance_deal
    for d in deals:
        if is_trading_deal(d) or not _in_window(d["time_utc"], start, end):
            continue
        cat = classify_balance_deal(d)
        amt = deal_net(d)
        if cat == "deposit":
            out["deposits"] += amt
        elif cat == "withdrawal":
            out["withdrawals"] += amt
        elif cat == "credit":
            out["credit"] += amt
        else:
            out["adjustments"] += amt
    return {k: round(v, 2) for k, v in out.items()}


def balance_curve(deals: list[dict[str, Any]], current_balance: float) -> list[dict[str, float]]:
    """Historical account balance after each deal, anchored to the live balance
    so the curve ends exactly where the terminal says it is."""
    pts: list[dict[str, float]] = []
    bal = float(current_balance)
    for d in reversed(deals):
        pts.append({"t": d["time_utc"], "balance": round(bal, 2)})
        bal -= deal_net(d)
    pts.reverse()
    if pts:
        pts.insert(0, {"t": pts[0]["t"] - 1, "balance": round(bal, 2)})
    return pts


def daily_pl(deals: Iterable[dict[str, Any]], tz: tzinfo, start: float | None, end: float | None) -> list[dict[str, Any]]:
    buckets: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    for d in deals:
        if not is_trading_deal(d) or not _in_window(d["time_utc"], start, end):
            continue
        key = datetime.fromtimestamp(d["time_utc"], tz=timezone.utc).astimezone(tz).strftime("%Y-%m-%d")
        buckets[key] += deal_net(d)
        counts[key] += 1
    return [{"date": k, "net": round(buckets[k], 2), "deals": counts[k]} for k in sorted(buckets)]


# --------------------------------------------------------------------------- #
# Trade based
# --------------------------------------------------------------------------- #

def _safe_div(a: float, b: float) -> float | None:
    return round(a / b, 4) if b else None


def trade_stats(trades: Iterable[Trade]) -> dict[str, Any]:
    trades = list(trades)
    wins = [t for t in trades if t.net > 0]
    losses = [t for t in trades if t.net < 0]
    flat = [t for t in trades if t.net == 0]
    gross_win = sum(t.net for t in wins)
    gross_loss = -sum(t.net for t in losses)
    net = sum(t.net for t in trades)
    volume = sum(t.volume for t in trades)
    durations = [t.duration_s for t in trades if t.duration_s is not None]
    return {
        "trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "breakeven": len(flat),
        "win_rate": _safe_div(len(wins), len(trades)),
        "net": round(net, 2),
        "gross_profit": round(gross_win, 2),
        "gross_loss": round(-gross_loss, 2),
        "avg_win": round(gross_win / len(wins), 2) if wins else None,
        "avg_loss": round(-gross_loss / len(losses), 2) if losses else None,
        "largest_win": round(max((t.net for t in wins), default=0.0), 2) if wins else None,
        "largest_loss": round(min((t.net for t in losses), default=0.0), 2) if losses else None,
        "profit_factor": (round(gross_win / gross_loss, 2) if gross_loss > 0 else ("inf" if wins else None)),
        "expectancy": round(net / len(trades), 2) if trades else None,
        "volume": round(volume, 2),
        "commission": round(sum(t.commission for t in trades), 2),
        "swap": round(sum(t.swap for t in trades), 2),
        "fees": round(sum(t.fee for t in trades), 2),
        "avg_duration_s": round(sum(durations) / len(durations)) if durations else None,
        "incomplete": sum(1 for t in trades if t.incomplete),
    }


def by_symbol(trades: Iterable[Trade]) -> list[dict[str, Any]]:
    groups: dict[str, list[Trade]] = defaultdict(list)
    for t in trades:
        groups[t.symbol or "?"].append(t)
    rows = []
    for sym, ts in groups.items():
        s = trade_stats(ts)
        rows.append({"symbol": sym, **{k: s[k] for k in ("trades", "wins", "losses", "win_rate", "net", "volume", "profit_factor", "avg_win", "avg_loss")}})
    rows.sort(key=lambda r: r["net"], reverse=True)
    return rows


def session_of(epoch_utc: float | None) -> str:
    if epoch_utc is None:
        return "Unknown"
    hour = datetime.fromtimestamp(epoch_utc, tz=timezone.utc).hour
    for name, lo, hi in SESSIONS:
        if lo <= hour < hi:
            return name
    return "Unknown"


def by_session(trades: Iterable[Trade]) -> list[dict[str, Any]]:
    groups: dict[str, list[Trade]] = {name: [] for name, _, _ in SESSIONS}
    groups["Unknown"] = []
    for t in trades:
        groups[session_of(t.entry_time)].append(t)
    rows = []
    for name, ts in groups.items():
        if not ts and name == "Unknown":
            continue
        s = trade_stats(ts)
        rows.append({"session": name, **{k: s[k] for k in ("trades", "wins", "losses", "win_rate", "net", "volume", "profit_factor")}})
    return rows


def realized_curve(trades: Iterable[Trade]) -> dict[str, Any]:
    """Cumulative realized P/L by exit time, with peak-to-trough drawdown.

    Deposits/withdrawals are excluded by construction (trades only), so the
    drawdown is a *trading* drawdown, measured on closed results only.
    """
    pts: list[dict[str, float]] = []
    cum = 0.0
    peak = 0.0
    max_dd = 0.0
    max_dd_start = max_dd_end = None
    cur_dd_start = None
    for t in sorted(trades, key=lambda x: x.exit_time):
        cum += t.net
        if cum > peak:
            peak = cum
            cur_dd_start = t.exit_time
        dd = peak - cum
        if dd > max_dd:
            max_dd = dd
            max_dd_start = cur_dd_start
            max_dd_end = t.exit_time
        pts.append({"t": t.exit_time, "cum": round(cum, 2), "dd": round(-dd, 2)})
    return {
        "points": pts,
        "max_drawdown": round(max_dd, 2),
        "max_drawdown_start": max_dd_start,
        "max_drawdown_end": max_dd_end,
        "current_drawdown": round(peak - cum, 2) if pts else 0.0,
    }


def filter_trades(trades: Iterable[Trade], *, start: float | None = None, end: float | None = None,
                  symbol: str | None = None, result: str | None = None, direction: str | None = None) -> list[Trade]:
    out = []
    for t in trades:
        if not _in_window(t.exit_time, start, end):
            continue
        if symbol and (t.symbol or "").upper() != symbol.upper():
            continue
        if direction and t.direction != direction.upper():
            continue
        if result == "win" and not t.net > 0:
            continue
        if result == "loss" and not t.net < 0:
            continue
        if result == "breakeven" and t.net != 0:
            continue
        out.append(t)
    return out
