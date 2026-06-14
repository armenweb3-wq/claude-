"""HTTP control surface for the bot."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from ..config import settings

router = APIRouter()


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
        "error": s.error,
    }


@router.post("/control/start")
async def start(request: Request) -> dict:
    await _bot(request).start()
    return {"running": True}


@router.post("/control/stop")
async def stop(request: Request) -> dict:
    await _bot(request).stop()
    return {"running": False}


@router.post("/control/pause")
def pause(request: Request) -> dict:
    _bot(request).pause()
    return {"paused": True}


@router.post("/control/resume")
def resume(request: Request) -> dict:
    _bot(request).resume()
    return {"paused": False}
