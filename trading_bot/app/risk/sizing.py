"""Position sizing.

Implements the agreed model: size by the fixed % risk per trade, with the
stop distance setting quantity, and leverage chosen only to free margin
while keeping the liquidation price safely beyond the stop.

    risk_amount = equity * risk_pct
    qty         = risk_amount / |entry - stop|        (base units)
    notional    = qty * entry
    margin      = notional / leverage
"""
from __future__ import annotations

from dataclasses import dataclass

# Bybit USDT-perp maintenance margin is ~0.5% for majors at low leverage.
MAINT_MARGIN_RATE = 0.005


@dataclass
class PositionPlan:
    qty: float
    notional: float
    leverage: float
    margin: float
    liquidation_price: float
    risk_amount: float
    safe: bool          # True if liquidation is beyond the stop
    reason: str = "ok"


def safe_leverage(stop_pct: float, leverage_cap: float) -> float:
    """Largest leverage (<= cap) whose liquidation distance exceeds the stop.

    Approx liquidation distance ≈ 1/leverage - maintenance_margin_rate.
    We require that to exceed the stop distance with a small buffer.
    """
    stop_frac = stop_pct / 100
    lev = leverage_cap
    while lev > 1:
        liq_dist = 1 / lev - MAINT_MARGIN_RATE
        if liq_dist > stop_frac * 1.2:  # 20% buffer beyond the stop
            return lev
        lev -= 1
    return 1.0


# Never commit more than this fraction of equity as margin to a single trade,
# so a position can always be opened (and others still have margin headroom).
MAX_MARGIN_FRAC = 0.90


def plan_position(
    *,
    equity: float,
    risk_pct: float,
    entry: float,
    stop: float,
    side: str,
    leverage_cap: float,
) -> PositionPlan:
    import math

    risk_amount = equity * (risk_pct / 100)
    stop_dist = abs(entry - stop)
    if stop_dist <= 0 or entry <= 0 or equity <= 0:
        return PositionPlan(0, 0, 1, 0, 0, 0, False, "invalid inputs")

    qty = risk_amount / stop_dist
    notional = qty * entry

    # Leverage must satisfy two bounds:
    #   • affordability: margin = notional/L <= budget  ->  L >= notional/budget
    #   • liquidation safety: 1/L - maint > stop*1.2    ->  L <= L_safe_max
    # We then pick the SMALLEST feasible L (lowest leverage = widest liquidation
    # buffer) rather than maxing leverage. If the two bounds can't both be met,
    # we shrink the position so they can — capital preservation over hitting the
    # exact risk target.
    cap = max(1.0, float(leverage_cap))
    budget = equity * MAX_MARGIN_FRAC
    stop_frac = stop_dist / entry
    l_safe_max = max(1, min(int(cap), int(math.floor(1.0 / (stop_frac * 1.2 + MAINT_MARGIN_RATE)))))
    reason = "ok"

    l_min_afford = max(1, int(math.ceil(notional / budget))) if budget > 0 else l_safe_max
    if l_min_afford > l_safe_max:
        # Can't be both affordable and liquidation-safe — reduce size to fit.
        notional = budget * l_safe_max
        qty = notional / entry
        risk_amount = qty * stop_dist
        leverage = float(l_safe_max)
        reason = "size reduced to keep margin affordable and liquidation safe"
    else:
        leverage = float(l_min_afford)

    margin = notional / leverage
    if side == "long":
        liq = entry * (1 - 1 / leverage + MAINT_MARGIN_RATE)
        safe = liq < stop
    else:
        liq = entry * (1 + 1 / leverage - MAINT_MARGIN_RATE)
        safe = liq > stop

    return PositionPlan(
        qty=round(qty, 8),
        notional=round(notional, 2),
        leverage=leverage,
        margin=round(margin, 2),
        liquidation_price=round(liq, 6),
        risk_amount=round(risk_amount, 2),
        safe=safe,
        reason=reason,
    )
