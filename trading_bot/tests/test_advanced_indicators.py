"""Tests for the multi-timeframe / pattern / strength indicators."""
from __future__ import annotations

import pathlib
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.strategy.indicators import (  # noqa: E402
    adx, detect_flag, to_higher_tf, volume_ratio,
)


def _df(prices, vol=None):
    n = len(prices)
    idx = pd.date_range("2024-01-01", periods=n, freq="1h", tz="UTC")
    return pd.DataFrame({
        "open": prices,
        "high": [p * 1.001 for p in prices],
        "low": [p * 0.999 for p in prices],
        "close": prices,
        "volume": vol if vol is not None else [1.0] * n,
    }, index=idx)


def test_adx_high_in_trend_low_in_chop():
    trend = adx(_df(list(np.linspace(100, 200, 200)))).iloc[-1]
    chop = adx(_df([100 + (i % 2) * 0.1 for i in range(200)])).iloc[-1]
    assert trend > chop


def test_higher_timeframe_aggregates():
    htf = to_higher_tf(_df(list(range(1, 41))), factor=4)
    assert len(htf) == 10
    assert htf["high"].iloc[0] >= htf["low"].iloc[0]


def test_volume_ratio_detects_spike():
    vols = [1.0] * 25 + [5.0]
    assert volume_ratio(_df([100] * 26, vol=vols)) > 2.0


def test_detect_bull_and_bear_flag():
    # impulse (pole) then a tight consolidation (flag); needs >= 11 bars
    bull = [98, 99, 100, 102, 104, 106, 110] + [110, 109.8, 110.1, 109.9, 110.0]
    assert detect_flag(_df(bull)) == "bull"
    bear = [112, 111, 110, 108, 106, 104, 100] + [100, 100.1, 99.9, 100.0, 100.1]
    assert detect_flag(_df(bear)) == "bear"
    flat = [100 + (i % 2) * 0.1 for i in range(20)]
    assert detect_flag(_df(flat)) is None
