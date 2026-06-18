"""Data loading and synthetic price generation.

The hosted environment blocks outbound network access, so this module is built
around two portable sources:

1. ``load_csv`` — read any OHLC CSV (columns: timestamp/date, open, high, low,
   close[, volume]). Drop in real data (Yahoo, Stooq, Binance, your broker) and
   everything downstream just works.
2. ``synthetic`` — a regime-switching geometric-Brownian-motion generator so the
   engine can be run and validated without any network or data files.

There is also ``from_candlestick_json`` for the records returned by the
connected Crypto.com live feed, so a short backtest can run on genuine prices.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

OHLC = ["open", "high", "low", "close"]


def _finalize(df: pd.DataFrame) -> pd.DataFrame:
    """Sort by time, coerce numerics, and validate the OHLC contract."""
    df = df.copy()
    df.columns = [c.strip().lower() for c in df.columns]
    # accept common aliases for the time column
    for alias in ("timestamp", "date", "datetime", "time"):
        if alias in df.columns:
            df["timestamp"] = pd.to_datetime(df[alias], utc=True)
            break
    if "timestamp" not in df.columns:
        raise ValueError("no timestamp/date column found")
    for col in OHLC:
        if col not in df.columns:
            raise ValueError(f"missing required column: {col!r}")
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=OHLC).sort_values("timestamp").set_index("timestamp")
    keep = OHLC + (["volume"] if "volume" in df.columns else [])
    return df[keep]


def load_csv(path: str) -> pd.DataFrame:
    """Load an OHLC CSV into the canonical frame (UTC index, lower-case cols).

    Auto-detects the delimiter (comma or tab) so data from different providers
    loads the same way.
    """
    with open(path) as fh:
        head = fh.readline()
    sep = "\t" if head.count("\t") > head.count(",") else ","
    return _finalize(pd.read_csv(path, sep=sep))


def from_candlestick_json(payload: dict) -> pd.DataFrame:
    """Build a frame from the Crypto.com ``get_candlestick`` response shape."""
    return _finalize(pd.DataFrame(payload["data"]))


# regime presets: (drift_mult, vol_mult, probability)
EQUITY_REGIMES = [
    (2.5, 1.0, 0.45),   # bull (common)
    (-3.0, 1.8, 0.20),  # bear crash (rarer, violent)
    (0.3, 0.7, 0.20),   # calm sideways, slight upward grind
    (0.0, 1.8, 0.15),   # choppy sideways (whipsaw)
]
# a broad index is calmer than a single name: gentler crashes, longer grinds up
INDEX_REGIMES = [
    (2.0, 0.8, 0.50),   # steady bull
    (-2.5, 1.5, 0.12),  # correction / bear (rarer)
    (0.6, 0.6, 0.28),   # low-vol grind higher
    (0.0, 1.3, 0.10),   # choppy consolidation
]


def index_market(days: int = 2500, seed: int = 42) -> pd.DataFrame:
    """An equity-index-like series: ~10%/yr drift, ~15% vol, gentle crashes."""
    return synthetic(
        days=days, seed=seed, annual_drift=0.10, annual_vol=0.15,
        regimes=INDEX_REGIMES,
    )


def synthetic(
    days: int = 1500,
    start: float = 100.0,
    seed: int = 42,
    annual_drift: float = 0.09,
    annual_vol: float = 0.20,
    freq: str = "D",
    regimes: list | None = None,
) -> pd.DataFrame:
    """Generate a regime-switching OHLC series.

    Real markets are not a single clean trend, so we splice together bull,
    bear, and choppy/sideways regimes. The sideways regimes are where mean
    reversion (e.g. the grid strategy) is supposed to shine, and the trends are
    where it is supposed to struggle — exactly the contrast a backtest exists to
    expose. ``annual_drift``/``annual_vol`` set the baseline; regimes scale them.
    """
    rng = np.random.default_rng(seed)
    per_year = 365 if freq == "D" else 252
    dt = 1.0 / per_year

    # Regimes are calibrated so the series has a mild *net-positive* long-run
    # drift like real equity markets (bull regimes dominate, punctuated by
    # sharper, rarer bear crashes). This makes Buy & Hold a genuine benchmark
    # rather than a strawman. Pass ``regimes`` to override (see INDEX_REGIMES).
    regimes = regimes if regimes is not None else EQUITY_REGIMES
    choices = np.array([r[:2] for r in regimes])
    probs = np.array([r[2] for r in regimes])
    drift_path = np.empty(days)
    vol_path = np.empty(days)
    i = 0
    while i < days:
        dm, vm = choices[rng.choice(len(regimes), p=probs)]
        length = int(rng.integers(40, 160))
        end = min(i + length, days)
        drift_path[i:end] = annual_drift * dm
        vol_path[i:end] = annual_vol * vm
        i = end

    # daily close via GBM with time-varying params
    shocks = rng.standard_normal(days)
    log_ret = (drift_path - 0.5 * vol_path**2) * dt + vol_path * np.sqrt(dt) * shocks
    close = start * np.exp(np.cumsum(log_ret))

    # synthesize plausible OHLC around each close
    open_ = np.empty(days)
    open_[0] = start
    open_[1:] = close[:-1]
    intraday = vol_path * np.sqrt(dt) * np.abs(rng.standard_normal(days))
    high = np.maximum(open_, close) * (1 + intraday)
    low = np.minimum(open_, close) * (1 - intraday)

    idx = pd.date_range("2020-01-01", periods=days, freq=freq, tz="UTC")
    return pd.DataFrame(
        {"open": open_, "high": high, "low": low, "close": close}, index=idx
    )
