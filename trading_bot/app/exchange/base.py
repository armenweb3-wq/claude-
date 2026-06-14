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


@dataclass
class InstrumentRules:
    """Exchange constraints needed to size a valid order."""
    min_qty: float
    qty_step: float
    min_notional: float = 0.0


@dataclass
class ExecutionResult:
    ok: bool
    skipped_reason: str = ""
    entry_order_id: str | None = None
    qty: float = 0.0
    leverage: float = 1.0


def round_step(qty: float, step: float) -> float:
    """Round a quantity DOWN to the exchange's lot step."""
    if step <= 0:
        return qty
    return (int(qty / step)) * step


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

    @abstractmethod
    def instrument_rules(self, symbol: str) -> InstrumentRules:
        """Min order qty, lot step, and min notional for a symbol."""

    @abstractmethod
    def set_leverage(self, symbol: str, leverage: float) -> None:
        ...

    @abstractmethod
    def open_position(
        self,
        symbol: str,
        side: Side,
        qty: float,
        leverage: float,
        stop_loss: float,
        take_profits: list,  # list[TakeProfit] with .price/.close_fraction
    ) -> ExecutionResult:
        """Set leverage, place the market entry, attach an exchange-side stop
        loss, and place reduce-only take-profit ladder orders. The stop must
        live on the exchange so the position is protected if the bot dies."""

    def last_price(self, symbol: str) -> float:
        df = self.get_klines(symbol, "60", limit=1)
        if df.empty:
            raise RuntimeError(f"no price data for {symbol}")
        return float(df["close"].iloc[-1])
