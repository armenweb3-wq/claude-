"""Centralised configuration loaded from environment / .env.

Uses python-dotenv + stdlib only (no pydantic dependency) to keep the
footprint small. All settings are read once at import time into a frozen
``settings`` object.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _get_bool(name: str, default: bool = False) -> bool:
    return _get(name, str(default)).lower() in {"1", "true", "yes", "on"}


def _get_float(name: str, default: float) -> float:
    try:
        return float(_get(name) or default)
    except ValueError:
        return default


def _get_int(name: str, default: int) -> int:
    try:
        return int(_get(name) or default)
    except ValueError:
        return default


def _get_list(name: str, default: str = "") -> list[str]:
    raw = _get(name, default)
    return [item.strip().upper() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    # mode
    trading_mode: str = field(default_factory=lambda: _get("TRADING_MODE", "dry_run").lower())

    # bybit
    bybit_testnet: bool = field(default_factory=lambda: _get_bool("BYBIT_TESTNET", True))
    bybit_api_key: str = field(default_factory=lambda: _get("BYBIT_API_KEY"))
    bybit_api_secret: str = field(default_factory=lambda: _get("BYBIT_API_SECRET"))
    bybit_category: str = field(default_factory=lambda: _get("BYBIT_CATEGORY", "linear"))

    # trading params
    symbols: list[str] = field(default_factory=lambda: _get_list("SYMBOLS", "BTCUSDT"))
    timeframe: str = field(default_factory=lambda: _get("TIMEFRAME", "15"))
    loop_interval_seconds: int = field(default_factory=lambda: _get_int("LOOP_INTERVAL_SECONDS", 60))

    # risk
    risk_per_trade_pct: float = field(default_factory=lambda: _get_float("RISK_PER_TRADE_PCT", 1.0))
    max_leverage: int = field(default_factory=lambda: _get_int("MAX_LEVERAGE", 3))
    max_open_positions: int = field(default_factory=lambda: _get_int("MAX_OPEN_POSITIONS", 1))
    stop_loss_pct: float = field(default_factory=lambda: _get_float("STOP_LOSS_PCT", 2.0))
    take_profit_pct: float = field(default_factory=lambda: _get_float("TAKE_PROFIT_PCT", 4.0))
    daily_max_loss_pct: float = field(default_factory=lambda: _get_float("DAILY_MAX_LOSS_PCT", 5.0))

    # storage
    database_url: str = field(default_factory=lambda: _get("DATABASE_URL"))

    # telegram
    telegram_bot_token: str = field(default_factory=lambda: _get("TELEGRAM_BOT_TOKEN"))
    telegram_chat_id: str = field(default_factory=lambda: _get("TELEGRAM_CHAT_ID"))

    # webhook
    webhook_url: str = field(default_factory=lambda: _get("WEBHOOK_URL"))
    webhook_secret: str = field(default_factory=lambda: _get("WEBHOOK_SECRET"))

    # api
    api_host: str = field(default_factory=lambda: _get("API_HOST", "0.0.0.0"))
    api_port: int = field(default_factory=lambda: _get_int("API_PORT", 8000))

    # Shared secret protecting the control API (X-API-Key header).
    # When empty, control endpoints are UNPROTECTED — fine for local dry-run,
    # but you must set this before exposing the bot or going live.
    control_api_key: str = field(default_factory=lambda: _get("CONTROL_API_KEY"))

    @property
    def auth_enabled(self) -> bool:
        return bool(self.control_api_key)

    @property
    def is_live(self) -> bool:
        """True only when live trading is explicitly enabled AND keys exist."""
        return (
            self.trading_mode == "live"
            and bool(self.bybit_api_key)
            and bool(self.bybit_api_secret)
        )

    def safety_summary(self) -> str:
        if self.is_live:
            net = "TESTNET" if self.bybit_testnet else "MAINNET"
            return f"LIVE trading enabled on Bybit {net} ({self.bybit_category})"
        return "DRY-RUN (no real orders will be placed)"


settings = Settings()
