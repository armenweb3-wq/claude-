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
        "symbols": getattr(bot, "symbols", settings.symbols),
        "timeframe": settings.timeframe,
        "exchange": bot.exchange.name,
        "last_run": s.last_run,
        "last_signals": s.last_signals,
        "market": s.market,
        "cycle": s.cycle,
        "equity": s.equity,
        "start_equity": s.start_equity,
        "session_pnl": round(s.equity - s.start_equity, 4) if s.start_equity else 0.0,
        "open_positions": s.open_positions,
        "positions": s.positions,
        "open_pnl": round(sum(p.get("unrealised_pnl", 0.0) for p in s.positions), 4),
        "error": s.error,
    }


@router.get("/klines")
def klines(request: Request, symbol: str, limit: int = 200) -> dict:
    bot = _bot(request)
    df = bot.exchange.get_klines(symbol, settings.timeframe, limit=min(limit, 1000))
    candles = [
        {
            "time": int(ts.timestamp()),
            "open": float(row["open"]), "high": float(row["high"]),
            "low": float(row["low"]), "close": float(row["close"]),
        }
        for ts, row in df.iterrows()
    ]
    return {"symbol": symbol, "timeframe": settings.timeframe, "candles": candles}


@router.get("/history")
def history(request: Request, limit: int = 100) -> dict:
    """Recent closed trades plus win/loss aggregates for the dashboard."""
    bot = _bot(request)
    try:
        # Serialise with the bot loops — the exchange client isn't thread-safe.
        with bot._ex_lock:
            trades = bot.exchange.closed_pnl(limit=min(limit, 200))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"history unavailable: {exc}")
    wins = sum(1 for t in trades if (t.get("pnl") or 0) > 0)
    losses = sum(1 for t in trades if (t.get("pnl") or 0) < 0)
    decided = wins + losses
    return {
        "trades": trades,
        "stats": {
            "wins": wins,
            "losses": losses,
            "breakeven": len(trades) - decided,
            "total": len(trades),
            "win_rate": round(wins / decided * 100, 1) if decided else 0.0,
            "realized_pnl": round(sum(t.get("pnl") or 0 for t in trades), 4),
            "fees": round(sum(t.get("fee") or 0 for t in trades), 4),
        },
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
