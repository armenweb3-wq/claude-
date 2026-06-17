"""Regime-flip auto-close + username on registration."""
from __future__ import annotations

import importlib
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

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


def _saas_client(monkeypatch, tmp_path):
    monkeypatch.setenv("SAAS_DB_PATH", str(tmp_path / "saas.db"))
    monkeypatch.delenv("DATABASE_URL", raising=False)
    import app.config as config
    importlib.reload(config)
    for mod in ["app.saas.store", "app.saas.routes", "app.saas", "app.main"]:
        if mod in sys.modules:
            importlib.reload(sys.modules[mod])
    import app.main as main
    main = importlib.reload(main)
    from fastapi.testclient import TestClient
    return TestClient(main.app)


def test_username_saved_on_registration(monkeypatch, tmp_path):
    cl = _saas_client(monkeypatch, tmp_path)
    cl.post("/app/api/register",
            json={"email": "f@t.com", "password": "pw123456", "username": "cooltrader"})
    assert cl.get("/app/api/me").json()["username"] == "cooltrader"


def test_username_defaults_from_email(monkeypatch, tmp_path):
    cl = _saas_client(monkeypatch, tmp_path)
    cl.post("/app/api/register", json={"email": "alice@t.com", "password": "pw123456"})
    assert cl.get("/app/api/me").json()["username"] == "alice"
