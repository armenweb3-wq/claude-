"""MetaTrader 5 position sizing (lots).

MT5 brokers like Equiti size in *lots*, not crypto-style notional + leverage,
so this is deliberately separate from ``risk.sizing.plan_position`` (which models
USDT-perp liquidation). The risk model is the same idea — risk a fixed % of
equity per trade, with the stop distance setting the size:

    risk_amount   = equity * risk_pct/100                 (account currency)
    loss_per_lot  = (stop_distance / tick_size) * tick_value
    volume (lots) = risk_amount / loss_per_lot
                    rounded DOWN to volume_step, clamped to [min, max] volume

``tick_size``/``tick_value`` come from the instrument specification (how much one
tick of price movement is worth for 1.0 lot). Sizing is capital-preserving: we
round volume DOWN and never exceed the broker's max volume.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Mt5Plan:
    volume: float            # lots to trade (0 = cannot size a valid order)
    risk_amount: float       # intended risk in account currency
    est_loss_at_stop: float  # actual risk at the rounded volume
    reason: str = "ok"


def _round_step(value: float, step: float) -> float:
    """Round DOWN to a volume step (e.g. 0.01 lots)."""
    if step <= 0:
        return value
    # Integer number of steps, guarding float dust (0.299999 -> 0.30).
    n = int((value + step * 1e-9) / step)
    return round(n * step, 8)


def plan_mt5_position(
    *,
    equity: float,
    risk_pct: float,
    entry: float,
    stop: float,
    tick_size: float,
    tick_value: float,
    min_volume: float = 0.01,
    max_volume: float = 100.0,
    volume_step: float = 0.01,
) -> Mt5Plan:
    stop_dist = abs(entry - stop)
    if equity <= 0 or risk_pct <= 0 or stop_dist <= 0 or tick_size <= 0 or tick_value <= 0:
        return Mt5Plan(0.0, 0.0, 0.0, "invalid inputs")

    risk_amount = equity * (risk_pct / 100.0)
    loss_per_lot = (stop_dist / tick_size) * tick_value
    if loss_per_lot <= 0:
        return Mt5Plan(0.0, round(risk_amount, 2), 0.0, "invalid instrument spec")

    raw = risk_amount / loss_per_lot
    volume = _round_step(raw, volume_step)

    if volume < min_volume:
        # Smallest tradable lot would risk more than the target — only allow it
        # when the min-lot risk stays within ~1.5x the target, else skip (a tiny
        # account shouldn't be forced into an oversized index position).
        if min_volume * loss_per_lot <= risk_amount * 1.5:
            return Mt5Plan(min_volume, round(risk_amount, 2),
                           round(min_volume * loss_per_lot, 2),
                           "rounded up to broker minimum volume")
        return Mt5Plan(0.0, round(risk_amount, 2), 0.0,
                       "risk too small for the minimum lot")

    if volume > max_volume:
        volume = _round_step(max_volume, volume_step)

    return Mt5Plan(volume, round(risk_amount, 2), round(volume * loss_per_lot, 2), "ok")
