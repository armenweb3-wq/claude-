"""Per-user Telegram alerts for the SaaS, using the shared bot token.

Each user opts in by saving their Telegram chat ID in their profile (after
starting the bot). Sends are best-effort and never raise into the trading loop.
"""
from __future__ import annotations

import logging

from ..config import settings

log = logging.getLogger(__name__)


def send_photo(chat_id: str | None, image: bytes, caption: str | None = None,
               button: dict | None = None) -> bool:
    """Send a PNG photo (e.g. a P&L card) to a chat/channel."""
    if not chat_id or not settings.telegram_bot_token:
        return False
    import json as _json
    data = {"chat_id": chat_id}
    if caption:
        data["caption"] = caption
        data["parse_mode"] = "HTML"
    if button and str(button.get("url", "")).startswith(("http://", "https://")):
        data["reply_markup"] = _json.dumps(
            {"inline_keyboard": [[{"text": button.get("text", "Open"), "url": button["url"]}]]})
    try:
        import requests

        r = requests.post(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendPhoto",
            data=data, files={"photo": ("card.png", image, "image/png")}, timeout=15)
        return r.status_code == 200
    except Exception as exc:  # pragma: no cover - best effort
        log.warning("telegram photo failed: %s", exc)
        return False


def community_button() -> dict | None:
    if settings.community_link:
        return {"text": "Join the free community →", "url": settings.community_link}
    return None


def post_channel(text: str, button: dict | None = None, pin: bool = False) -> dict:
    """Post to the channel (bot must be a channel admin). Returns
    {ok, message_id, error} so callers can surface the real Telegram error."""
    if not settings.telegram_bot_token:
        return {"ok": False, "error": "TELEGRAM_BOT_TOKEN is not set"}
    if not settings.channel_chat_id:
        return {"ok": False, "error": "TELEGRAM_CHANNEL_ID is not set"}
    payload = {"chat_id": settings.channel_chat_id, "text": text, "parse_mode": "HTML",
               "disable_web_page_preview": True}
    if button and str(button.get("url", "")).startswith(("http://", "https://")):
        payload["reply_markup"] = {"inline_keyboard": [[{"text": button.get("text", "Open"),
                                                         "url": button["url"]}]]}
    try:
        import requests

        base = f"https://api.telegram.org/bot{settings.telegram_bot_token}"
        data = requests.post(base + "/sendMessage", json=payload, timeout=8).json()
        if not data.get("ok"):
            return {"ok": False, "error": f"{data.get('description','error')} (chat={settings.channel_chat_id})"}
        mid = (data.get("result") or {}).get("message_id")
        if pin and mid:
            requests.post(base + "/pinChatMessage",
                          json={"chat_id": settings.channel_chat_id, "message_id": mid,
                                "disable_notification": True}, timeout=8)
        return {"ok": True, "message_id": mid}
    except Exception as exc:  # pragma: no cover - best effort
        log.warning("channel post failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def notify(chat_id: str | None, text: str, button: dict | None = None) -> bool:
    """Send a Telegram message; optional inline button {text,url}. Returns ok."""
    if not chat_id or not settings.telegram_bot_token:
        return False
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
               "disable_web_page_preview": True}
    if button and str(button.get("url", "")).startswith(("http://", "https://")):
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
