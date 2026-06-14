"""Notifier interface and a composite that fans out to many channels."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

log = logging.getLogger(__name__)


class Notifier(ABC):
    name: str = "base"

    @abstractmethod
    def send(self, text: str) -> None:
        ...


class CompositeNotifier(Notifier):
    """Sends each message to every configured channel; one failure never
    blocks the others."""

    name = "composite"

    def __init__(self, channels: list[Notifier]) -> None:
        self._channels = channels

    def send(self, text: str) -> None:
        for ch in self._channels:
            try:
                ch.send(text)
            except Exception as exc:  # pragma: no cover - best effort
                log.warning("notifier %s failed: %s", ch.name, exc)


class LogNotifier(Notifier):
    """Fallback used when nothing else is configured."""

    name = "log"

    def send(self, text: str) -> None:
        log.info("[notify] %s", text)
