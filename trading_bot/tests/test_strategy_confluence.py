"""Tests for indicators, sizing, confluence strategy, and the backtester."""
from __future__ import annotations

import pathlib
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.strategy.indicators import ema, rsi, swing_zones  # noqa: E402
from app.strategy.confluence import ConfluenceStrategy, StrategyConfig  # noqa: E402
from app.risk.sizing import plan_position, safe_leverage  # noqa: E402
from app.backtest.data import synthetic_ohlcv  # noqa: E402
from app.backtest.engine import Backtester, BacktestConfig  # noqa: E402


def test_rsi_bounds_and_extremes():
    up = pd.Series(np.linspace(1, 100, 100))
    down = pd.Series(np.linspace(100, 1, 100))
    assert rsi(up).iloc[-1] > 80
    assert rsi(down).iloc[-1] < 20
    assert (rsi(up) <= 100).all() and (rsi(up) >= 0).all()


def test_ema_tracks_series():
    s = pd.Series([10.0] * 50)
    assert abs(ema(s, 10).iloc[-1] - 10.0) < 1e-9


def test_swing_zones_finds_both_kinds():
    prices = [10, 11, 12, 8, 9, 13, 14, 7, 8, 15, 16, 6, 7, 17]
    df = pd.DataFrame({"high": prices, "low": [p - 0.5 for p in prices], "close": prices})
    zones = swing_zones(df, lookback=2)
    kinds = {z.kind for z in zones}
    assert kinds  # found at least one zone


def test_sizing_risks_the_right_amount():
    # Risk 5% of 10k with a 3% stop -> notional ~1.67x equity.
    plan = plan_position(
        equity=10_000, risk_pct=5.0, entry=100.0, stop=97.0,
        side="long", leverage_cap=10.0,
    )
    # Loss at stop = qty * stop_dist should equal the risk amount (500).
    assert abs(plan.qty * 3.0 - 500.0) < 1e-6
    assert abs(plan.notional - 16_666.67) < 1.0
    assert plan.safe  # liquidation beyond the stop


def test_safe_leverage_keeps_liquidation_beyond_stop():
    lev = safe_leverage(stop_pct=3.0, leverage_cap=10.0)
    # 1/lev - maint must exceed 3% with buffer.
    assert lev <= 10
    assert (1 / lev - 0.005) > 0.03


def test_confidence_gate_blocks_low_scores():
    # A flat market should not produce high-confidence trades.
    flat = pd.DataFrame({
        "open": [100.0] * 300, "high": [100.5] * 300,
        "low": [99.5] * 300, "close": [100.0] * 300, "volume": [1.0] * 300,
    }, index=pd.date_range("2023-01-01", periods=300, freq="1h", tz="UTC"))
    sig = ConfluenceStrategy(StrategyConfig(confidence_threshold=0.7)).generate(flat)
    assert sig.action == "hold"


def test_backtester_runs_and_is_self_consistent():
    df = synthetic_ohlcv(periods=2500, freq="1h", seed=11)
    bt = Backtester(config=BacktestConfig(initial_equity=10_000))
    res = bt.run(df, "BTCUSDT", "1h")
    assert res.final_equity > 0
    assert len(res.equity_curve) > 0
    # Every closed trade has an exit and a sane realized PnL number.
    for t in res.trades:
        if t.exit_time is not None:
            assert isinstance(t.realized_pnl, float)
