"""Forward-test track record (weekly buckets + cumulative) and the fee floor."""
from __future__ import annotations

import datetime as dt
import pathlib
import sys

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.saas.store import Store  # noqa: E402


def _wk(date_str: str) -> str:
    iso = dt.date.fromisoformat(date_str).isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def test_weekly_track_buckets_and_cumulative():
    st = Store(path=":memory:")
    st.add_closed_trades(1, [
        # week A: one win, one loss (different entry prices -> no merging)
        {"id": "a", "symbol": "BTCUSDT", "side": "Buy", "pnl": 2.0, "pnl_pct": 6,
         "entry_price": 100.0, "qty": 1, "closed_at": "2026-06-15T10:00:00+00:00"},
        {"id": "b", "symbol": "ETHUSDT", "side": "Buy", "pnl": -1.0, "pnl_pct": -3,
         "entry_price": 50.0, "qty": 1, "closed_at": "2026-06-16T10:00:00+00:00"},
        # week B: one win
        {"id": "c", "symbol": "SOLUSDT", "side": "Sell", "pnl": 3.0, "pnl_pct": 6,
         "entry_price": 70.0, "qty": 1, "closed_at": "2026-06-23T10:00:00+00:00"},
    ])
    tr = st.weekly_track(1)
    assert tr["since"] == "2026-06-15"
    assert tr["totals"] == {"trades": 3, "wins": 2, "losses": 1,
                            "win_rate": 66.7, "pnl": 4.0}
    weeks = {w["week"]: w for w in tr["weeks"]}
    wa, wb = _wk("2026-06-15"), _wk("2026-06-23")
    assert weeks[wa]["pnl"] == 1.0 and weeks[wa]["win_rate"] == 50.0
    assert weeks[wb]["pnl"] == 3.0
    # chronological cumulative: week A -> +1, week B -> +4
    assert [w["cum_pnl"] for w in tr["weeks"]] == [1.0, 4.0]


@pytest.fixture()
def client(tmp_path):
    for k, v in {"saas_db_path": str(tmp_path / "t.db"), "saas_secret_key": "test-secret",
                 "saas_seat_limit": 5, "saas_admin_email": "admin@z.com"}.items():
        object.__setattr__(settings, k, v)
    import app.saas.routes as r
    r._store = None
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def test_track_endpoint_shape(client):
    client.post("/app/api/register", json={"email": "tk@b.com", "password": "password1"})
    d = client.get("/app/api/track").json()
    assert d["weeks"] == [] and d["since"] is None
    assert d["totals"]["trades"] == 0


# ── fee floor ───────────────────────────────────────────────
def test_fee_floor_skips_fee_dominated_trades():
    """A razor-thin stop forces a huge notional per unit of risk — the round-trip
    fee would dwarf the risked amount, so the trade must be skipped."""
    import pandas as pd
    from app.exchange.base import Position
    from app.saas.usertrader import UserTrader
    from app.strategy.base import Signal, TakeProfit

    class ThinStopStrategy:
        name = "thin"

        def generate(self, df):
            return Signal(action="long", reason="t", confidence=0.9,
                          entry=100.0, stop_loss=99.9,   # 0.1% stop
                          take_profits=[TakeProfit(6, 1.0, 106.0)], leverage=5)

    class Ex:
        def get_equity(self): return 1000.0
        def available_symbols(self): return set()
        def closed_pnl(self, limit=100, start_ms=None): return []
        def get_position(self, symbol): return Position(symbol, None, 0.0, 0.0)
        def get_klines(self, s, tf, limit=200):
            n = 60
            return pd.DataFrame({"open": [1.0] * n, "high": [1.0] * n,
                                 "low": [1.0] * n, "close": [1.0] * n, "volume": [1] * n})
        def open_position(self, **kw):
            raise AssertionError("fee-dominated trade must not reach the exchange")

    import app.saas.usertrader as ut_mod
    object.__setattr__(ut_mod.settings, "btc_filter_enabled", False)
    try:
        t = UserTrader(Ex(), ThinStopStrategy(), risk_pct=2.0,
                       symbols=["BTCUSDT"], dry=False)
        out = t.run_once()
        assert out["opened"] == []
        assert out["signals"]["BTCUSDT"].startswith("skipped: fees")
    finally:
        object.__setattr__(ut_mod.settings, "btc_filter_enabled", True)
