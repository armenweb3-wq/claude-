"""Error-logging tests (no DB/network — fakes injected)."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.core.bot import TradingBot  # noqa: E402


class _FakeStorage:
    def __init__(self):
        self.errors = []

    def record_error(self, *, source, message, traceback=None):
        self.errors.append({"source": source, "message": message, "traceback": traceback})

    def recent_errors(self, limit=50):
        return list(reversed(self.errors))[:limit]


class _FakeNotifier:
    def __init__(self):
        self.sent = []

    def send(self, text):
        self.sent.append(text)


def _bot():
    bot = TradingBot.__new__(TradingBot)  # skip __init__ (no network/exchange)
    from app.core.bot import BotState

    bot.state = BotState()
    bot.storage = _FakeStorage()
    bot.notifier = _FakeNotifier()
    return bot


def test_handle_error_persists_and_notifies():
    bot = _bot()
    try:
        raise ValueError("boom")
    except ValueError as exc:
        bot.handle_error("tick", exc)

    assert bot.state.error == "boom"
    assert len(bot.storage.errors) == 1
    rec = bot.storage.errors[0]
    assert rec["source"] == "tick"
    assert rec["message"] == "boom"
    assert "ValueError" in (rec["traceback"] or "")
    assert any("boom" in m for m in bot.notifier.sent)


def test_handle_error_survives_storage_failure():
    bot = _bot()

    class _BoomStorage:
        def record_error(self, **_):
            raise RuntimeError("db down")

    bot.storage = _BoomStorage()
    # Must not raise even though persistence fails.
    bot.handle_error("tick", ValueError("x"))
    assert bot.state.error == "x"
