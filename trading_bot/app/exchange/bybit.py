"""Live Bybit exchange adapter (pybit v5 unified trading).

Only instantiated when ``settings.is_live`` is True. Every order placement
is logged before it is sent.
"""
from __future__ import annotations

import logging
import threading
import time

import pandas as pd
from pybit.unified_trading import HTTP

from ..config import settings

# Process-wide cache of public market data, shared across every user's adapter
# instance — klines/instruments are identical for everyone, so one fetch serves
# all. This is what keeps us under Bybit's rate limit at scale.
_MARKET_CACHE: dict = {}
_MARKET_LOCK = threading.Lock()


def _cache_get(key, ttl: float):
    with _MARKET_LOCK:
        hit = _MARKET_CACHE.get(key)
    if hit and (time.time() - hit[0]) < ttl:
        return hit[1]
    return None


def _cache_put(key, value) -> None:
    with _MARKET_LOCK:
        _MARKET_CACHE[key] = (time.time(), value)
from .base import (
    ExchangeAdapter,
    ExecutionResult,
    InstrumentRules,
    Order,
    Position,
    round_price,
    round_step,
)

log = logging.getLogger(__name__)


class BybitExchange(ExchangeAdapter):
    name = "bybit"

    def __init__(self, api_key: str | None = None, api_secret: str | None = None,
                 testnet: bool | None = None, category: str | None = None) -> None:
        # No explicit keys → use the single-user bot's global config (requires live).
        if api_key is None:
            if not settings.is_live:
                raise RuntimeError("BybitExchange requires TRADING_MODE=live and API keys.")
            api_key, api_secret = settings.bybit_api_key, settings.bybit_api_secret
            log.warning("Bybit LIVE client initialised — %s", settings.safety_summary())
        self._client = HTTP(
            testnet=settings.bybit_testnet if testnet is None else testnet,
            api_key=api_key,
            api_secret=api_secret,
        )
        self._category = category or settings.bybit_category
        self._rules_cache: dict[str, InstrumentRules] = {}

    def get_klines(self, symbol: str, interval: str, limit: int = 200) -> pd.DataFrame:
        key = ("kline", self._category, symbol, interval, limit)
        cached = _cache_get(key, settings.market_cache_seconds)
        if cached is not None:
            return cached.copy()
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
        out = df.set_index("start")[["open", "high", "low", "close", "volume"]]
        _cache_put(key, out)
        return out.copy()

    def get_equity(self) -> float:
        resp = self._client.get_wallet_balance(accountType="UNIFIED")
        accounts = resp.get("result", {}).get("list", [])
        if not accounts:
            return 0.0
        return float(accounts[0].get("totalEquity") or 0.0)

    def get_position(self, symbol: str) -> Position:
        from datetime import datetime, timezone

        resp = self._client.get_positions(category=self._category, symbol=symbol)
        items = resp.get("result", {}).get("list", [])
        for item in items:
            size = float(item.get("size") or 0.0)
            if size > 0:
                ct = item.get("createdTime")
                created = (datetime.fromtimestamp(int(ct) / 1000, tz=timezone.utc).isoformat()
                           if ct else "")
                return Position(
                    symbol=symbol,
                    side=item.get("side"),
                    size=size,
                    entry_price=float(item.get("avgPrice") or 0.0),
                    unrealised_pnl=float(item.get("unrealisedPnl") or 0.0),
                    stop_loss=float(item.get("stopLoss") or 0.0),
                    leverage=float(item.get("leverage") or 0.0),
                    created_at=created,
                )
        return Position(symbol, None, 0.0, 0.0)

    def get_open_positions(self) -> list[Position]:
        """All open positions in one call (efficient for dashboards)."""
        from datetime import datetime, timezone

        resp = self._client.get_positions(category=self._category, settleCoin="USDT")
        out: list[Position] = []
        for item in resp.get("result", {}).get("list", []):
            size = float(item.get("size") or 0.0)
            if size > 0:
                ct = item.get("createdTime")
                created = (datetime.fromtimestamp(int(ct) / 1000, tz=timezone.utc).isoformat()
                           if ct else "")
                out.append(Position(
                    symbol=item.get("symbol"), side=item.get("side"), size=size,
                    entry_price=float(item.get("avgPrice") or 0.0),
                    unrealised_pnl=float(item.get("unrealisedPnl") or 0.0),
                    stop_loss=float(item.get("stopLoss") or 0.0),
                    leverage=float(item.get("leverage") or 0.0),
                    created_at=created,
                ))
        return out

    def set_stop_loss(self, symbol: str, stop_price: float) -> None:
        tick = self.instrument_rules(symbol).tick_size
        stop_price = round_price(stop_price, tick)
        log.warning("[LIVE] move stop %s -> %s", symbol, stop_price)
        try:
            self._client.set_trading_stop(
                category=self._category, symbol=symbol,
                stopLoss=str(stop_price), slTriggerBy="LastPrice",
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
        key = ("avail", self._category)
        cached = _cache_get(key, 3600)  # the tradable list barely changes
        if cached is not None:
            return cached
        resp = self._client.get_instruments_info(category=self._category, limit=1000)
        syms = {i["symbol"] for i in resp.get("result", {}).get("list", [])}
        _cache_put(key, syms)
        return syms

    def closed_pnl(self, limit: int = 50) -> list[dict]:
        from datetime import datetime, timezone

        resp = self._client.get_closed_pnl(category=self._category, limit=min(limit, 100))
        out: list[dict] = []
        for item in resp.get("result", {}).get("list", []):
            try:
                entry = float(item.get("avgEntryPrice") or 0.0)
                exit_ = float(item.get("avgExitPrice") or 0.0)
                qty = float(item.get("qty") or item.get("closedSize") or 0.0)
                pnl = float(item.get("closedPnl") or 0.0)
                lev = float(item.get("leverage") or 0.0)
                # Direction from the explicit closing-order side (deterministic):
                # a long is closed by a Sell, a short by a Buy. The price-vs-PnL
                # heuristic flips on tiny fee-eaten winners, so only use it as a
                # last resort when the side field is missing.
                side_field = item.get("side")
                if side_field in ("Buy", "Sell"):
                    is_long = (side_field == "Sell")
                elif entry and exit_ and pnl:
                    is_long = (exit_ > entry) == (pnl > 0)
                else:
                    is_long = False
                margin = (entry * qty / lev) if (lev and entry and qty) else (entry * qty)
                pnl_pct = round(pnl / margin * 100, 2) if margin else 0.0
                ts = item.get("updatedTime") or item.get("createdTime")
                closed_at = (
                    datetime.fromtimestamp(int(ts) / 1000, tz=timezone.utc).isoformat()
                    if ts else None
                )
                out.append({
                    "symbol": item.get("symbol"),
                    "id": item.get("orderId"),
                    "side": "Buy" if is_long else "Sell",
                    "qty": qty,
                    "entry_price": entry,
                    "exit_price": exit_,
                    "pnl": round(pnl, 4),
                    "pnl_pct": pnl_pct,
                    "closed_at": closed_at,
                })
            except Exception as exc:  # one bad row must not drop the whole list
                log.warning("closed_pnl parse failed: %s", exc)
        return out

    # ── execution surface ───────────────────────────────────
    def instrument_rules(self, symbol: str) -> InstrumentRules:
        if symbol in self._rules_cache:
            return self._rules_cache[symbol]
        resp = self._client.get_instruments_info(category=self._category, symbol=symbol)
        item = resp["result"]["list"][0]
        lot = item["lotSizeFilter"]
        price_f = item.get("priceFilter", {})
        rules = InstrumentRules(
            min_qty=float(lot.get("minOrderQty") or 0),
            qty_step=float(lot.get("qtyStep") or 0),
            min_notional=float(lot.get("minNotionalValue") or 0),
            tick_size=float(price_f.get("tickSize") or 0),
        )
        self._rules_cache[symbol] = rules
        return rules

    def max_leverage(self, symbol: str) -> float:
        key = ("maxlev", self._category, symbol)
        cached = _cache_get(key, 3600)  # instrument specs rarely change
        if cached is not None:
            return cached
        resp = self._client.get_instruments_info(category=self._category, symbol=symbol)
        item = resp["result"]["list"][0]
        val = float(item.get("leverageFilter", {}).get("maxLeverage") or 0.0)
        _cache_put(key, val)
        return val

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

        # Market entry with the stop loss attached on the exchange (rounded to tick).
        sl_price = round_price(stop_loss, rules.tick_size)
        log.warning("[LIVE] open %s %s qty=%s lev=%sx SL=%s", side, symbol, qty, leverage, sl_price)
        entry = self._client.place_order(
            category=self._category, symbol=symbol, side=side,
            orderType="Market", qty=str(qty),
            stopLoss=str(sl_price), slTriggerBy="LastPrice",
        )
        entry_id = entry.get("result", {}).get("orderId")

        # CRITICAL: confirm a protective stop actually exists on the exchange.
        # If the attached SL was rejected (e.g. price/tick issue) the position
        # would be live and UNPROTECTED, so re-read and set it explicitly.
        # A market fill isn't always reflected immediately, so poll a few times
        # before concluding the position isn't there.
        warning = ""
        try:
            pos = None
            for _ in range(4):
                pos = self.get_position(symbol)
                if pos.side:
                    break
                time.sleep(0.6)
            if not pos or not pos.side:
                warning = "could not confirm the position/stop after entry — check the exchange"
                log.error("[LIVE] %s entry placed but position not confirmed", symbol)
            elif pos.stop_loss <= 0:
                self.set_stop_loss(symbol, stop_loss)
                pos = self.get_position(symbol)
                if pos.stop_loss <= 0:
                    warning = "stop-loss could not be confirmed on the exchange"
                    log.error("[LIVE] %s opened WITHOUT a confirmed stop-loss", symbol)
        except Exception as exc:  # pragma: no cover
            warning = f"stop-loss not verified: {exc}"
            log.warning("SL verify failed for %s: %s", symbol, exc)

        # Reduce-only TP ladder (prices rounded to tick).
        close_side = "Sell" if side == "Buy" else "Buy"
        for tp in take_profits:
            tp_qty = round_step(qty * tp.close_fraction, rules.qty_step)
            if tp_qty <= 0:
                continue
            try:
                self._client.place_order(
                    category=self._category, symbol=symbol, side=close_side,
                    orderType="Limit", qty=str(tp_qty),
                    price=str(round_price(tp.price, rules.tick_size)),
                    reduceOnly=True, timeInForce="GTC",
                )
            except Exception as exc:  # pragma: no cover - best effort per rung
                log.warning("TP order failed for %s @ %s: %s", symbol, tp.price, exc)

        return ExecutionResult(ok=True, entry_order_id=entry_id, qty=qty,
                               leverage=leverage, warning=warning)
