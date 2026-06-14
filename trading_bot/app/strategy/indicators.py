"""Technical indicators and price-structure helpers.

Pure functions over pandas Series/DataFrames so they're trivially testable
and reusable by both the live strategy and the backtester.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


def ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Wilder's RSI."""
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    out = 100 - (100 / (1 + rs))
    # Boundary cases the ratio can't express:
    out = out.mask((avg_loss == 0) & (avg_gain > 0), 100.0)   # pure gains
    out = out.mask((avg_gain == 0) & (avg_loss > 0), 0.0)     # pure losses
    out = out.mask((avg_gain == 0) & (avg_loss == 0), 50.0)   # flat
    return out.fillna(50.0)  # warmup / first NaN


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high, low, close = df["high"], df["low"], df["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


@dataclass
class Zone:
    kind: str   # "demand" | "supply"
    low: float
    high: float
    index: int


def swing_zones(df: pd.DataFrame, lookback: int = 5, max_zones: int = 5) -> list[Zone]:
    """Identify recent supply/demand zones from fractal swing points.

    A demand zone is built around a confirmed swing low; a supply zone around
    a confirmed swing high. The zone band is the candle's low/high range.
    """
    highs, lows = df["high"].values, df["low"].values
    n = len(df)
    zones: list[Zone] = []
    for i in range(lookback, n - lookback):
        window_high = highs[i - lookback : i + lookback + 1]
        window_low = lows[i - lookback : i + lookback + 1]
        if highs[i] == window_high.max():
            zones.append(Zone("supply", lows[i], highs[i], i))
        elif lows[i] == window_low.min():
            zones.append(Zone("demand", lows[i], highs[i], i))
    return zones[-max_zones:]


def nearest_zone(zones: list[Zone], kind: str, price: float) -> Zone | None:
    candidates = [z for z in zones if z.kind == kind]
    if not candidates:
        return None
    return min(candidates, key=lambda z: abs((z.low + z.high) / 2 - price))


def proximity_pct(price: float, zone: Zone) -> float:
    """Percent distance from price to the nearest edge of a zone (0 if inside)."""
    if zone.low <= price <= zone.high:
        return 0.0
    edge = zone.low if price < zone.low else zone.high
    return abs(price - edge) / price * 100
