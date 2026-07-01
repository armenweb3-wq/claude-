"""Market-regime detection.

Rather than hard-coding "we are in a bear market", we detect the regime
dynamically from price structure so the bot adapts as the cycle turns.
The strategy uses the regime to bias long/short confidence and to cap
leverage more tightly in adverse conditions.

Cycle/halving context is encoded as a *bias*, not a prediction: in a bear
regime we favour shorts and trim risk; in a bull regime, the reverse.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pandas as pd

from .indicators import ema

Regime = Literal["bull", "bear", "neutral"]


@dataclass
class RegimeView:
    regime: Regime
    long_bias: float    # multiplier applied to long confidence
    short_bias: float   # multiplier applied to short confidence
    leverage_factor: float  # multiplier applied to the leverage cap (<=1)


def detect_regime(df: pd.DataFrame, ema_period: int = 200) -> RegimeView:
    """Classify regime from price vs a slow EMA and that EMA's slope.

    `df` should be a higher-timeframe series (e.g. resample 1h->1D) for a
    macro view, but works on any timeframe.
    """
    if len(df) < ema_period + 5:
        return RegimeView("neutral", 1.0, 1.0, 1.0)

    close = df["close"]
    slow = ema(close, ema_period)
    price = close.iloc[-1]
    slope = slow.iloc[-1] - slow.iloc[-5]

    above = price > slow.iloc[-1]
    rising = slope > 0

    if above and rising:
        return RegimeView("bull", long_bias=1.1, short_bias=0.7, leverage_factor=1.0)
    if not above and not rising:
        # Bear: favour shorts, cut leverage to protect capital.
        return RegimeView("bear", long_bias=0.6, short_bias=1.1, leverage_factor=0.6)
    return RegimeView("neutral", long_bias=0.9, short_bias=0.9, leverage_factor=0.8)


def higher_timeframe(df: pd.DataFrame, rule: str = "1D") -> pd.DataFrame:
    """Resample an OHLCV frame to a higher timeframe for the macro view."""
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    return df.resample(rule).agg(agg).dropna()
