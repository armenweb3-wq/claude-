"""SaaS per-user dashboard endpoint + live snapshot helpers (no network)."""
from __future__ import annotations

import importlib
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


def _client(monkeypatch, tmp_path):
    monkeypatch.setenv("SAAS_ADMIN_EMAIL", "boss@test.com")
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


def test_dashboard_endpoint_for_admin(monkeypatch, tmp_path):
    cl = _client(monkeypatch, tmp_path)
    cl.post("/app/api/register", json={"email": "boss@test.com", "password": "bosspass1"})
    d = cl.get("/app/api/dashboard").json()
    # Admin is auto-active; cycle context is always present; no keys yet → flat.
    assert d["active"] is True
    assert d["has_keys"] is False
    assert d["positions"] == []
    assert "phase" in d["cycle"]
    assert set(["equity", "open_pnl", "open_positions", "signals"]).issubset(d)


def test_history_endpoint_without_keys(monkeypatch, tmp_path):
    cl = _client(monkeypatch, tmp_path)
    cl.post("/app/api/register", json={"email": "boss@test.com", "password": "bosspass1"})
    h = cl.get("/app/api/history").json()
    assert h["trades"] == []
    assert h["stats"]["total"] == 0


def test_app_shell_has_dashboard_markup(monkeypatch, tmp_path):
    cl = _client(monkeypatch, tmp_path)
    html = cl.get("/app").text
    for marker in ("statsCard", "positionsCard", "signalsCard", "loadDashboard"):
        assert marker in html
