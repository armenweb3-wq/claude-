"""Exchange adapters.

``get_exchange()`` returns the appropriate adapter for the current mode:
a real Bybit client when live trading is enabled, otherwise a paper adapter
that simulates fills and never touches the network for order placement.
"""
from __future__ import annotations

from ..config import settings
from .base import ExchangeAdapter
from .paper import PaperExchange


def get_exchange() -> ExchangeAdapter:
    if settings.is_live:
        # Imported lazily so the bot runs without pybit installed in dry-run.
        from .bybit import BybitExchange

        return BybitExchange()
    return PaperExchange()


__all__ = ["ExchangeAdapter", "PaperExchange", "get_exchange"]
