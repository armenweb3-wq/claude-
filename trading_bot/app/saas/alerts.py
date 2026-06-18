"""Per-user Telegram alerts for the SaaS, using the shared bot token.

Each user opts in by saving their Telegram chat ID in their profile (after
starting the bot). Sends are best-effort and never raise into the trading loop.
"""
from __future__ import annotations

import logging

from ..config import settings

log = logging.getLogger(__name__)


def community_button() -> dict | None:
    if settings.community_link:
        return {"text": "Join the free community →", "url": settings.community_link}
    return None


def notify(chat_id: str | None, text: str, button: dict | None = None) -> bool:
    """Send a Telegram message; optional inline button {text,url}. Returns ok."""
    if not chat_id or not settings.telegram_bot_token:
        return False
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
               "disable_web_page_preview": True}
    if button and button.get("url"):
        payload["reply_markup"] = {"inline_keyboard": [[{"text": button.get("text", "Open"),
                                                         "url": button["url"]}]]}
    try:
        import requests

        r = requests.post(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
            json=payload, timeout=8)
        return r.status_code == 200
    except Exception as exc:  # pragma: no cover - best effort
        log.warning("telegram alert failed: %s", exc)
        return False
