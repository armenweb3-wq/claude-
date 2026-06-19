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
from fastapi import Request
from fastapi.responses import JSONResponse


@app.middleware("http")
async def _security(request: Request, call_next):
    # CSRF: reject cross-site state-changing requests to cookie-authed APIs.
    # Same-origin fetch() always sends an Origin header that matches Host; an
    # attacker page's request carries its own (mismatching) Origin. The Telegram
    # webhook is exempt (it's authed by a secret token, not a cookie, and sends
    # no Origin).
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        path = request.url.path
        if path.startswith("/app/api") and path != "/app/api/tg-webhook":
            origin = request.headers.get("origin") or request.headers.get("referer")
            host = request.headers.get("host", "")
            # Only block when an Origin/Referer is present AND mismatches the host
            # (a real CSRF from a browser always carries a mismatching Origin).
            if origin and host:
                try:
                    from urllib.parse import urlparse
                    if urlparse(origin).netloc != host:
                        return JSONResponse({"detail": "cross-site request blocked"},
                                            status_code=403)
                except Exception:
                    return JSONResponse({"detail": "bad origin"}, status_code=403)
    resp = await call_next(request)
    # Security headers on every response.
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    resp.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return resp


app.include_router(router)
app.include_router(backtest_router)
app.include_router(saas_router)

from fastapi.responses import RedirectResponse

_DASHBOARD = pathlib.Path(__file__).parent / "web" / "index.html"


@app.get("/")
def root() -> RedirectResponse:
    """Send visitors to the product (SaaS). The legacy single-user dashboard is
    no longer surfaced publicly."""
    return RedirectResponse(url="/app", status_code=307)


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard() -> str:
    """Legacy single-user owner dashboard (kept for the operator; not linked)."""
    return _DASHBOARD.read_text()


@app.get("/info")
def info() -> dict:
    return {
        "service": "crypto-trading-bot",
        "safety": settings.safety_summary(),
        "docs": "/docs",
    }

