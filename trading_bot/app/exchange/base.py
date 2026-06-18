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
    stop_loss: float = 0.0  # current protective stop on the exchange (0 = none)
    leverage: float = 0.0   # position leverage (0 = unknown)
    created_at: str = ""    # ISO time the position opened (for counting TP fills)


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

    def get_open_positions(self) -> list["Position"]:
        """All currently-open positions. Default empty; live/paper override."""
        return []

    @abstractmethod
    def place_order(self, order: Order) -> Order:
        ...

    @abstractmethod
    def close_position(self, symbol: str) -> Order | None:
        ...

    @abstractmethod
    def instrument_rules(self, symbol: str) -> InstrumentRules:
        """Min order qty, lot step, and min notional for a symbol."""

    def max_leverage(self, symbol: str) -> float:
        """Exchange-allowed max leverage for a symbol (0 = unknown)."""
        return 0.0

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

    def available_symbols(self) -> set[str]:
        """Set of valid symbols for the configured category.

        Default empty set means "unknown — skip validation". Adapters that
        can list instruments override this so the bot can drop bad symbols.
        """
        return set()

    def closed_pnl(self, limit: int = 50) -> list[dict]:
        """Recent *closed* trades with realised PnL, newest first.

        Each item: ``{symbol, side, qty, entry_price, exit_price, pnl,
        pnl_pct, closed_at}``. Default empty — adapters that can report
        realised PnL (live exchange, paper sim) override this.
        """
        return []

    def last_price(self, symbol: str) -> float:
        df = self.get_klines(symbol, "60", limit=1)
        if df.empty:
            raise RuntimeError(f"no price data for {symbol}")
        return float(df["close"].iloc[-1])

    def set_stop_loss(self, symbol: str, stop_price: float) -> None:
        """Move the protective stop for an open position. No-op by default;
        live adapters override this to update the exchange-side stop."""
        return None
