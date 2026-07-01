"""MetaTrader 5 broker adapter via MetaApi (https://metaapi.cloud).

Equiti (like most retail forex/CFD brokers) has no public REST API — clients
trade through MetaTrader 4/5. MetaApi is a cloud bridge that exposes any MT4/MT5
account over REST, which is the realistic way to drive an Equiti account from a
Linux web service. The user provisions their Equiti MT5 login inside MetaApi and
gives us an **auth token** + **account id**; we never see their MT5 password.

Endpoint shapes follow MetaApi's documented REST client API. Because they can't
be exercised from CI, every call goes through ``_req`` — tests inject a fake
transport, and live response shapes must be confirmed on the deploy. Parsing is
defensive (missing fields degrade rather than crash).

NOTE: this adapter is intentionally NOT an ``ExchangeAdapter`` subclass — MT5 is
lot-based (no crypto leverage/liquidation), so it exposes its own clean surface
consumed by ``saas.indices.IndicesTrader``.
"""
from __future__ import annotations

import logging
from typing import Callable

import pandas as pd

log = logging.getLogger(__name__)

# MetaApi position type -> our side label.
_SIDE = {"POSITION_TYPE_BUY": "Buy", "POSITION_TYPE_SELL": "Sell"}
# Our action -> MetaApi market order action type.
_ACTION = {"Buy": "ORDER_TYPE_BUY", "Sell": "ORDER_TYPE_SELL"}
# Our timeframe -> MetaApi timeframe code.
_TF = {"1h": "1h", "4h": "4h", "1d": "1d", "D": "1d", "1m": "1m", "5m": "5m", "15m": "15m"}


def _default_transport(base_url: str, token: str) -> Callable:
    """Real HTTP transport (requests). Returns a callable(method, path, params, json)."""
    import requests
    session = requests.Session()
    session.headers.update({"auth-token": token, "Accept": "application/json"})

    def _call(method: str, path: str, params=None, json=None):
        r = session.request(method, base_url.rstrip("/") + path,
                            params=params, json=json, timeout=20)
        r.raise_for_status()
        return r.json() if r.content else {}
    return _call


class MetaApiMT5:
    def __init__(self, token: str, account_id: str, base_url: str,
                 transport: Callable | None = None) -> None:
        self.account_id = account_id
        self._req = transport or _default_transport(base_url, token)

    @property
    def _root(self) -> str:
        return f"/users/current/accounts/{self.account_id}"

    # ── account ─────────────────────────────────────────────
    def account_info(self) -> dict:
        return self._req("GET", f"{self._root}/account-information") or {}

    def get_equity(self) -> float:
        info = self.account_info()
        # MetaApi returns equity in the account currency; fall back to balance.
        return float(info.get("equity", info.get("balance", 0)) or 0)

    # ── instruments ─────────────────────────────────────────
    def symbol_spec(self, symbol: str) -> dict:
        """Tick size/value + volume limits used to size a lot order."""
        s = self._req("GET", f"{self._root}/symbols/{symbol}/specification") or {}
        return {
            "tick_size": float(s.get("tickSize") or 0) or 0.0,
            "tick_value": float(s.get("tickValue") or 0) or 0.0,
            "min_volume": float(s.get("minVolume") or 0.01),
            "max_volume": float(s.get("maxVolume") or 100.0),
            "volume_step": float(s.get("volumeStep") or 0.01),
            "digits": int(s.get("digits") or 2),
        }

    def list_symbols(self) -> set:
        rows = self._req("GET", f"{self._root}/symbols") or []
        return {r if isinstance(r, str) else r.get("symbol") for r in rows}

    def candles(self, symbol: str, timeframe: str, limit: int = 251) -> pd.DataFrame:
        tf = _TF.get(timeframe, timeframe)
        rows = self._req("GET",
                        f"{self._root}/historical-market-data/symbols/{symbol}/timeframes/{tf}/candles",
                        params={"limit": limit}) or []
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows)
        # MetaApi candle: {time, open, high, low, close, tickVolume}.
        if "time" in df:
            df.index = pd.to_datetime(df["time"], utc=True)
        for c in ("open", "high", "low", "close"):
            if c in df:
                df[c] = df[c].astype(float)
        df["volume"] = df.get("tickVolume", 0)
        cols = [c for c in ("open", "high", "low", "close", "volume") if c in df]
        return df[cols].sort_index()

    def last_price(self, symbol: str) -> float:
        df = self.candles(symbol, "1m", limit=1)
        if df.empty:
            raise RuntimeError(f"no price data for {symbol}")
        return float(df["close"].iloc[-1])

    # ── positions ───────────────────────────────────────────
    def _norm_position(self, p: dict) -> dict:
        return {
            "id": p.get("id"),
            "symbol": p.get("symbol"),
            "side": _SIDE.get(p.get("type"), None),
            "volume": float(p.get("volume") or 0),
            "entry_price": float(p.get("openPrice") or 0),
            "stop_loss": float(p.get("stopLoss") or 0),
            "take_profit": float(p.get("takeProfit") or 0),
            "profit": float(p.get("profit") or 0),
        }

    def open_positions(self) -> list[dict]:
        rows = self._req("GET", f"{self._root}/positions") or []
        return [self._norm_position(p) for p in rows]

    def get_position(self, symbol: str) -> dict | None:
        for p in self.open_positions():
            if p["symbol"] == symbol and p["side"]:
                return p
        return None

    # ── trading ─────────────────────────────────────────────
    def market_order(self, symbol: str, side: str, volume: float,
                     stop_loss: float = 0.0, take_profit: float = 0.0) -> dict:
        body = {"actionType": _ACTION[side], "symbol": symbol, "volume": round(volume, 8)}
        if stop_loss:
            body["stopLoss"] = stop_loss
        if take_profit:
            body["takeProfit"] = take_profit
        return self._req("POST", f"{self._root}/trade", json=body) or {}

    def close_position(self, position_id: str) -> dict:
        return self._req("POST", f"{self._root}/trade",
                        json={"actionType": "POSITION_CLOSE_ID", "positionId": position_id}) or {}

    def close_symbol(self, symbol: str) -> dict | None:
        p = self.get_position(symbol)
        if not p or not p.get("id"):
            return None
        return self.close_position(p["id"])

    def modify_stop(self, position_id: str, stop_loss: float) -> dict:
        return self._req("POST", f"{self._root}/trade",
                        json={"actionType": "POSITION_MODIFY", "positionId": position_id,
                              "stopLoss": stop_loss}) or {}

    def diagnostic(self, symbol: str) -> dict:
        """Raw MetaApi payloads (un-normalised) for one symbol — so the exact
        live field names can be confirmed and the adapter locked to them."""
        out: dict = {}

        def _try(name, fn):
            try:
                out[name] = fn()
            except Exception as exc:
                out[name] = {"_error": str(exc)[:300]}

        _try("account_information", lambda: self._req("GET", f"{self._root}/account-information"))
        _try("symbol_specification",
             lambda: self._req("GET", f"{self._root}/symbols/{symbol}/specification"))
        _try("positions", lambda: self._req("GET", f"{self._root}/positions"))
        _try("candles_sample", lambda: self._req(
            "GET", f"{self._root}/historical-market-data/symbols/{symbol}/timeframes/1h/candles",
            params={"limit": 2}))
        return out

    def closed_deals(self, start_iso: str, end_iso: str) -> list[dict]:
        rows = self._req("GET", f"{self._root}/history-deals/time/{start_iso}/{end_iso}") or []
        out = []
        for d in rows:
            if d.get("entryType") and d["entryType"] != "DEAL_ENTRY_OUT":
                continue  # only count closing deals as realised P&L
            out.append({"symbol": d.get("symbol"), "profit": float(d.get("profit") or 0),
                        "closed_at": d.get("time"), "volume": float(d.get("volume") or 0)})
        return out
