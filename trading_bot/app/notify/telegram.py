"""Telegram notifications.

Lightweight: posts to the Bot API over HTTP (via requests) so we don't need
an event loop just to send alerts.
"""
from __future__ import annotations

import logging

import requests

from .base import Notifier

log = logging.getLogger(__name__)


class TelegramNotifier(Notifier):
    name = "telegram"

    def __init__(self, token: str, chat_id: str) -> None:
        self._url = f"https://api.telegram.org/bot{token}/sendMessage"
        self._chat_id = chat_id

    def send(self, text: str) -> None:
        requests.post(
            self._url,
            json={"chat_id": self._chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10,
        )
