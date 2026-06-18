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
    # Daily is where backtests showed a real, multi-year edge; shorter
    # timeframes (1h/4h) were break-even-to-losing after fees.
    timeframe: str = field(default_factory=lambda: _get("TIMEFRAME", "D"))
    loop_interval_seconds: int = field(default_factory=lambda: _get_int("LOOP_INTERVAL_SECONDS", 900))
    # How often the dashboard's live position/PnL/equity snapshot is refreshed.
    # Decoupled from the (slow) strategy loop so the UI matches the exchange
    # within a minute instead of lagging a whole strategy cycle.
    position_refresh_seconds: int = field(default_factory=lambda: _get_int("POSITION_REFRESH_SECONDS", 60))
    # Shared cache for public market data (klines/instruments) to avoid hitting
    # Bybit's rate limit when many users scan the same coins. Daily candles barely
    # move within this window, so staleness is harmless.
    market_cache_seconds: int = field(default_factory=lambda: _get_int("MARKET_CACHE_SECONDS", 120))
    # Public FastAPI /docs are off by default in production; enable for debugging.
    enable_docs: bool = field(default_factory=lambda: _get_bool("ENABLE_DOCS", False))

    # BTC-led market filter: block longs when BTC is crashing/bearish and
    # shorts when BTC is pumping/bullish (alts follow BTC).
    btc_filter_enabled: bool = field(default_factory=lambda: _get_bool("BTC_FILTER_ENABLED", True))
    # When the filter flips to block a side (e.g. BTC pumps -> shorts paused),
    # close still-open positions on that side that are currently in profit, so
    # the gain is banked before the new trend gives it back.
    close_on_regime_flip: bool = field(default_factory=lambda: _get_bool("CLOSE_ON_REGIME_FLIP", True))
    btc_symbol: str = field(default_factory=lambda: _get("BTC_SYMBOL", "BTCUSDT"))
    btc_crash_pct: float = field(default_factory=lambda: _get_float("BTC_CRASH_PCT", 3.0))

    # risk
    # Defaults chosen for survivability: 2% risk and 5x cap keep drawdowns
    # far lower than the 5%/10x that produced 50-67% drawdowns in backtests.
    risk_per_trade_pct: float = field(default_factory=lambda: _get_float("RISK_PER_TRADE_PCT", 2.0))
    max_leverage: int = field(default_factory=lambda: _get_int("MAX_LEVERAGE", 5))
    # Once a trade runs this far in profit (TP1), move the stop to break-even so
    # the trade can no longer turn into a loss. Set to 0 to disable.
    breakeven_after_pct: float = field(default_factory=lambda: _get_float("BREAKEVEN_AFTER_PCT", 6.0))
    max_open_positions: int = field(default_factory=lambda: _get_int("MAX_OPEN_POSITIONS", 3))
    max_trades_per_day: int = field(default_factory=lambda: _get_int("MAX_TRADES_PER_DAY", 20))
    stop_loss_pct: float = field(default_factory=lambda: _get_float("STOP_LOSS_PCT", 2.0))
    take_profit_pct: float = field(default_factory=lambda: _get_float("TAKE_PROFIT_PCT", 4.0))
    daily_max_loss_pct: float = field(default_factory=lambda: _get_float("DAILY_MAX_LOSS_PCT", 5.0))

    # storage
    database_url: str = field(default_factory=lambda: _get("DATABASE_URL"))

    # telegram
    telegram_bot_token: str = field(default_factory=lambda: _get("TELEGRAM_BOT_TOKEN"))
    telegram_chat_id: str = field(default_factory=lambda: _get("TELEGRAM_CHAT_ID"))
    # Two-way command control (/status, /start, /stop, /pause, /resume).
    telegram_commands_enabled: bool = field(
        default_factory=lambda: _get_bool("TELEGRAM_COMMANDS_ENABLED", False)
    )

    # webhook
    webhook_url: str = field(default_factory=lambda: _get("WEBHOOK_URL"))
    webhook_secret: str = field(default_factory=lambda: _get("WEBHOOK_SECRET"))

    # api
    api_host: str = field(default_factory=lambda: _get("API_HOST", "0.0.0.0"))
    api_port: int = field(default_factory=lambda: _get_int("API_PORT", 8000))

    # Auto-start the trading loop on boot (for hands-off cloud deploys).
    # Leave false for the first runs so you start it deliberately.
    auto_start: bool = field(default_factory=lambda: _get_bool("AUTO_START", False))

    # Shared secret protecting the control API (X-API-Key header).
    # When empty, control endpoints are UNPROTECTED — fine for local dry-run,
    # but you must set this before exposing the bot or going live.
    control_api_key: str = field(default_factory=lambda: _get("CONTROL_API_KEY"))

    # ── SaaS beta (multi-user) ──────────────────────────────────
    saas_seat_limit: int = field(default_factory=lambda: _get_int("SAAS_SEAT_LIMIT", 25))
    saas_secret_key: str = field(default_factory=lambda: _get("SAAS_SECRET_KEY"))
    saas_db_path: str = field(default_factory=lambda: _get("SAAS_DB_PATH", "saas.db"))
    saas_admin_email: str = field(default_factory=lambda: _get("SAAS_ADMIN_EMAIL").strip().lower())
    pay_wallet_address: str = field(default_factory=lambda: _get("PAY_WALLET_ADDRESS"))
    pay_coin_network: str = field(default_factory=lambda: _get("PAY_COIN_NETWORK", "USDT (TRC-20)"))
    pay_price: str = field(default_factory=lambda: _get("PAY_PRICE", "30 USDT / month"))
    # When false, friends skip the payment step entirely (free mode) — they just
    # connect keys and wait for the admin to activate them manually.
    pay_required: bool = field(default_factory=lambda: _get_bool("SAAS_PAYMENT_REQUIRED", True))
    # If set, friends activate instantly for free by typing this access code
    # (no payment, no manual approval needed). Leave empty to disable.
    saas_access_code: str = field(default_factory=lambda: _get("SAAS_ACCESS_CODE", "").strip())
    # Phase 2 — per-user execution engine (off by default for safety).
    saas_exec_enabled: bool = field(default_factory=lambda: _get_bool("SAAS_EXEC_ENABLED", False))
    saas_dry_run: bool = field(default_factory=lambda: _get_bool("SAAS_DRY_RUN", True))
    saas_loop_seconds: int = field(default_factory=lambda: _get_int("SAAS_LOOP_SECONDS", 900))

    @property
    def auth_enabled(self) -> bool:
        return bool(self.control_api_key)

    @property
    def telegram_control_enabled(self) -> bool:
        return (
            self.telegram_commands_enabled
            and bool(self.telegram_bot_token)
            and bool(self.telegram_chat_id)
        )

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
