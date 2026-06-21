"""Indices market: MT5 lot sizing, MetaApi adapter, IndicesTrader, endpoints."""
from __future__ import annotations

import pathlib
import sys

import pandas as pd
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.risk.mt5_sizing import plan_mt5_position  # noqa: E402
from app.strategy.base import Signal, TakeProfit  # noqa: E402


# ── lot sizing (pure) ───────────────────────────────────────
def test_lot_sizing_risk_proportional():
    # risk 1% of 10000 = 100; loss/lot = (20/0.1)*1 = 200 -> 0.5 lots
    p = plan_mt5_position(equity=10_000, risk_pct=1.0, entry=5000, stop=4980,
                          tick_size=0.1, tick_value=1.0)
    assert abs(p.volume - 0.5) < 1e-9
    assert abs(p.est_loss_at_stop - 100.0) < 1e-6


def test_lot_sizing_rounds_down_to_step():
    p = plan_mt5_position(equity=10_000, risk_pct=1.0, entry=5000, stop=4985,
                          tick_size=0.1, tick_value=1.0, volume_step=0.1)
    # loss/lot=(15/0.1)*1=150; raw=100/150=0.666 -> round down to 0.6
    assert abs(p.volume - 0.6) < 1e-9


def test_lot_sizing_skips_when_too_small_for_min_lot():
    # tiny equity: min lot would risk far more than the target -> skip
    p = plan_mt5_position(equity=50, risk_pct=1.0, entry=5000, stop=4900,
                          tick_size=0.1, tick_value=1.0, min_volume=0.1)
    assert p.volume == 0.0


def test_lot_sizing_invalid_inputs():
    assert plan_mt5_position(equity=0, risk_pct=1, entry=5000, stop=4980,
                             tick_size=0.1, tick_value=1).volume == 0.0
    assert plan_mt5_position(equity=1000, risk_pct=1, entry=5000, stop=5000,
                             tick_size=0.1, tick_value=1).volume == 0.0


# ── MetaApi adapter (fake transport) ────────────────────────
def test_metaapi_adapter_surface():
    calls = []

    def transport(method, path, params=None, json=None):
        calls.append((method, path, json))
        if path.endswith("/account-information"):
            return {"equity": 12345.6, "balance": 1.0, "currency": "USD"}
        if path.endswith("/positions"):
            return [{"id": "7", "symbol": "US500", "type": "POSITION_TYPE_BUY",
                     "volume": 0.5, "openPrice": 5000, "stopLoss": 4980, "profit": 12.0}]
        if path.endswith("/trade"):
            return {"orderId": "99", "positionId": "100"}
        return {}

    from app.exchange.metaapi_mt5 import MetaApiMT5
    bk = MetaApiMT5("tok", "acc1", "https://x", transport=transport)
    assert bk.get_equity() == 12345.6
    p = bk.get_position("US500")
    assert p and p["side"] == "Buy" and p["volume"] == 0.5
    r = bk.market_order("US500", "Buy", 0.5, stop_loss=4980, take_profit=5040)
    assert r["positionId"] == "100"
    trade = next(c for c in calls if c[1].endswith("/trade"))
    assert trade[2]["actionType"] == "ORDER_TYPE_BUY"
    assert trade[2]["volume"] == 0.5 and trade[2]["stopLoss"] == 4980


# ── IndicesTrader (fake broker) ─────────────────────────────
class FakeStrategy:
    name = "fake"

    def __init__(self, action="long"):
        self._a = action

    def generate(self, df):
        return Signal(action=self._a, reason="t", confidence=0.8, entry=5000.0,
                      stop_loss=4980.0, take_profits=[TakeProfit(1, 1.0, 5040.0)], leverage=1)


class FakeBroker:
    def __init__(self, equity=10_000.0):
        self._eq = equity
        self.orders = []
        self.positions = []

    def get_equity(self):
        return self._eq

    def list_symbols(self):
        return {"US500", "USTEC"}

    def open_positions(self):
        return list(self.positions)

    def candles(self, symbol, tf, limit=251):
        n = 70
        return pd.DataFrame({"open": [1.0] * n, "high": [1.0] * n, "low": [1.0] * n,
                             "close": [1.0] * n, "volume": [1] * n})

    def symbol_spec(self, symbol):
        return {"tick_size": 0.1, "tick_value": 1.0, "min_volume": 0.01,
                "max_volume": 100.0, "volume_step": 0.01}

    def market_order(self, symbol, side, volume, stop_loss=0.0, take_profit=0.0):
        self.orders.append({"symbol": symbol, "side": side, "volume": volume,
                            "stop_loss": stop_loss, "take_profit": take_profit})
        return {"orderId": "1", "positionId": "1"}


def test_indices_trader_opens_sized_lot():
    from app.saas.indices import IndicesTrader
    bk = FakeBroker(10_000.0)
    out = IndicesTrader(bk, FakeStrategy("long"), risk_pct=1.0, symbols=["US500"], dry=False).run_once()
    assert out["error"] is None
    assert len(bk.orders) == 1
    assert bk.orders[0]["symbol"] == "US500" and bk.orders[0]["side"] == "Buy"
    assert abs(bk.orders[0]["volume"] - 0.5) < 1e-9


def test_indices_trader_dry_run_places_nothing():
    from app.saas.indices import IndicesTrader
    bk = FakeBroker(10_000.0)
    out = IndicesTrader(bk, FakeStrategy("long"), risk_pct=1.0, symbols=["US500"], dry=True).run_once()
    assert bk.orders == []
    assert out["opened"] and out["opened"][0]["dry"] is True


# ── endpoints ───────────────────────────────────────────────
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


def test_indices_gated_when_disabled(client):
    object.__setattr__(settings, "indices_enabled", False)
    client.post("/app/api/register", json={"email": "i@b.com", "password": "password1"})
    d = client.get("/app/api/indices").json()
    assert d["available"] is False and d["connected"] is False
    assert client.post("/app/api/indices/connect",
                       json={"token": "x" * 10, "account_id": "a1"}).status_code == 400


def test_indices_connect_and_settings_when_enabled(client):
    object.__setattr__(settings, "indices_enabled", True)
    try:
        client.post("/app/api/register", json={"email": "j@b.com", "password": "password1"})
        r = client.post("/app/api/indices/connect",
                        json={"token": "tok-abcdefgh", "account_id": "acc-1"})
        assert r.status_code == 200, r.text
        d = client.get("/app/api/indices").json()
        assert d["connected"] is True and d["account_id"] == "acc-1"
        assert client.post("/app/api/indices/settings",
                           json={"risk_pct": 1.5, "symbols": "US500,USTEC", "enabled": True}).status_code == 200
        d2 = client.get("/app/api/indices").json()
        assert d2["settings"]["enabled"] is True and d2["settings"]["risk_pct"] == 1.5
    finally:
        object.__setattr__(settings, "indices_enabled", False)
