"""Telegram command-logic tests (no telegram SDK / network required)."""
from __future__ import annotations

import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.integrations.telegram_control import TelegramController  # noqa: E402


class _FakeState:
    running = False
    paused = False
    mode = "dry_run"
    strategy = "sma_crossover"
    last_run = None


class _FakeBot:
    def __init__(self):
        self.state = _FakeState()
        self.calls = []

    async def start(self):
        self.calls.append("start")
        self.state.running = True

    async def stop(self):
        self.calls.append("stop")
        self.state.running = False

    def pause(self):
        self.calls.append("pause")
        self.state.paused = True

    def resume(self):
        self.calls.append("resume")
        self.state.paused = False


def _controller():
    return TelegramController(_FakeBot(), token="t", chat_id="12345")


def test_authorization():
    c = _controller()
    assert c.authorized(12345)
    assert c.authorized("12345")
    assert not c.authorized(999)


def test_commands_drive_the_bot():
    c = _controller()
    assert "started" in asyncio.run(c.handle("/start"))
    assert c._bot.calls[-1] == "start"
    asyncio.run(c.handle("/pause"))
    assert c._bot.calls[-1] == "pause"
    asyncio.run(c.handle("/resume"))
    assert c._bot.calls[-1] == "resume"
    asyncio.run(c.handle("/stop"))
    assert c._bot.calls[-1] == "stop"


def test_status_and_unknown():
    c = _controller()
    assert "Status" in asyncio.run(c.handle("/status"))
    assert "unknown" in asyncio.run(c.handle("/wat")).lower()


def test_command_with_botname_suffix():
    # Telegram appends @botname in groups, e.g. /status@my_bot
    c = _controller()
    assert "Status" in asyncio.run(c.handle("/status@my_trading_bot"))
