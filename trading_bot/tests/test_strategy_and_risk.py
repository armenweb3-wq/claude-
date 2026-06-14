"""Unit tests that run without network, DB, or API keys."""
from __future__ import annotations

import sys
import pathlib

import numpy as np
import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.risk.manager import RiskManager  # noqa: E402
from app.strategy.sma_crossover import SmaCrossover  # noqa: E402


def _df(prices: list[float]) -> pd.DataFrame:
    idx = pd.date_range("2024-01-01", periods=len(prices), freq="15min", tz="UTC")
    return pd.DataFrame(
        {"open": prices, "high": prices, "low": prices, "close": prices, "volume": 1.0},
        index=idx,
    )


def test_sma_crossover_long_signal():
    # Flat, then a jump on the final bar pulls the fast SMA above the slow.
    prices = [100.0] * 22 + [110.0]
    sig = SmaCrossover().generate(_df(prices))
    assert sig.action == "long"


def test_sma_crossover_short_signal():
    # Flat, then a drop on the final bar pulls the fast SMA below the slow.
    prices = [100.0] * 22 + [90.0]
    sig = SmaCrossover().generate(_df(prices))
    assert sig.action == "short"


def test_sma_crossover_hold_on_short_history():
    sig = SmaCrossover().generate(_df([100, 101, 102]))
    assert sig.action == "hold"


def test_risk_sizing_positive_and_capped():
    rm = RiskManager()
    d = rm.evaluate(side="long", equity=10_000, price=100.0, open_positions=0)
    assert d.allowed
    assert d.qty > 0
    assert d.stop_loss is not None and d.stop_loss < 100.0
    assert d.take_profit is not None and d.take_profit > 100.0


def test_risk_blocks_when_max_positions_reached():
    rm = RiskManager()
    d = rm.evaluate(side="long", equity=10_000, price=100.0, open_positions=99)
    assert not d.allowed


def test_daily_drawdown_halts():
    rm = RiskManager()
    rm.register_equity(10_000)
    # Drop equity well past the default 5% daily cap.
    assert rm.daily_drawdown_breached(9_000)
    d = rm.evaluate(side="long", equity=9_000, price=100.0, open_positions=0)
    assert not d.allowed
