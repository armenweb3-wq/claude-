"""Historical data loading for the backtester.

Three sources, all returning a chronological OHLCV DataFrame indexed by a
UTC DatetimeIndex with columns [open, high, low, close, volume]:

- load_csv(path):        offline file (works in restricted networks)
- fetch_bybit(...):      paginated Bybit klines (works where egress allows)
- synthetic_ohlcv(...):  reproducible fake data for tests/demos
"""
from __future__ import annotations

import time

import numpy as np
import pandas as pd

# Bybit kline interval codes for the timeframes we trade.
INTERVALS = {"1h": "60", "4h": "240", "1d": "D"}


def _normalise(df: pd.DataFrame) -> pd.DataFrame:
    cols = ["open", "high", "low", "close", "volume"]
    for c in cols:
        df[c] = df[c].astype(float)
    return df[cols].sort_index()


def load_csv(path: str, time_col: str = "timestamp") -> pd.DataFrame:
    """Load OHLCV from CSV. Accepts ms/seconds epoch or ISO timestamps."""
    df = pd.read_csv(path)
    df.columns = [c.lower() for c in df.columns]
    ts = df[time_col]
    if np.issubdtype(ts.dtype, np.number):
        unit = "ms" if ts.iloc[0] > 1e12 else "s"
        df.index = pd.to_datetime(ts, unit=unit, utc=True)
    else:
        df.index = pd.to_datetime(ts, utc=True)
    return _normalise(df)


def fetch_bybit(
    symbol: str,
    timeframe: str,
    start: str,
    end: str | None = None,
    category: str = "linear",
) -> pd.DataFrame:
    """Fetch klines from Bybit with pagination. Requires network egress."""
    import requests

    interval = INTERVALS.get(timeframe, timeframe)
    start_ms = int(pd.Timestamp(start, tz="UTC").timestamp() * 1000)
    end_ms = int((pd.Timestamp(end, tz="UTC") if end else pd.Timestamp.utcnow()).timestamp() * 1000)

    rows: list[list] = []
    cursor = start_ms
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0"})
    # Walk FORWARD from `start` (omit `end` so Bybit returns from the cursor
    # rather than anchoring to the most-recent window).
    while cursor < end_ms:
        resp = session.get(
            "https://api.bybit.com/v5/market/kline",
            params={
                "category": category, "symbol": symbol, "interval": interval,
                "start": cursor, "limit": 1000,
            },
            timeout=20,
        )
        resp.raise_for_status()
        batch = resp.json().get("result", {}).get("list", [])
        if not batch:
            break
        batch = list(reversed(batch))  # API returns newest-first
        batch = [b for b in batch if int(b[0]) >= cursor]
        if not batch:
            break
        rows.extend(batch)
        last_ts = int(batch[-1][0])
        if last_ts <= cursor or len(batch) < 1000:
            break  # no progress, or reached the latest data
        cursor = last_ts + 1
        time.sleep(0.2)  # be polite to the API

    df = pd.DataFrame(
        rows, columns=["start", "open", "high", "low", "close", "volume", "turnover"]
    )
    if df.empty:
        return df
    df.index = pd.to_datetime(df["start"].astype("int64"), unit="ms", utc=True)
    df = df[~df.index.duplicated(keep="first")]
    return _normalise(df)


def synthetic_ohlcv(
    periods: int = 3000, freq: str = "1h", seed: int = 7, start_price: float = 30_000.0
) -> pd.DataFrame:
    """Reproducible random-walk OHLCV with drift cycles, for tests/demos."""
    rng = np.random.default_rng(seed)
    idx = pd.date_range("2023-01-01", periods=periods, freq=freq, tz="UTC")
    # Regime-switching drift to exercise both long and short logic.
    drift = np.concatenate([
        np.full(periods // 3, 0.0006),    # bull
        np.full(periods // 3, -0.0008),   # bear
        np.full(periods - 2 * (periods // 3), 0.0001),  # chop
    ])
    rets = drift + rng.normal(0, 0.012, periods)
    close = start_price * np.exp(np.cumsum(rets))
    high = close * (1 + np.abs(rng.normal(0, 0.004, periods)))
    low = close * (1 - np.abs(rng.normal(0, 0.004, periods)))
    open_ = np.concatenate([[start_price], close[:-1]])
    vol = rng.uniform(10, 100, periods)
    return pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close, "volume": vol}, index=idx
    )
