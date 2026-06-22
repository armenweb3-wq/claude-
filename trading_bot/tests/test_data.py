"""Backtest data sources: CryptoCompare fallback parsing (no network)."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


def test_cryptocompare_parsing(monkeypatch):
    import requests
    from app.backtest import data

    sample = {"Response": "Success", "Data": {"Data": [
        {"time": 1700000000, "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volumefrom": 100.0},
        {"time": 1700086400, "open": 1.5, "high": 2.5, "low": 1.0, "close": 2.0, "volumefrom": 120.0},
        {"time": 1700172800, "open": 0.0, "high": 0.0, "low": 0.0, "close": 0.0, "volumefrom": 0.0},  # pre-listing pad
    ]}}

    class R:
        def raise_for_status(self): pass
        def json(self): return sample

    monkeypatch.setattr(requests, "get", lambda *a, **k: R())
    df = data.fetch_cryptocompare("BTCUSDT", "1d", start="2023-11-01")
    assert list(df.columns) == ["open", "high", "low", "close", "volume"]
    assert (df["close"] > 0).all()          # zero-padded pre-listing row dropped
    assert len(df) == 2 and df["close"].iloc[-1] == 2.0


def test_cryptocompare_in_fallback_chain():
    # CryptoCompare is wired in after bybit/binance.
    import inspect
    from app.backtest import data
    src = inspect.getsource(data.fetch_history)
    assert "cryptocompare" in src
