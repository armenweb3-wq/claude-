"""Notifier tests (no real network — requests is monkeypatched)."""
from __future__ import annotations

import hashlib
import hmac
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.notify.base import CompositeNotifier, Notifier  # noqa: E402
from app.notify import webhook as webhook_mod  # noqa: E402
from app.notify.webhook import WebhookNotifier  # noqa: E402


class _Capture:
    def __init__(self):
        self.calls = []

    def post(self, url, data=None, headers=None, timeout=None, **kw):
        self.calls.append({"url": url, "data": data, "headers": headers})


def test_webhook_posts_signed_payload(monkeypatch):
    cap = _Capture()
    monkeypatch.setattr(webhook_mod, "requests", cap)

    WebhookNotifier("https://example.com/hook", secret="topsecret").send("hello")

    assert len(cap.calls) == 1
    call = cap.calls[0]
    assert call["url"] == "https://example.com/hook"
    body = call["data"]
    payload = json.loads(body)
    assert payload["text"] == "hello"
    assert payload["service"] == "crypto-trading-bot"
    expected = hmac.new(b"topsecret", body, hashlib.sha256).hexdigest()
    assert call["headers"]["X-Signature"] == expected


def test_webhook_no_signature_without_secret(monkeypatch):
    cap = _Capture()
    monkeypatch.setattr(webhook_mod, "requests", cap)
    WebhookNotifier("https://example.com/hook").send("hi")
    assert "X-Signature" not in cap.calls[0]["headers"]


def test_composite_isolates_failures():
    sent = []

    class Boom(Notifier):
        name = "boom"
        def send(self, text):
            raise RuntimeError("down")

    class Ok(Notifier):
        name = "ok"
        def send(self, text):
            sent.append(text)

    CompositeNotifier([Boom(), Ok()]).send("msg")
    assert sent == ["msg"]  # Ok still received it despite Boom failing
