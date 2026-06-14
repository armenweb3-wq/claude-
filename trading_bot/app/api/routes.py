"""HTTP control surface for the bot."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ..config import settings
from .auth import require_api_key

router = APIRouter()

# All state-changing control endpoints require the API key (when configured).
control = APIRouter(prefix="/control", dependencies=[Depends(require_api_key)])


def _bot(request: Request):
    bot = getattr(request.app.state, "bot", None)
    if bot is None:
        raise HTTPException(status_code=503, detail="bot not initialised")
    return bot


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/status")
def status(request: Request) -> dict:
    bot = _bot(request)
    s = bot.state
    return {
        "running": s.running,
        "paused": s.paused,
        "mode": s.mode,
        "is_live": settings.is_live,
        "safety": settings.safety_summary(),
        "strategy": s.strategy,
        "symbols": settings.symbols,
        "timeframe": settings.timeframe,
        "exchange": bot.exchange.name,
        "last_run": s.last_run,
        "last_signals": s.last_signals,
        "market": s.market,
        "error": s.error,
    }


@router.get("/errors")
def errors(request: Request, limit: int = 50) -> dict:
    return {"errors": _bot(request).storage.recent_errors(limit=limit)}


@control.post("/start")
async def start(request: Request) -> dict:
    await _bot(request).start()
    return {"running": True}


@control.post("/stop")
async def stop(request: Request) -> dict:
    await _bot(request).stop()
    return {"running": False}


@control.post("/pause")
def pause(request: Request) -> dict:
    _bot(request).pause()
    return {"paused": True}


@control.post("/resume")
def resume(request: Request) -> dict:
    _bot(request).resume()
    return {"paused": False}


router.include_router(control)
