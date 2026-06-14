"""FastAPI entrypoint.

Run with:  uvicorn app.main:app --host 0.0.0.0 --port 8000
(from inside the trading_bot/ directory)

The bot is created on startup but does NOT auto-start trading; call
POST /control/start to begin the loop. This avoids surprise activity on
deploy.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import router
from .config import settings
from .core import TradingBot

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

    yield

    if app.state.telegram is not None:
        await app.state.telegram.stop()
    if app.state.bot.state.running:
        await app.state.bot.stop()


app = FastAPI(title="crypto-trading-bot", version="0.1.0", lifespan=lifespan)
app.include_router(router)


@app.get("/")
def root() -> dict:
    return {
        "service": "crypto-trading-bot",
        "safety": settings.safety_summary(),
        "docs": "/docs",
    }
