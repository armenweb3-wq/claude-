"""Per-user live account snapshots for the SaaS dashboard.

Each snapshot is pulled from the user's own Bybit keys, but cached for a short
TTL so many users polling their dashboards won't exhaust Bybit's rate limits.
"""
from __future__ import annotations

import threading
import time

from . import security

_POS_TTL = 20.0   # seconds — open positions / equity
_HIST_TTL = 60.0  # seconds — closed-trade history

_lock = threading.Lock()
_pos_cache: dict[int, tuple[float, dict]] = {}
_hist_cache: dict[int, tuple[float, dict]] = {}

# Same ladder/stop defaults the strategy uses, so the dashboard can draw levels.
_LADDER = [(6.0, 0.30), (12.0, 0.40), (20.0, 0.30)]
_STOP_PCT = 3.0


def _exchange(keys: dict):
    from ..exchange.bybit import BybitExchange  # lazy: pybit only needed live

    return BybitExchange(
        api_key=security.decrypt(keys["enc_key"]),
        api_secret=security.decrypt(keys["enc_secret"]),
        testnet=bool(keys["testnet"]),
    )


def _detail(pos) -> dict:
    is_long = (pos.side or "").lower() in ("buy", "long")
    sign = 1.0 if is_long else -1.0
    entry = pos.entry_price
    tps = [round(entry * (1 + sign * p / 100), 6) for p, _ in _LADDER]
    sl = pos.stop_loss if pos.stop_loss else round(entry * (1 - sign * _STOP_PCT / 100), 6)
    at_be = (sl >= entry) if is_long else (0 < sl <= entry)
    notional = pos.size * entry
    margin = (notional / pos.leverage) if pos.leverage else notional
    pnl_pct = round(pos.unrealised_pnl / margin * 100, 2) if margin else 0.0
    return {
        "symbol": pos.symbol, "side": pos.side, "size": pos.size,
        "entry_price": entry, "unrealised_pnl": round(pos.unrealised_pnl, 4),
        "pnl_pct": pnl_pct, "leverage": pos.leverage, "stop_loss": sl,
        "take_profits": tps, "breakeven": at_be,
    }


def positions_snapshot(uid: int, keys: dict) -> dict:
    """Equity + open positions for one user (cached ~20s)."""
    now = time.time()
    with _lock:
        c = _pos_cache.get(uid)
        if c and now - c[0] < _POS_TTL:
            return c[1]
    ex = _exchange(keys)
    equity = ex.get_equity()
    details = [_detail(p) for p in ex.get_open_positions()]
    data = {
        "equity": round(equity, 4),
        "open_positions": len(details),
        "positions": details,
        "open_pnl": round(sum(p["unrealised_pnl"] for p in details), 4),
    }
    with _lock:
        _pos_cache[uid] = (now, data)
    return data


def history_snapshot(uid: int, keys: dict, limit: int = 100) -> dict:
    """Closed trades + win/loss stats for one user (cached ~60s)."""
    now = time.time()
    with _lock:
        c = _hist_cache.get(uid)
        if c and now - c[0] < _HIST_TTL:
            return c[1]
    trades = _exchange(keys).closed_pnl(limit=limit)
    wins = sum(1 for t in trades if (t.get("pnl") or 0) > 0)
    losses = sum(1 for t in trades if (t.get("pnl") or 0) < 0)
    decided = wins + losses
    data = {"trades": trades, "stats": {
        "wins": wins, "losses": losses, "total": len(trades),
        "win_rate": round(wins / decided * 100, 1) if decided else 0.0,
        "realized_pnl": round(sum(t.get("pnl") or 0 for t in trades), 4),
    }}
    with _lock:
        _hist_cache[uid] = (now, data)
    return data
