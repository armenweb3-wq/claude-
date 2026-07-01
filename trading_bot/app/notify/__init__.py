"""Notification channels.

``get_notifier()`` builds a composite of every configured channel
(Telegram, webhook, …). If none are configured it falls back to logging.
"""
from __future__ import annotations

from ..config import settings
from .base import CompositeNotifier, LogNotifier, Notifier
from .telegram import TelegramNotifier
from .webhook import WebhookNotifier


def get_notifier() -> Notifier:
    channels: list[Notifier] = []

    if settings.telegram_bot_token and settings.telegram_chat_id:
        channels.append(
            TelegramNotifier(settings.telegram_bot_token, settings.telegram_chat_id)
        )

    if settings.webhook_url:
        channels.append(WebhookNotifier(settings.webhook_url, settings.webhook_secret))

    if not channels:
        return LogNotifier()
    return CompositeNotifier(channels)


__all__ = ["Notifier", "get_notifier"]
