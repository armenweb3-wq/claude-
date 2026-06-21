"""Data providers for the memecoins strategy (the "senses").

These wrap the external feeds the brain needs. They're abstract so the real
implementations (GMGN, Helius/Bitquery on-chain, DexScreener/Birdeye, X/Telegram
scrapers, pump.fun new-mint stream) can be dropped in behind the same interface
once API keys exist — and so the engine is testable with fakes.

A ``Candidate`` bundles everything the brain needs about one token.
"""
from __future__ import annotations

from dataclasses import dataclass

from .memestrategy import TokenMetrics, TokenSafety


@dataclass
class Candidate:
    mint: str
    symbol: str
    safety: TokenSafety
    metrics: TokenMetrics
    price_sol: float = 0.0   # current price, SOL per token


class MemeDataProvider:
    """One provider surface the engine talks to. Real impls override these."""

    def discover(self, limit: int = 20) -> list[Candidate]:
        """New pump.fun mints + trending tokens, pre-enriched with safety+metrics."""
        return []

    def price(self, mint: str) -> float:
        """Current price (SOL per token) for an open position."""
        return 0.0


class StubProvider(MemeDataProvider):
    """No-op provider — the engine runs end-to-end but finds nothing. Lets us
    ship safely (auto-trading does nothing) until a real provider is wired."""

    def discover(self, limit: int = 20) -> list[Candidate]:
        return []

    def price(self, mint: str) -> float:
        return 0.0
