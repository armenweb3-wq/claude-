"""Strategy plug-ins.

Drop a new module here implementing ``Strategy`` and register it in
``STRATEGIES`` to make it selectable. The default is a placeholder SMA
crossover — REPLACE IT with your real edge.
"""
from __future__ import annotations

from .base import Signal, Strategy
from .confluence import ConfluenceStrategy
from .sma_crossover import SmaCrossover

STRATEGIES: dict[str, type[Strategy]] = {
    "sma_crossover": SmaCrossover,
    "confluence": ConfluenceStrategy,
}


def get_strategy(name: str = "confluence") -> Strategy:
    if name not in STRATEGIES:
        raise KeyError(f"unknown strategy {name!r}; available: {list(STRATEGIES)}")
    return STRATEGIES[name]()


__all__ = ["Signal", "Strategy", "STRATEGIES", "get_strategy"]
