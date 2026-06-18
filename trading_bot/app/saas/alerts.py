"""Per-user Telegram alerts for the SaaS, using the shared bot token.

Each user opts in by saving their Telegram chat ID in their profile (after
starting the bot). Sends are best-effort and never raise into the trading loop.
"""
from __future__ import annotations

import logging

from ..config import settings

log = logging.getLogger(__name__)


def notify(chat_id: str | None, text: str) -> None:
    if not chat_id or not settings.telegram_bot_token:
        return
    try:
        import requests

        requests.post(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=8,
        )
    except Exception as exc:  # pragma: no cover - best effort
        log.warning("telegram alert failed: %s", exc)
