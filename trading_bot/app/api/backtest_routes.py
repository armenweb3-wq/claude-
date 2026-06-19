"""On-demand backtest runner exposed over the API.

Runs where the bot is deployed (which has market access), so the user can
trigger a multi-cycle backtest from the dashboard without a local setup.

POST /backtest  -> start a run in the background (protected)
GET  /backtest  -> poll status + results
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, Request

from .auth import require_api_key
from ..config import settings
from ..backtest.data import fetch_bybit
from ..backtest.engine import BacktestConfig, Backtester
from ..backtest.metrics import compute_metrics

log = logging.getLogger(__name__)
router = APIRouter()

# Majors with the most Bybit history. We validate the live timeframes (1h, 4h)
# plus daily for the cycle view. Per-timeframe history is bounded so 1h runs
# finish in reasonable time on a small instance.
DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]
TF_WINDOWS = [  # (timeframe, months of history)
    ("1d", 84),   # ~ as far back as Bybit has
    ("4h", 24),
    ("1h", 12),
]


def _start_for(months: int) -> str:
    return (pd.Timestamp.utcnow() - pd.DateOffset(months=months)).strftime("%Y-%m-%d")


def _state(request: Request) -> dict:
    st = getattr(request.app.state, "backtest", None)
    if st is None:
        st = {"status": "idle", "results": [], "started": None,
              "finished": None, "error": None, "params": None}
        request.app.state.backtest = st
    return st


def _run(app_state, symbols, tf_windows) -> None:
    st = app_state.backtest
    results = []
    # Backtest mirrors the live risk settings so results reflect reality.
    cfg = BacktestConfig(
        risk_pct=settings.risk_per_trade_pct,
        leverage_cap=settings.max_leverage,
        max_trades_per_day=settings.max_trades_per_day,
    )
    try:
        bt = Backtester(config=cfg)
        for tf, months in tf_windows:           # daily first (fast), then 4h, 1h
            start = _start_for(months)
            for sym in symbols:
                try:
                    df = fetch_bybit(sym, tf, start=start)
                    if df is None or len(df) < 260:
                        results.append({"symbol": sym, "timeframe": tf,
                                        "note": f"not enough data ({0 if df is None else len(df)})"})
                    else:
                        res = bt.run(df, sym, tf)
                        m = compute_metrics(res)
                        m["bars"] = len(df)
                        m["from"] = str(df.index[0].date())
                        m["to"] = str(df.index[-1].date())
                        # The decisive benchmark: would you have done better just
                        # buying and holding the same coin over the same period?
                        bh = (float(df["close"].iloc[-1]) / float(df["close"].iloc[0]) - 1) * 100
                        m["buy_hold_pct"] = round(bh, 2)
                        m["vs_buy_hold_pct"] = round(m["total_return_pct"] - bh, 2)
                        m["beats_buy_hold"] = m["total_return_pct"] > bh
                        results.append(m)
                    st["results"] = list(results)  # progressive updates
                except Exception as exc:  # pragma: no cover - per-config
                    results.append({"symbol": sym, "timeframe": tf, "error": str(exc)})
                    st["results"] = list(results)
        st["status"] = "done"
    except Exception as exc:  # pragma: no cover
        st["status"] = "error"
        st["error"] = str(exc)
    finally:
        st["finished"] = datetime.now(timezone.utc).isoformat()


@router.post("/backtest", dependencies=[Depends(require_api_key)])
def start_backtest(request: Request) -> dict:
    st = _state(request)
    if st["status"] == "running":
        return {"status": "running", "message": "a backtest is already in progress"}
    st.update(status="running", results=[], error=None,
              started=datetime.now(timezone.utc).isoformat(), finished=None,
              params={"symbols": DEFAULT_SYMBOLS, "timeframes": [t for t, _ in TF_WINDOWS],
                      "risk_pct": settings.risk_per_trade_pct})
    threading.Thread(
        target=_run, args=(request.app.state, DEFAULT_SYMBOLS, TF_WINDOWS),
        daemon=True,
    ).start()
    return {"status": "running", "message": "backtest started"}


@router.get("/backtest")
def get_backtest(request: Request) -> dict:
    return _state(request)
