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
