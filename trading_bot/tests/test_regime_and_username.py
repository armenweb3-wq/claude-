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
