"""FastAPI entrypoint.

Run with:  uvicorn app.main:app --host 0.0.0.0 --port 8000
(from inside the trading_bot/ directory)

The bot is created on startup but does NOT auto-start trading; call
POST /control/start to begin the loop. This avoids surprise activity on
deploy.
"""
from __future__ import annotations

import logging
import pathlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from .api import backtest_router, router
from .config import settings
from .core import TradingBot
from .saas import saas_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log = logging.getLogger("trading_bot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Booting crypto-trading-bot — %s", settings.safety_summary())
    if not settings.auth_enabled:
        log.warning(
            "CONTROL_API_KEY is not set — /control endpoints are UNPROTECTED. "
            "Set it before exposing the bot or enabling live trading."
        )
    app.state.bot = TradingBot(strategy_name="confluence")

    app.state.telegram = None
    if settings.telegram_control_enabled:
        from .integrations import TelegramController

        controller = TelegramController(
            app.state.bot, settings.telegram_bot_token, settings.telegram_chat_id
        )
        try:
            await controller.run()
            app.state.telegram = controller
        except Exception as exc:  # pragma: no cover - startup best effort
            log.warning("Telegram control failed to start: %s", exc)

    if settings.auto_start:
        log.info("AUTO_START enabled — starting trading loop")
        await app.state.bot.start()

    app.state.saas_runner = None
    if settings.saas_exec_enabled:
        from .saas.routes import store
        from .saas.runner import MultiUserRunner

        app.state.saas_runner = MultiUserRunner(store())
        app.state.saas_runner.start()

    yield

    if app.state.saas_runner is not None:
        app.state.saas_runner.stop()
    if app.state.telegram is not None:
        await app.state.telegram.stop()
    if app.state.bot.state.running:
        await app.state.bot.stop()


# Interactive API docs are hidden by default (don't expose the API surface
# publicly); set ENABLE_DOCS=true to turn them on for debugging.
_docs = settings.enable_docs
app = FastAPI(
    title="crypto-trading-bot", version="0.1.0", lifespan=lifespan,
    docs_url="/docs" if _docs else None,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)
app.include_router(router)
app.include_router(backtest_router)
app.include_router(saas_router)

_DASHBOARD = pathlib.Path(__file__).parent / "web" / "index.html"


@app.get("/", response_class=HTMLResponse)
@app.get("/dashboard", response_class=HTMLResponse)
def dashboard() -> str:
    """Mobile-friendly dashboard, served directly from the bot."""
    return _DASHBOARD.read_text()


@app.get("/info")
def info() -> dict:
    return {
        "service": "crypto-trading-bot",
        "safety": settings.safety_summary(),
        "docs": "/docs",
    }

