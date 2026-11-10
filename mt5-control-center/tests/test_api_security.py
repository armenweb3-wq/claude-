"""The local API must refuse anything that does not carry the access key,
comes from another origin, or targets an unexpected Host header."""
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mt5cc.config import AccountConfig, Settings
from mt5cc.server import create_app
from mt5cc.store import EquityStore
from mt5cc.supervisor import AccountState, Supervisor

TOKEN = "t" * 48


class FakeSupervisor(Supervisor):
    """Supervisor without real subprocesses."""
    def __init__(self, accounts, settings):
        self.settings = settings
        self.states = {a.id: AccountState(cfg=a) for a in accounts}
        self._procs, self._cmd_qs, self._out_qs, self.listeners = {}, {}, {}, []
        st = self.states["a1"]
        st.state, st.account = "connected", {"login": 1, "currency": "USD", "balance": 100.0, "equity": 100.0, "profit": 0.0, "margin": 0.0, "margin_free": 100.0}
        st.last_snapshot_ts = st.last_heartbeat_ts = time.time()
    def send_command(self, acc_id, cmd):
        return True


@pytest.fixture
def client(tmp_path: Path):
    settings = Settings()
    accounts = [AccountConfig(id="a1", label="A", mock=True)]
    sup = FakeSupervisor(accounts, settings)
    app = create_app(sup, settings, TOKEN, EquityStore(tmp_path / "eq.sqlite"))
    return TestClient(app, base_url=f"http://127.0.0.1:{settings.server.port}")


def test_api_requires_token(client):
    r = client.get("/api/overview")
    assert r.status_code == 401


def test_api_rejects_wrong_token(client):
    assert client.get("/api/overview", headers={"x-api-token": "nope"}).status_code == 401


def test_api_accepts_header_token_and_sets_security_headers(client):
    r = client.get("/api/overview", headers={"x-api-token": TOKEN})
    assert r.status_code == 200
    assert r.headers["content-security-policy"].startswith("default-src 'self'")
    assert r.headers["x-frame-options"] == "DENY"
    body = r.json()
    assert body["accounts"][0]["account"]["balance"] == 100.0
    assert "password" not in str(body).lower().replace("password_source", "")


def test_auth_link_sets_cookie_and_cookie_works(client):
    r = client.get(f"/auth?token={TOKEN}", follow_redirects=False)
    assert r.status_code == 303 and "mt5cc_session" in r.cookies
    assert client.get("/api/overview").status_code == 200   # cookie jar carries it


def test_cross_site_requests_blocked_even_with_cookie(client):
    client.get(f"/auth?token={TOKEN}", follow_redirects=False)
    r = client.get("/api/overview", headers={"sec-fetch-site": "cross-site"})
    assert r.status_code == 403


def test_dns_rebinding_host_rejected(client):
    r = client.get("/api/overview", headers={"x-api-token": TOKEN, "host": "evil.example.com"})
    assert r.status_code == 421


def test_no_api_docs_exposed(client):
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404


def test_csv_export_requires_token(client):
    assert client.get("/api/accounts/a1/trades.csv").status_code == 401
    r = client.get("/api/accounts/a1/trades.csv", headers={"x-api-token": TOKEN})
    assert r.status_code == 200 and r.text.startswith("account,position_id,symbol")


# --------------------------------------------------------------------------- #
# Trading endpoints
# --------------------------------------------------------------------------- #

def test_trading_endpoints_refuse_when_disabled(client):
    h = {"x-api-token": TOKEN}
    assert client.post("/api/accounts/a1/orders/preview", json={"symbol": "EURUSD", "side": "BUY"}, headers=h).status_code == 403
    assert client.post("/api/accounts/a1/orders", json={"symbol": "EURUSD"}, headers=h).status_code == 403
    assert client.post("/api/accounts/a1/positions/1/close", json={"confirm": True}, headers=h).status_code == 403
    assert client.post("/api/accounts/a1/positions/1/modify", json={"sl": 1}, headers=h).status_code == 403


@pytest.fixture
def trading_client(tmp_path: Path, monkeypatch):
    from mt5cc import server as srv
    monkeypatch.setattr(srv, "DATA_DIR", tmp_path)
    settings = Settings(trading_enabled=True)
    from mt5cc.config import TradingConfig
    accounts = [AccountConfig(id="a1", label="A", mock=True, trading=TradingConfig(enabled=True, max_risk_percent=2, max_lots=1))]
    sup = FakeSupervisor(accounts, settings)
    calls = []

    def fake_call(acc_id, name, args=None, timeout=20.0):
        calls.append((name, args))
        if name == "trade_preview":
            return {"ok": True, "data": {"plan": {"symbol": "EURUSD", "order_type": 0, "volume": 0.5}, "request": {}, "check": {"retcode": 0}, "check_ok": True, "check_text": "OK", "account": {}, "symbol": {}}}
        if name == "trade_execute":
            return {"ok": True, "data": {"ok": True, "plan": {}, "request": {}, "result": {"retcode": 10009}, "result_text": "Request completed"}}
        if name == "close_position":
            return {"ok": True, "data": {"ok": True, "result": {"retcode": 10009}, "result_text": "Request completed"}}
        return {"ok": False, "error": "boom", "rejected": True}
    sup.call = fake_call
    app = srv.create_app(sup, settings, TOKEN, EquityStore(tmp_path / "eq.sqlite"))
    c = TestClient(app, base_url=f"http://127.0.0.1:{settings.server.port}")
    c.headers.update({"x-api-token": TOKEN})
    c.calls = calls
    c.audit_path = tmp_path / "trading-audit.jsonl"
    return c


def test_order_requires_fresh_matching_intent(trading_client):
    c = trading_client
    req = {"symbol": "EURUSD", "side": "BUY", "sizing": "risk", "risk_percent": 1, "sl_mode": "points", "sl": 200}
    pv = c.post("/api/accounts/a1/orders/preview", json=req).json()
    assert pv["intent"]["sig"] and pv["check_ok"]
    # no intent
    assert c.post("/api/accounts/a1/orders", json=req).status_code == 400
    # tampered request
    r = c.post("/api/accounts/a1/orders", json={**req, "risk_percent": 2, "intent": pv["intent"]})
    assert r.status_code == 409
    # expired
    r = c.post("/api/accounts/a1/orders", json={**req, "intent": {**pv["intent"], "ts": pv["intent"]["ts"] - 1000}})
    assert r.status_code == 409
    # good
    r = c.post("/api/accounts/a1/orders", json={**req, "intent": pv["intent"], "expected": {"symbol": "EURUSD", "order_type": 0, "volume": 0.5}})
    assert r.status_code == 200 and r.json()["ok"]
    assert [n for n, _ in c.calls] == ["trade_preview", "trade_execute"]
    lines = c.audit_path.read_text().splitlines()
    assert len(lines) == 2 and '"stage": "result"' in lines[-1]


def test_close_needs_confirm_and_is_audited(trading_client):
    c = trading_client
    assert c.post("/api/accounts/a1/positions/42/close", json={}).status_code == 400
    r = c.post("/api/accounts/a1/positions/42/close", json={"confirm": True, "volume": 0.1})
    assert r.status_code == 200 and c.calls[-1] == ("close_position", {"ticket": 42, "volume": 0.1})


def test_worker_rejection_maps_to_422(trading_client):
    r = trading_client.post("/api/accounts/a1/positions/42/modify", json={"sl": 1})
    assert r.status_code == 422 and r.json()["detail"] == "boom"
