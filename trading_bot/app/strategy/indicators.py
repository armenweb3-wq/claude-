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


def adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average Directional Index — trend strength (not direction)."""
    high, low, close = df["high"], df["low"], df["close"]
    up = high.diff()
    down = -low.diff()
    plus_dm = ((up > down) & (up > 0)) * up
    minus_dm = ((down > up) & (down > 0)) * down
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    atr_ = tr.ewm(alpha=1 / period, adjust=False).mean()
    plus_di = 100 * plus_dm.ewm(alpha=1 / period, adjust=False).mean() / atr_.replace(0, np.nan)
    minus_di = 100 * minus_dm.ewm(alpha=1 / period, adjust=False).mean() / atr_.replace(0, np.nan)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return dx.ewm(alpha=1 / period, adjust=False).mean().fillna(0.0)


def to_higher_tf(df: pd.DataFrame, factor: int = 4) -> pd.DataFrame:
    """Aggregate `factor` bars into one higher-timeframe candle.

    Uses the timestamp index to resample to wall-clock HTF buckets and DROPS the
    last (incomplete) bucket, so the most recent HTF candle is a true, complete
    candle rather than a shifting partial aggregate. Falls back to positional
    grouping (anchored to the END so the latest bucket is complete) if the index
    isn't datetime.
    """
    if isinstance(df.index, pd.DatetimeIndex) and len(df) >= 2:
        step = df.index.to_series().diff().dropna().median()
        if pd.notna(step) and step > pd.Timedelta(0):
            rule = step * factor
            g = df.resample(rule, label="left", closed="left")
            agg = g.agg({"open": "first", "high": "max", "low": "min",
                         "close": "last", "volume": "sum"}).dropna()
            counts = g.size()
            if len(agg) and len(counts) and counts.iloc[-1] < factor:
                agg = agg.iloc[:-1]  # drop the incomplete trailing bucket
            if len(agg):
                return agg
    # Fallback: positional, anchored to the end so the newest bucket is complete.
    n = len(df)
    group = (np.arange(n)[::-1] // factor)[::-1]
    return df.groupby(group).agg(
        {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    )


def volume_ratio(df: pd.DataFrame, window: int = 20) -> float:
    """Latest volume relative to its recent average (>1 = above average)."""
    if len(df) < window + 1:
        return 1.0
    avg = df["volume"].iloc[-window:].mean()
    if avg <= 0:
        return 1.0
    return float(df["volume"].iloc[-1] / avg)


def detect_flag(
    df: pd.DataFrame, pole: int = 5, flag: int = 5,
    pole_pct: float = 4.0, flag_max_pct: float = 3.0,
) -> str | None:
    """Detect a bull/bear flag: a strong impulse (the pole) followed by a
    tight consolidation (the flag). Returns 'bull', 'bear', or None.
    """
    if len(df) < pole + flag + 1:
        return None
    close = df["close"].values
    pole_start = close[-(pole + flag)]
    pole_end = close[-flag - 1]
    if pole_start <= 0:
        return None
    pole_ret = (pole_end / pole_start - 1) * 100
    seg = close[-flag:]
    flag_range = (seg.max() - seg.min()) / seg.min() * 100 if seg.min() > 0 else 100.0
    if pole_ret >= pole_pct and flag_range <= flag_max_pct:
        return "bull"
    if pole_ret <= -pole_pct and flag_range <= flag_max_pct:
        return "bear"
    return None
