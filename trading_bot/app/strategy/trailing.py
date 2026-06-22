"""Shared TP-ladder trailing logic — the single source of truth used by BOTH the
single-user bot and the multi-user engine, so a fix is made once, not twice.

The rules: as take-profits fill, ratchet the stop forward — TP1 -> break-even,
TP2 -> TP1, etc. The stop only ever moves in the profitable direction.
"""
from __future__ import annotations

TP_LADDER_PCTS = (6.0, 15.0, 50.0)
BREAKEVEN_BUFFER = 0.0012  # ~0.12% past entry to cover round-trip taker fees


def ladder_prices(entry: float, is_long: bool, tp_pcts=TP_LADDER_PCTS) -> list[float]:
    sign = 1.0 if is_long else -1.0
    return [entry * (1 + sign * p / 100) for p in tp_pcts]


def tp_hits_from_fills(closed, symbol, opened_at, tps, tol: float = 0.004) -> int:
    """Count how many distinct TP *levels* have an actual closing fill at (≈) that
    price since the position opened. Matching on price means stop-loss hits,
    manual/regime closes, and older round-trips of the same symbol are NOT
    miscounted — the root cause of premature force-closes."""
    n = 0
    for tp in tps:
        for r in closed:
            if r.get("symbol") != symbol:
                continue
            ca = r.get("closed_at") or ""
            if opened_at and ca < opened_at:
                continue
            ep = r.get("exit_price") or 0
            if ep and tp and abs(ep - tp) / tp <= tol:
                n += 1
                break
    return n


def tp_hits_from_price(price: float, tps, is_long: bool) -> int:
    """Fallback: count consecutive ladder levels the live price has passed."""
    sign = 1.0 if is_long else -1.0
    n = 0
    for t in tps:
        if sign * (price - t) >= 0:
            n += 1
        else:
            break
    return n


def trail_target(entry: float, is_long: bool, tps, hit: int,
                 buffer: float = BREAKEVEN_BUFFER) -> float:
    """Stop price for `hit` TPs reached: TP1 -> entry+buffer, TP2 -> TP1, …"""
    sign = 1.0 if is_long else -1.0
    return entry * (1 + sign * buffer) if hit == 1 else tps[hit - 2]


def is_forward(target: float, current: float, is_long: bool) -> bool:
    """True if `target` moves the stop in the profitable direction only."""
    return (target > current) if is_long else (current == 0 or target < current)
