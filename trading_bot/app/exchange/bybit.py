"""Live Bybit exchange adapter (pybit v5 unified trading).

Only instantiated when ``settings.is_live`` is True. Every order placement
is logged before it is sent.
"""
from __future__ import annotations

import logging

import pandas as pd
from pybit.unified_trading import HTTP

from ..config import settings
from .base import ExchangeAdapter, Order, Position

log = logging.getLogger(__name__)


class BybitExchange(ExchangeAdapter):
    name = "bybit"

    def __init__(self) -> None:
        if not settings.is_live:
            raise RuntimeError("BybitExchange requires TRADING_MODE=live and API keys.")
        self._client = HTTP(
            testnet=settings.bybit_testnet,
            api_key=settings.bybit_api_key,
            api_secret=settings.bybit_api_secret,
        )
        self._category = settings.bybit_category
        log.warning("Bybit LIVE client initialised — %s", settings.safety_summary())

    def get_klines(self, symbol: str, interval: str, limit: int = 200) -> pd.DataFrame:
        resp = self._client.get_kline(
            category=self._category, symbol=symbol, interval=interval, limit=limit
        )
        rows = list(reversed(resp.get("result", {}).get("list", [])))
        df = pd.DataFrame(
            rows, columns=["start", "open", "high", "low", "close", "volume", "turnover"]
        )
        if df.empty:
            return df
        df["start"] = pd.to_datetime(df["start"].astype("int64"), unit="ms", utc=True)
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype(float)
        return df.set_index("start")[["open", "high", "low", "close", "volume"]]

    def get_equity(self) -> float:
        resp = self._client.get_wallet_balance(accountType="UNIFIED")
        accounts = resp.get("result", {}).get("list", [])
        if not accounts:
            return 0.0
        return float(accounts[0].get("totalEquity") or 0.0)

    def get_position(self, symbol: str) -> Position:
        resp = self._client.get_positions(category=self._category, symbol=symbol)
        items = resp.get("result", {}).get("list", [])
        for item in items:
            size = float(item.get("size") or 0.0)
            if size > 0:
                return Position(
                    symbol=symbol,
                    side=item.get("side"),
                    size=size,
                    entry_price=float(item.get("avgPrice") or 0.0),
                    unrealised_pnl=float(item.get("unrealisedPnl") or 0.0),
                )
        return Position(symbol, None, 0.0, 0.0)

    def place_order(self, order: Order) -> Order:
        log.warning(
            "[LIVE] placing %s %s qty=%s price=%s reduce_only=%s",
            order.side, order.symbol, order.qty, order.price, order.reduce_only,
        )
        resp = self._client.place_order(
            category=self._category,
            symbol=order.symbol,
            side=order.side,
            orderType="Limit" if order.price else "Market",
            qty=str(order.qty),
            price=str(order.price) if order.price else None,
            reduceOnly=order.reduce_only,
        )
        order.order_id = resp.get("result", {}).get("orderId")
        order.status = "submitted"
        return order

    def close_position(self, symbol: str) -> Order | None:
        pos = self.get_position(symbol)
        if not pos.side:
            return None
        opposite = "Sell" if pos.side == "Buy" else "Buy"
        return self.place_order(
            Order(symbol=symbol, side=opposite, qty=pos.size, reduce_only=True)
        )
