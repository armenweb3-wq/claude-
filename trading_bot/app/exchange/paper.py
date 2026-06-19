"""Paper (simulated) exchange.

Fetches *real* market data from Bybit's public endpoints (no auth needed)
so signals are realistic, but simulates order fills locally. This is the
default whenever live trading is not explicitly enabled.
"""
from __future__ import annotations

import logging
import time

import pandas as pd
import requests

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

_PUBLIC_BASE = "https://api-testnet.bybit.com" if settings.bybit_testnet else "https://api.bybit.com"


class PaperExchange(ExchangeAdapter):
    name = "paper"

    def __init__(self, starting_equity: float = 10_000.0) -> None:
        self._equity = starting_equity
        self._positions: dict[str, Position] = {}
        self._closed: list[dict] = []
        self._order_seq = 0

    def get_klines(self, symbol: str, interval: str, limit: int = 200) -> pd.DataFrame:
        resp = requests.get(
            f"{_PUBLIC_BASE}/v5/market/kline",
            params={
                "category": settings.bybit_category,
                "symbol": symbol,
                "interval": interval,
                "limit": limit,
            },
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json().get("result", {}).get("list", [])
        # Bybit returns newest-first; reverse to chronological.
        rows = list(reversed(rows))
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
        return self._equity

    def get_position(self, symbol: str) -> Position:
        return self._positions.get(symbol, Position(symbol, None, 0.0, 0.0))

    def get_open_positions(self) -> list[Position]:
        return [p for p in self._positions.values() if p.side]

    def place_order(self, order: Order) -> Order:
        self._order_seq += 1
        order.order_id = f"paper-{self._order_seq}"
        order.status = "filled"
        fill_price = order.price or self._last_price(order.symbol)
        existing = self._positions.get(order.symbol)
        if order.reduce_only or (existing and existing.side and existing.side != order.side):
            if existing and existing.side:
                self._record_close(existing, fill_price)
            self._positions.pop(order.symbol, None)
        else:
            self._positions[order.symbol] = Position(
                symbol=order.symbol, side=order.side, size=order.qty, entry_price=fill_price
            )
        log.info("[PAPER] filled %s %s qty=%s @ %s", order.side, order.symbol, order.qty, fill_price)
        return order

    def _record_close(self, pos: Position, exit_price: float) -> None:
        from datetime import datetime, timezone

        is_long = pos.side == "Buy"
        sign = 1 if is_long else -1
        pnl = (exit_price - pos.entry_price) * pos.size * sign
        pct = ((exit_price - pos.entry_price) / pos.entry_price * 100 * sign) if pos.entry_price else 0.0
        self._equity += pnl
        self._closed.append({
            "symbol": pos.symbol, "side": pos.side, "qty": pos.size,
            "entry_price": pos.entry_price, "exit_price": exit_price,
            "pnl": round(pnl, 4), "pnl_pct": round(pct, 2),
            "closed_at": datetime.now(timezone.utc).isoformat(),
        })

    def closed_pnl(self, limit: int = 50, start_ms: int | None = None) -> list[dict]:
        rows = list(reversed(self._closed))
        if start_ms is not None:
            import datetime as _dt
            cutoff = _dt.datetime.fromtimestamp(start_ms / 1000, tz=_dt.timezone.utc).isoformat()
            rows = [r for r in rows if (r.get("closed_at") or "") >= cutoff]
        return rows[:limit]

    def close_position(self, symbol: str) -> Order | None:
        pos = self._positions.get(symbol)
        if not pos or not pos.side:
            return None
        opposite = "Sell" if pos.side == "Buy" else "Buy"
        return self.place_order(
            Order(symbol=symbol, side=opposite, qty=pos.size, reduce_only=True)
        )

    def _last_price(self, symbol: str) -> float:
        df = self.get_klines(symbol, settings.timeframe, limit=1)
        if df.empty:
            raise RuntimeError(f"no price data for {symbol}")
        return float(df["close"].iloc[-1])

    def available_symbols(self) -> set[str]:
        resp = requests.get(
            f"{_PUBLIC_BASE}/v5/market/instruments-info",
            params={"category": settings.bybit_category, "limit": 1000},
            timeout=10,
        )
        resp.raise_for_status()
        return {i["symbol"] for i in resp.json().get("result", {}).get("list", [])}

    # ── execution surface ───────────────────────────────────
    def instrument_rules(self, symbol: str) -> InstrumentRules:
        # Generous defaults for simulation; the live adapter reads the real ones.
        return InstrumentRules(min_qty=0.0, qty_step=0.0, min_notional=0.0)

    def max_leverage(self, symbol: str) -> float:
        return 100.0

    def set_leverage(self, symbol: str, leverage: float) -> None:
        log.info("[PAPER] set leverage %s = %sx", symbol, leverage)

    def open_position(self, symbol, side, qty, leverage, stop_loss, take_profits):
        rules = self.instrument_rules(symbol)
        qty = round_step(qty, rules.qty_step)
        if qty <= 0 or qty < rules.min_qty:
            return ExecutionResult(False, skipped_reason="qty below minimum")
        self.set_leverage(symbol, leverage)
        order = self.place_order(Order(symbol=symbol, side=side, qty=qty))
        log.info(
            "[PAPER] opened %s %s qty=%s lev=%sx SL=%s TPs=%s",
            side, symbol, qty, leverage, stop_loss,
            [round(tp.price, 6) for tp in take_profits],
        )
        return ExecutionResult(
            ok=True, entry_order_id=order.order_id, qty=qty, leverage=leverage
        )
