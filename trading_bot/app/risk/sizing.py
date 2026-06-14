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


def plan_position(
    *,
    equity: float,
    risk_pct: float,
    entry: float,
    stop: float,
    side: str,
    leverage_cap: float,
) -> PositionPlan:
    risk_amount = equity * (risk_pct / 100)
    stop_dist = abs(entry - stop)
    if stop_dist <= 0 or entry <= 0 or equity <= 0:
        return PositionPlan(0, 0, 1, 0, 0, 0, False, "invalid inputs")

    qty = risk_amount / stop_dist
    notional = qty * entry
    leverage = safe_leverage(abs(entry - stop) / entry * 100, leverage_cap)
    margin = notional / leverage

    # Approximate liquidation price for an isolated-margin perp.
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
    )
