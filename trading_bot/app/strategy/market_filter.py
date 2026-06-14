"""BTC-led market filter.

Altcoins are highly correlated to Bitcoin. This filter reads BTC's trend
once per cycle and decides, for the *whole* market, whether longs and/or
shorts are sensible right now:

- BTC crashing / bearish structure  -> block LONGs (don't buy a falling
  market just because an alt looks "oversold")
- BTC pumping / bullish structure   -> block SHORTs (don't fight a rising
  market)
- BTC neutral / choppy              -> allow both; per-symbol confluence
  decides

This protects against the classic correlated-loss trap in both directions.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .indicators import ema


@dataclass
class MarketBias:
    regime: str          # "up" | "down" | "neutral"
    allow_long: bool
    allow_short: bool
    change_pct: float    # recent BTC % change over the lookback
    reason: str


def assess_market(
    df: pd.DataFrame,
    *,
    ema_fast: int = 50,
    ema_slow: int = 200,
    crash_pct: float = 3.0,
    lookback: int = 6,
) -> MarketBias:
    """Classify BTC and return what the market allows."""
    if df is None or len(df) < ema_slow + lookback + 1:
        return MarketBias("neutral", True, True, 0.0, "insufficient BTC data")

    close = df["close"]
    ef = float(ema(close, ema_fast).iloc[-1])
    es = float(ema(close, ema_slow).iloc[-1])
    price = float(close.iloc[-1])
    ref = float(close.iloc[-1 - lookback])
    change = (price / ref - 1) * 100 if ref else 0.0

    bearish = price < es and ef < es
    bullish = price > es and ef > es
    crashing = change <= -crash_pct
    pumping = change >= crash_pct

    if crashing or (bearish and change < 0):
        reason = f"BTC {'crashing' if crashing else 'bearish'} ({change:+.1f}%) — longs paused"
        return MarketBias("down", allow_long=False, allow_short=True,
                          change_pct=round(change, 2), reason=reason)
    if pumping or (bullish and change > 0):
        reason = f"BTC {'pumping' if pumping else 'bullish'} ({change:+.1f}%) — shorts paused"
        return MarketBias("up", allow_long=True, allow_short=False,
                          change_pct=round(change, 2), reason=reason)

    return MarketBias("neutral", True, True, round(change, 2),
                      f"BTC neutral ({change:+.1f}%) — both directions allowed")
