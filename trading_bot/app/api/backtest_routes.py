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

from fastapi import APIRouter, Depends, Request

from .auth import require_api_key
from ..backtest.data import fetch_bybit
from ..backtest.engine import BacktestConfig, Backtester
from ..backtest.metrics import compute_metrics

log = logging.getLogger(__name__)
router = APIRouter()

# Defaults: majors with the most Bybit history, daily timeframe (cycle scale).
DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]
DEFAULT_TFS = ["1d"]
DEFAULT_START = "2019-01-01"   # Bybit data effectively starts ~2020


def _state(request: Request) -> dict:
    st = getattr(request.app.state, "backtest", None)
    if st is None:
        st = {"status": "idle", "results": [], "started": None,
              "finished": None, "error": None, "params": None}
        request.app.state.backtest = st
    return st


def _run(app_state, symbols, timeframes, start) -> None:
    st = app_state.backtest
    results = []
    try:
        bt = Backtester(config=BacktestConfig())
        for sym in symbols:
            for tf in timeframes:
                try:
                    df = fetch_bybit(sym, tf, start=start)
                    if df is None or len(df) < 260:
                        results.append({"symbol": sym, "timeframe": tf,
                                        "note": f"not enough data ({0 if df is None else len(df)})"})
                        continue
                    res = bt.run(df, sym, tf)
                    m = compute_metrics(res)
                    m["bars"] = len(df)
                    m["from"] = str(df.index[0].date())
                    m["to"] = str(df.index[-1].date())
                    results.append(m)
                    st["results"] = results  # progressive updates
                except Exception as exc:  # pragma: no cover - per-config
                    results.append({"symbol": sym, "timeframe": tf, "error": str(exc)})
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
              params={"symbols": DEFAULT_SYMBOLS, "timeframes": DEFAULT_TFS, "start": DEFAULT_START})
    threading.Thread(
        target=_run, args=(request.app.state, DEFAULT_SYMBOLS, DEFAULT_TFS, DEFAULT_START),
        daemon=True,
    ).start()
    return {"status": "running", "message": "backtest started"}


@router.get("/backtest")
def get_backtest(request: Request) -> dict:
    return _state(request)
