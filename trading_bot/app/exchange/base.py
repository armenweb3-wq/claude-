"""Exchange adapter interface and shared data types."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

import pandas as pd

Side = Literal["Buy", "Sell"]


@dataclass
class Order:
    symbol: str
    side: Side
    qty: float
    price: float | None = None  # None => market order
    order_id: str | None = None
    status: str = "new"
    reduce_only: bool = False


@dataclass
class Position:
    symbol: str
    side: Side | None
    size: float
    entry_price: float
    unrealised_pnl: float = 0.0


class ExchangeAdapter(ABC):
    """Minimal surface the bot needs from any exchange."""

    name: str = "base"

    @abstractmethod
    def get_klines(self, symbol: str, interval: str, limit: int = 200) -> pd.DataFrame:
        """Return OHLCV as a DataFrame indexed by open time (UTC).

        Columns: open, high, low, close, volume.
        """

    @abstractmethod
    def get_equity(self) -> float:
        """Total account equity in quote currency (USDT)."""

    @abstractmethod
    def get_position(self, symbol: str) -> Position:
        ...

    @abstractmethod
    def place_order(self, order: Order) -> Order:
        ...

    @abstractmethod
    def close_position(self, symbol: str) -> Order | None:
        ...
