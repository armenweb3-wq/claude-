"""Live Bybit exchange adapter (pybit v5 unified trading).

Only instantiated when ``settings.is_live`` is True. Every order placement
is logged before it is sent.
"""
from __future__ import annotations

import logging

import pandas as pd
from pybit.unified_trading import HTTP

from ..config import settings
from .base import (
    ExchangeAdapter,
    ExecutionResult,
    InstrumentRules,
    Order,
    Position,
    round_step,
)

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
        self._rules_cache: dict[str, InstrumentRules] = {}
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
                    stop_loss=float(item.get("stopLoss") or 0.0),
                    leverage=float(item.get("leverage") or 0.0),
                )
        return Position(symbol, None, 0.0, 0.0)

    def set_stop_loss(self, symbol: str, stop_price: float) -> None:
        log.warning("[LIVE] move stop %s -> %s", symbol, stop_price)
        try:
            self._client.set_trading_stop(
                category=self._category, symbol=symbol,
                stopLoss=str(round(stop_price, 6)), slTriggerBy="LastPrice",
                positionIdx=0,
            )
        except Exception as exc:  # pragma: no cover - benign "not modified" codes
            if not any(c in str(exc) for c in ("34040", "110043", "not modified")):
                raise

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

    def available_symbols(self) -> set[str]:
        resp = self._client.get_instruments_info(category=self._category, limit=1000)
        return {i["symbol"] for i in resp.get("result", {}).get("list", [])}

    # ── execution surface ───────────────────────────────────
    def instrument_rules(self, symbol: str) -> InstrumentRules:
        if symbol in self._rules_cache:
            return self._rules_cache[symbol]
        resp = self._client.get_instruments_info(category=self._category, symbol=symbol)
        item = resp["result"]["list"][0]
        lot = item["lotSizeFilter"]
        rules = InstrumentRules(
            min_qty=float(lot.get("minOrderQty") or 0),
            qty_step=float(lot.get("qtyStep") or 0),
            min_notional=float(lot.get("minNotionalValue") or 0),
        )
        self._rules_cache[symbol] = rules
        return rules

    def set_leverage(self, symbol: str, leverage: float) -> None:
        lev = str(int(leverage))
        try:
            self._client.set_leverage(
                category=self._category, symbol=symbol,
                buyLeverage=lev, sellLeverage=lev,
            )
        except Exception as exc:  # pragma: no cover - Bybit errors if unchanged
            # "leverage not modified" (110043) is benign.
            if "110043" not in str(exc):
                raise

    def open_position(self, symbol, side, qty, leverage, stop_loss, take_profits):
        rules = self.instrument_rules(symbol)
        qty = round_step(qty, rules.qty_step)
        price = self.last_price(symbol)
        if qty <= 0 or qty < rules.min_qty or qty * price < rules.min_notional:
            return ExecutionResult(
                False,
                skipped_reason=(
                    f"qty {qty} below exchange minimum "
                    f"(min_qty={rules.min_qty}, min_notional={rules.min_notional})"
                ),
            )

        self.set_leverage(symbol, leverage)

        # Market entry with the stop loss attached on the exchange.
        log.warning("[LIVE] open %s %s qty=%s lev=%sx SL=%s", side, symbol, qty, leverage, stop_loss)
        entry = self._client.place_order(
            category=self._category, symbol=symbol, side=side,
            orderType="Market", qty=str(qty),
            stopLoss=str(round(stop_loss, 6)), slTriggerBy="LastPrice",
        )
        entry_id = entry.get("result", {}).get("orderId")

        # Reduce-only TP ladder.
        close_side = "Sell" if side == "Buy" else "Buy"
        for tp in take_profits:
            tp_qty = round_step(qty * tp.close_fraction, rules.qty_step)
            if tp_qty <= 0:
                continue
            try:
                self._client.place_order(
                    category=self._category, symbol=symbol, side=close_side,
                    orderType="Limit", qty=str(tp_qty), price=str(round(tp.price, 6)),
                    reduceOnly=True, timeInForce="GTC",
                )
            except Exception as exc:  # pragma: no cover - best effort per rung
                log.warning("TP order failed for %s @ %s: %s", symbol, tp.price, exc)

        return ExecutionResult(ok=True, entry_order_id=entry_id, qty=qty, leverage=leverage)
