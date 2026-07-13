"""Strategy interface and signal types."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal

import pandas as pd

Action = Literal["long", "short", "close", "hold"]


@dataclass
class TakeProfit:
    """One rung of the take-profit ladder."""
    pct: float            # distance from entry, in percent (e.g. 6.0)
    close_fraction: float  # fraction of the position to close here (0..1)
    price: float | None = None  # absolute price, filled in when a plan is built


@dataclass
class Signal:
    action: Action
    reason: str = ""
    confidence: float = 0.0           # 0..1 confluence score (win-prob proxy)
    entry: float | None = None
    stop_loss: float | None = None
    take_profits: list[TakeProfit] = field(default_factory=list)
    leverage: float = 1.0
    risk_reward: float | None = None  # blended reward:risk ratio

    # Backwards-compatible single-target accessor.
    @property
    def take_profit(self) -> float | None:
        return self.take_profits[0].price if self.take_profits else None


class Strategy(ABC):
    name: str = "base"

    @abstractmethod
    def generate(self, df: pd.DataFrame) -> Signal:
        """Given OHLCV history (chronological), return a trading signal."""
