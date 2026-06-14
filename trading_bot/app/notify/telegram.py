"""Telegram notifications.

Lightweight: posts to the Bot API over HTTP (via requests) so we don't need
an event loop just to send alerts. Disabled cleanly if not configured.
"""
from __future__ import annotations

import logging

import requests

from ..config import settings

log = logging.getLogger(__name__)


class Notifier:
    def __init__(self, token: str, chat_id: str) -> None:
        self._url = f"https://api.telegram.org/bot{token}/sendMessage"
        self._chat_id = chat_id

    def send(self, text: str) -> None:
        try:
            requests.post(
                self._url,
                json={"chat_id": self._chat_id, "text": text, "parse_mode": "HTML"},
                timeout=10,
            )
        except Exception as exc:  # pragma: no cover - best effort
            log.warning("Telegram send failed: %s", exc)


class _NullNotifier(Notifier):
    def __init__(self) -> None:  # noqa: D107
        pass

    def send(self, text: str) -> None:
        log.info("[notify] %s", text)


def get_notifier() -> Notifier:
    if settings.telegram_bot_token and settings.telegram_chat_id:
        return Notifier(settings.telegram_bot_token, settings.telegram_chat_id)
    return _NullNotifier()
