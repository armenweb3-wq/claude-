"""Telegram signal-format tests."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.strategy.base import Signal, TakeProfit  # noqa: E402
from app.notify.signal_format import format_signal  # noqa: E402


def _signal():
    return Signal(
        action="long", confidence=0.78, entry=30000.0, stop_loss=29100.0,
        take_profits=[
            TakeProfit(6, 0.30, 31800.0),
            TakeProfit(12, 0.40, 33600.0),
            TakeProfit(20, 0.30, 36000.0),
        ],
        leverage=10, risk_reward=4.2,
    )


def test_format_contains_all_required_fields():
    msg = format_signal("BTCUSDT", _signal(), dry_run=True)
    for token in ["Asset", "BTCUSDT", "BUY", "Entry", "Leverage", "10x",
                  "Stop Loss", "TP1", "TP2", "TP3", "Risk:Reward", "4.2"]:
        assert token in msg


def test_short_maps_to_sell():
    sig = _signal()
    sig.action = "short"
    assert "SELL" in format_signal("ETHUSDT", sig)
