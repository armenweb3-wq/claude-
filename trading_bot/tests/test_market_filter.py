"""BTC market-filter tests."""
from __future__ import annotations

import pathlib
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.strategy.market_filter import assess_market  # noqa: E402


def _df(prices):
    idx = pd.date_range("2024-01-01", periods=len(prices), freq="1h", tz="UTC")
    return pd.DataFrame({"open": prices, "high": prices, "low": prices,
                         "close": prices, "volume": 1.0}, index=idx)


def test_btc_crash_blocks_longs():
    # Uptrend then a sharp drop in the last few bars.
    prices = list(np.linspace(100, 120, 260)) + [118, 114, 110, 106, 101, 96]
    bias = assess_market(_df(prices), crash_pct=3.0, lookback=6)
    assert bias.allow_short and not bias.allow_long
    assert bias.regime == "down"


def test_btc_pump_blocks_shorts():
    prices = list(np.linspace(120, 100, 260)) + [102, 106, 110, 115, 121, 127]
    bias = assess_market(_df(prices), crash_pct=3.0, lookback=6)
    assert bias.allow_long and not bias.allow_short
    assert bias.regime == "up"


def test_btc_flat_allows_both():
    prices = [100 + (i % 3) * 0.2 for i in range(280)]
    bias = assess_market(_df(prices), crash_pct=3.0, lookback=6)
    assert bias.allow_long and bias.allow_short


def test_insufficient_data_is_permissive():
    bias = assess_market(_df([100, 101, 102]))
    assert bias.allow_long and bias.allow_short
