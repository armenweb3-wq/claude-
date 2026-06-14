"""Strategy interface."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

import pandas as pd

Action = Literal["long", "short", "close", "hold"]


@dataclass
class Signal:
    action: Action
    reason: str = ""
    # Optional strategy-supplied levels; risk manager may override.
    stop_loss: float | None = None
    take_profit: float | None = None


class Strategy(ABC):
    name: str = "base"

    @abstractmethod
    def generate(self, df: pd.DataFrame) -> Signal:
        """Given OHLCV history (chronological), return a trading signal."""
