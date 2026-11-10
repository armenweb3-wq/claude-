"""Thin wrapper around the official ``MetaTrader5`` Python package.

Every method returns plain dicts / lists so the rest of the program is
independent from the package's named tuples. This module is only ever imported
inside a worker subprocess - never in the main (web) process.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEAL_FIELDS = (
    "ticket", "order", "time", "time_msc", "type", "entry", "magic",
    "position_id", "reason", "volume", "price", "commission", "swap",
    "profit", "fee", "symbol", "comment", "external_id",
)
POSITION_FIELDS = (
    "ticket", "time", "time_msc", "time_update", "type", "magic", "identifier",
    "reason", "volume", "price_open", "sl", "tp", "price_current", "swap",
    "profit", "symbol", "comment", "external_id",
)
ACCOUNT_FIELDS = (
    "login", "trade_mode", "leverage", "limit_orders", "margin_so_mode",
    "trade_allowed", "trade_expert", "margin_mode", "currency_digits",
    "fifo_close", "balance", "credit", "profit", "equity", "margin",
    "margin_free", "margin_level", "margin_so_call", "margin_so_so",
    "margin_initial", "margin_maintenance", "assets", "liabilities",
    "commission_blocked", "name", "server", "currency", "company",
)
TERMINAL_FIELDS = (
    "community_account", "community_connection", "connected", "dlls_allowed",
    "trade_allowed", "tradeapi_disabled", "email_enabled", "ftp_enabled",
    "notifications_enabled", "mqid", "build", "maxbars", "codepage",
    "ping_last", "community_balance", "retransmission", "company", "name",
    "language", "path", "data_path", "commondata_path",
)


def _pick(obj: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    if obj is None:
        return {}
    if hasattr(obj, "_asdict"):
        src = obj._asdict()
    elif isinstance(obj, dict):
        src = obj
    else:
        src = {f: getattr(obj, f, None) for f in fields}
    return {f: src.get(f) for f in fields if f in src}


class MT5Error(Exception):
    pass


class MT5Adapter:
    """Connects a single Python process to a single MT5 terminal."""

    def __init__(self, cfg: dict[str, Any]):
        self.cfg = cfg
        try:
            import MetaTrader5 as mt5  # type: ignore
        except ImportError as exc:  # pragma: no cover - windows only
            raise MT5Error(
                "The 'MetaTrader5' Python package is not installed or this is not "
                "Windows. Run the launcher again to install dependencies, or enable "
                "mock mode for a demo."
            ) from exc
        self.mt5 = mt5
        self.connected = False

    # ------------------------------------------------------------------ #
    def last_error(self) -> str:
        try:
            code, desc = self.mt5.last_error()
            return f"{desc} (code {code})"
        except Exception:  # pragma: no cover
            return "unknown error"

    def connect(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {"timeout": int(self.cfg.get("timeout_ms") or 60000)}
        if self.cfg.get("terminal_path"):
            kwargs["path"] = self.cfg["terminal_path"]
        if self.cfg.get("portable"):
            kwargs["portable"] = True
        if self.cfg.get("login") and self.cfg.get("password") and self.cfg.get("server"):
            kwargs.update(
                login=int(self.cfg["login"]),
                password=str(self.cfg["password"]),
                server=str(self.cfg["server"]),
            )
        ok = self.mt5.initialize(**kwargs)
        if not ok:
            err = self.last_error()
            hint = ""
            if "-10003" in err or "IPC" in err:
                hint = " - the terminal did not start or did not answer. Check terminal_path, and that no other program is driving this terminal."
            elif "-6" in err or "uthoriz" in err or "-10001" in err:
                hint = " - login, password or server rejected. Check the server name exactly as in the MT5 login window, and that the password is the master password (investor password works for monitoring only)."
            elif "-10005" in err or "-2" in err:
                hint = " - the terminal could not reach the broker server. Open the private terminal window and check its connection status (bottom right)."
            raise MT5Error(f"initialize() failed: {err}{hint}")
        self.connected = True
        info = self.account_info()
        if not info:
            self.shutdown()
            raise MT5Error(f"Connected to terminal but account_info() is empty: {self.last_error()}")
        expected = self.cfg.get("login")
        if expected and int(info.get("login") or 0) != int(expected):
            actual = info.get("login")
            self.shutdown()
            raise MT5Error(
                f"Terminal is logged into account {actual}, but this slot is configured "
                f"for {expected}. Refusing to mix accounts."
            )
        return info

    def shutdown(self) -> None:
        try:
            self.mt5.shutdown()
        finally:
            self.connected = False

    # ------------------------------------------------------------------ #
    def account_info(self) -> dict[str, Any]:
        return _pick(self.mt5.account_info(), ACCOUNT_FIELDS)

    def terminal_info(self) -> dict[str, Any]:
        return _pick(self.mt5.terminal_info(), TERMINAL_FIELDS)

    def version(self) -> Any:
        try:
            return self.mt5.version()
        except Exception:
            return None

    def positions(self) -> list[dict[str, Any]]:
        res = self.mt5.positions_get()
        if res is None:
            return []
        return [_pick(p, POSITION_FIELDS) for p in res]

    def deals(self, date_from: datetime, date_to: datetime) -> list[dict[str, Any]] | None:
        """Deals in a time window. Returns None on API failure (not empty)."""
        res = self.mt5.history_deals_get(
            date_from.astimezone(timezone.utc),
            date_to.astimezone(timezone.utc),
        )
        if res is None:
            return None
        return [_pick(d, DEAL_FIELDS) for d in res]

    def deals_for_position(self, position_id: int) -> list[dict[str, Any]]:
        res = self.mt5.history_deals_get(position=int(position_id))
        if res is None:
            return []
        return [_pick(d, DEAL_FIELDS) for d in res]

SYMBOL_FIELDS = (
    "name", "visible", "select", "digits", "point", "spread", "trade_mode", "trade_calc_mode",
    "trade_contract_size", "trade_tick_size", "trade_tick_value", "trade_tick_value_profit",
    "trade_tick_value_loss", "trade_stops_level", "trade_freeze_level", "volume_min", "volume_max",
    "volume_step", "volume_limit", "filling_mode", "expiration_mode", "order_mode", "swap_long",
    "swap_short", "margin_initial", "margin_maintenance", "currency_base", "currency_profit",
    "currency_margin", "description", "path", "bid", "ask", "last", "time",
)
TICK_FIELDS = ("time", "bid", "ask", "last", "volume", "time_msc", "flags", "volume_real")
RESULT_FIELDS = ("retcode", "deal", "order", "volume", "price", "bid", "ask", "comment", "request_id",
                 "retcode_external", "margin", "margin_free", "margin_level", "balance", "equity", "profit")


def _trading_methods(cls):
    """Mixin-style extension: trading calls on the real adapter."""

    def symbol_info(self, symbol: str) -> dict[str, Any]:
        info = self.mt5.symbol_info(symbol)
        if info is None:
            # try to add the symbol to Market Watch, then retry once
            if self.mt5.symbol_select(symbol, True):
                info = self.mt5.symbol_info(symbol)
        if info is None:
            raise MT5Error(f"Unknown symbol '{symbol}': {self.last_error()}")
        d = _pick(info, SYMBOL_FIELDS)
        if not d.get("visible"):
            self.mt5.symbol_select(symbol, True)
        return d

    def symbol_tick(self, symbol: str) -> dict[str, Any]:
        t = self.mt5.symbol_info_tick(symbol)
        if t is None:
            raise MT5Error(f"No tick for '{symbol}': {self.last_error()}")
        return _pick(t, TICK_FIELDS)

    def order_check(self, request: dict[str, Any]) -> dict[str, Any]:
        res = self.mt5.order_check(request)
        if res is None:
            raise MT5Error(f"order_check() failed: {self.last_error()}")
        return _pick(res, RESULT_FIELDS)

    def order_send(self, request: dict[str, Any]) -> dict[str, Any]:
        res = self.mt5.order_send(request)
        if res is None:
            raise MT5Error(f"order_send() failed: {self.last_error()}")
        return _pick(res, RESULT_FIELDS)

    cls.symbol_info = symbol_info
    cls.symbol_tick = symbol_tick
    cls.order_check = order_check
    cls.order_send = order_send
    return cls


_trading_methods(MT5Adapter)
