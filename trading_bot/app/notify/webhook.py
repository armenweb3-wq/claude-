"""Generic webhook notifications.

POSTs a JSON payload to a configured URL — works with custom endpoints,
Slack/Discord-style incoming webhooks, n8n, Zapier, etc.

Payload:
    {"service": "crypto-trading-bot", "text": "...", "timestamp": "<ISO8601>"}

If WEBHOOK_SECRET is set, an HMAC-SHA256 signature of the raw body is sent
in the `X-Signature` header (hex), so the receiver can verify authenticity.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone

import requests

from .base import Notifier

log = logging.getLogger(__name__)


class WebhookNotifier(Notifier):
    name = "webhook"

    def __init__(self, url: str, secret: str = "") -> None:
        self._url = url
        self._secret = secret.encode() if secret else b""

    def send(self, text: str) -> None:
        payload = {
            "service": "crypto-trading-bot",
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        body = json.dumps(payload).encode()
        headers = {"Content-Type": "application/json"}
        if self._secret:
            headers["X-Signature"] = hmac.new(
                self._secret, body, hashlib.sha256
            ).hexdigest()
        requests.post(self._url, data=body, headers=headers, timeout=10)
