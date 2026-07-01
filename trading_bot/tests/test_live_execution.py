"""Tests for the plan-based execution flow (paper + bot wiring)."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.core.bot import BotState, TradingBot  # noqa: E402
from app.exchange.base import ExchangeAdapter, ExecutionResult, InstrumentRules, Position  # noqa: E402
from app.strategy.base import Signal, TakeProfit  # noqa: E402


def _signal():
    entry = 100.0
    return Signal(
        action="long", confidence=0.8, entry=entry, stop_loss=entry * 0.97,
        take_profits=[
            TakeProfit(6, 0.30, entry * 1.06),
            TakeProfit(12, 0.40, entry * 1.12),
            TakeProfit(20, 0.30, entry * 1.20),
        ],
        leverage=10, risk_reward=4.2,
    )


class _FakeExchange(ExchangeAdapter):
    name = "fake"

    def __init__(self, ok=True, reason=""):
        self.ok, self.reason = ok, reason
        self.calls = []

    def get_klines(self, *a, **k): ...
    def get_equity(self): return 10_000.0
    def get_position(self, symbol): return Position(symbol, None, 0.0, 0.0)
    def place_order(self, order): return order
    def close_position(self, symbol): return None
    def instrument_rules(self, symbol): return InstrumentRules(0, 0, 0)
    def set_leverage(self, symbol, leverage): ...
    def open_position(self, symbol, side, qty, leverage, stop_loss, take_profits):
        self.calls.append(dict(symbol=symbol, side=side, qty=qty, leverage=leverage,
                               stop_loss=stop_loss, tps=len(take_profits)))
        return ExecutionResult(self.ok, skipped_reason=self.reason,
                               entry_order_id="x", qty=qty, leverage=leverage)


class _Notifier:
    def __init__(self): self.sent = []
    def send(self, text): self.sent.append(text)


class _Storage:
    def __init__(self): self.trades = []
    def record_trade(self, **kw): self.trades.append(kw)


def _bot(exchange):
    bot = TradingBot.__new__(TradingBot)
    bot.state = BotState()
    bot.exchange = exchange
    bot.notifier = _Notifier()
    bot.storage = _Storage()

    class _S:
        name = "confluence"
    bot.strategy = _S()
    return bot


def test_open_from_signal_broadcasts_and_executes():
    ex = _FakeExchange(ok=True)
    bot = _bot(ex)
    opened = bot._open_from_signal("SOLUSDT", _signal(), equity=10_000.0)
    assert opened is True
    # Exactly one execution with a Buy side, a stop, and the 3-rung ladder.
    assert len(ex.calls) == 1
    call = ex.calls[0]
    assert call["side"] == "Buy" and call["tps"] == 3 and call["stop_loss"] > 0
    # Signal broadcast happened before the OPEN confirmation.
    assert any("SIGNAL" in m for m in bot.notifier.sent)
    assert any("OPEN" in m for m in bot.notifier.sent)
    assert len(bot.storage.trades) == 1


def test_open_from_signal_respects_exchange_skip():
    ex = _FakeExchange(ok=False, reason="qty below exchange minimum")
    bot = _bot(ex)
    opened = bot._open_from_signal("BTCUSDT", _signal(), equity=13.0)
    assert opened is False
    assert any("skipped" in m for m in bot.notifier.sent)
    assert bot.storage.trades == []  # nothing recorded when skipped


def test_paper_open_position_records_fill():
    from app.exchange.paper import PaperExchange

    ex = PaperExchange(starting_equity=10_000)
    ex._last_price = lambda symbol: 100.0  # avoid network in the sandbox
    res = ex.open_position("SOLUSDT", "Buy", qty=1.5, leverage=10,
                           stop_loss=97.0, take_profits=_signal().take_profits)
    assert res.ok and res.qty == 1.5
    assert ex.get_position("SOLUSDT").side == "Buy"
