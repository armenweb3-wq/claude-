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


def test_monthly_summary_groups_and_dedups(tmp_path):
    cl = _saas_client(tmp_path)
    cl.post("/app/api/register", json={"email": "m@t.com", "password": "pw123456", "username": "mo"})
    from app.saas.routes import store
    st = store()
    uid = st.get_user_by_email("m@t.com")["id"]
    trades = [
        {"id": "1", "symbol": "SOLUSDT", "pnl": 5.0, "pnl_pct": 6.0, "closed_at": "2026-06-03T10:00:00+00:00"},
        {"id": "2", "symbol": "OPUSDT", "pnl": -2.0, "pnl_pct": -3.0, "closed_at": "2026-06-15T10:00:00+00:00"},
        {"id": "3", "symbol": "XRPUSDT", "pnl": 3.0, "pnl_pct": 4.0, "closed_at": "2026-05-20T10:00:00+00:00"},
    ]
    st.add_closed_trades(uid, trades)
    st.add_closed_trades(uid, trades)  # idempotent
    months = cl.get("/app/api/monthly").json()["months"]
    by = {m["month"]: m for m in months}
    assert by["2026-06"]["trades"] == 2 and by["2026-06"]["wins"] == 1 and by["2026-06"]["losses"] == 1
    assert by["2026-06"]["win_rate"] == 50.0 and by["2026-06"]["pnl"] == 3.0
    assert by["2026-05"]["trades"] == 1
    assert len(cl.get("/app/api/monthly_trades?month=2026-06").json()["trades"]) == 2


def test_partial_tp_fills_count_as_one_trade(tmp_path):
    cl = _saas_client(tmp_path)
    cl.post("/app/api/register", json={"email": "g@t.com", "password": "pw123456", "username": "g"})
    from app.saas.routes import store
    st = store()
    uid = st.get_user_by_email("g@t.com")["id"]
    # one SOL long taken off in 3 TP fills (same day) + a separate OP loss
    st.add_closed_trades(uid, [
        {"id": "a", "symbol": "SOLUSDT", "side": "Buy", "pnl": 1.8, "pnl_pct": 6, "closed_at": "2026-06-10T10:00:00+00:00"},
        {"id": "b", "symbol": "SOLUSDT", "side": "Buy", "pnl": 4.8, "pnl_pct": 12, "closed_at": "2026-06-10T12:00:00+00:00"},
        {"id": "c", "symbol": "SOLUSDT", "side": "Buy", "pnl": 6.0, "pnl_pct": 20, "closed_at": "2026-06-10T14:00:00+00:00"},
        {"id": "d", "symbol": "OPUSDT", "side": "Sell", "pnl": -2.0, "pnl_pct": -3, "closed_at": "2026-06-12T09:00:00+00:00"},
    ])
    jun = next(m for m in cl.get("/app/api/monthly").json()["months"] if m["month"] == "2026-06")
    assert jun["trades"] == 2  # not 4 — the 3 SOL fills count as one position
    assert jun["wins"] == 1 and jun["losses"] == 1
    sol = [t for t in cl.get("/app/api/monthly_trades?month=2026-06").json()["trades"] if t["symbol"] == "SOLUSDT"]
    assert len(sol) == 1 and abs(sol[0]["pnl"] - 12.6) < 1e-6


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
