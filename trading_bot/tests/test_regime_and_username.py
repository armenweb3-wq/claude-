"""Regime-flip auto-close + username on registration."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings
from app.exchange.base import Position
from app.strategy.market_filter import MarketBias


def test_regime_flip_closes_only_profitable_blocked_side(monkeypatch):
    from app.core.bot import TradingBot

    bot = TradingBot()
    calls = []
    monkeypatch.setattr(bot.exchange, "close_position", lambda s: calls.append(s))

    positions = {
        # profitable short — should close (shorts blocked)
        "XLMUSDT": Position("XLMUSDT", "Sell", 100, 0.19, unrealised_pnl=5.0),
        # losing short — keep (let its stop handle it)
        "OPUSDT": Position("OPUSDT", "Sell", 50, 0.10, unrealised_pnl=-2.0),
        # profitable long — keep (longs still allowed)
        "SOLUSDT": Position("SOLUSDT", "Buy", 1, 100.0, unrealised_pnl=5.0),
    }
    market = MarketBias("bull", True, False, 3.6, "BTC pumping — shorts paused")

    closed = bot._close_blocked_in_profit(positions, market)
    assert closed == 1
    assert calls == ["XLMUSDT"]


def _saas_client(tmp_path):
    # Mirror test_saas.py: set fields on the shared settings singleton (no module
    # reloads, which would swap the singleton other tests reference).
    for k, v in {"saas_db_path": str(tmp_path / "t.db"), "saas_secret_key": "test-secret",
                 "saas_seat_limit": 25, "saas_admin_email": "admin@z.com"}.items():
        object.__setattr__(settings, k, v)
    import app.saas.routes as r
    r._store = None  # fresh store on the temp path
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def test_username_saved_on_registration(tmp_path):
    cl = _saas_client(tmp_path)
    cl.post("/app/api/register",
            json={"email": "f@t.com", "password": "pw123456", "username": "cooltrader"})
    assert cl.get("/app/api/me").json()["username"] == "cooltrader"


def test_username_defaults_from_email(tmp_path):
    cl = _saas_client(tmp_path)
    cl.post("/app/api/register", json={"email": "alice@t.com", "password": "pw123456"})
    assert cl.get("/app/api/me").json()["username"] == "alice"


def test_manual_trade_guards(tmp_path):
    cl = _saas_client(tmp_path)
    object.__setattr__(settings, "saas_dry_run", True)
    # admin (auto-active) but no keys connected
    cl.post("/app/api/register",
            json={"email": "admin@z.com", "password": "pw123456", "username": "boss"})
    # manual open blocked while engine is in test mode
    r = cl.post("/app/api/position/open",
                json={"symbol": "SOLUSDT", "side": "long", "notional": 10,
                      "leverage": 3, "stop_pct": 3})
    assert r.status_code == 400 and "test mode" in r.json()["detail"]
    # manual close requires connected keys
    r2 = cl.post("/app/api/position/close", json={"symbol": "SOLUSDT"})
    assert r2.status_code == 400 and "keys" in r2.json()["detail"]


def test_profile_password_and_referral(tmp_path):
    cl = _saas_client(tmp_path)
    # referrer
    cl.post("/app/api/register",
            json={"email": "ref@t.com", "password": "pw123456", "username": "alpha"})
    cl.post("/app/api/logout")
    # referred user joins via ref, updates profile + password
    cl.post("/app/api/register",
            json={"email": "f@t.com", "password": "pw123456", "username": "bob", "ref": "alpha"})
    assert cl.post("/app/api/profile",
                   json={"username": "bobby", "avatar": "data:image/png;base64,AAA"}).status_code == 200
    assert cl.post("/app/api/password", json={"new_password": "newpass12"}).status_code == 200
    me = cl.get("/app/api/me").json()
    assert me["username"] == "bobby" and me["avatar"]
    # too-short password rejected
    assert cl.post("/app/api/password", json={"new_password": "short"}).status_code == 400
    cl.post("/app/api/logout")
    # referrer sees the referral counted, and can log in with... referred user's new pw
    cl.post("/app/api/login", json={"email": "ref@t.com", "password": "pw123456"})
    assert cl.get("/app/api/me").json()["referral_count"] == 1
