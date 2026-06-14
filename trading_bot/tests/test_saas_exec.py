"""Per-user execution engine: gating + order placement with a fake exchange."""
from __future__ import annotations

import pathlib
import sys

import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.exchange.base import ExecutionResult, Position  # noqa: E402
from app.strategy.base import Signal, TakeProfit  # noqa: E402
from app.saas.usertrader import UserTrader, manage_breakeven  # noqa: E402


class FakeStrategy:
    name = "fake"

    def __init__(self, action="long"):
        self._action = action

    def generate(self, df):
        return Signal(action=self._action, reason="test", confidence=0.85,
                      entry=100.0, stop_loss=97.0,
                      take_profits=[TakeProfit(6, 0.3, 106.0), TakeProfit(12, 0.4, 112.0)],
                      leverage=5, risk_reward=4.0)


class FakeExchange:
    def __init__(self, position=None):
        self.position = position or Position("BTCUSDT", None, 0.0, 0.0)
        self.opened = []
        self.stops = []

    def get_equity(self):
        return 1000.0

    def get_klines(self, symbol, interval, limit=200):
        return pd.DataFrame({"open": [1, 2], "high": [1, 2], "low": [1, 2],
                             "close": [1, 2], "volume": [1, 2]})

    def get_position(self, symbol):
        return self.position

    def last_price(self, symbol):
        return 110.0

    def set_stop_loss(self, symbol, price):
        self.stops.append((symbol, price))

    def open_position(self, **kw):
        self.opened.append(kw)
        return ExecutionResult(ok=True, qty=kw["qty"], leverage=kw["leverage"])


def test_opens_position_on_signal():
    ex = FakeExchange()
    t = UserTrader(ex, FakeStrategy("long"), risk_pct=2.0, symbols=["BTCUSDT"], dry=False)
    out = t.run_once()
    assert out["error"] is None
    assert len(ex.opened) == 1
    assert ex.opened[0]["side"] == "Buy"
    assert ex.opened[0]["stop_loss"] == 97.0
    assert out["opened"][0]["symbol"] == "BTCUSDT"


def test_dry_run_places_no_orders():
    ex = FakeExchange()
    t = UserTrader(ex, FakeStrategy("long"), risk_pct=2.0, symbols=["BTCUSDT"], dry=True)
    out = t.run_once()
    assert ex.opened == []
    assert out["opened"][0]["dry"] is True


def test_skips_when_already_in_position():
    ex = FakeExchange(position=Position("BTCUSDT", "Buy", 0.5, 100.0))
    t = UserTrader(ex, FakeStrategy("long"), risk_pct=2.0, symbols=["BTCUSDT"], dry=False)
    out = t.run_once()
    assert ex.opened == []
    assert out["positions"] == 1


def test_breakeven_moves_stop_after_tp1():
    # long entry 100, price 110 (>+6% TP1) → stop should move to ~break-even
    ex = FakeExchange()
    pos = Position("BTCUSDT", "Buy", 0.5, 100.0, 0.0, 0.0)
    manage_breakeven(ex, "BTCUSDT", pos)
    assert ex.stops and ex.stops[0][1] >= 100.0
