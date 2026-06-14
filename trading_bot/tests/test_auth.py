"""Control-API authentication tests (no network/DB needed)."""
from __future__ import annotations

import importlib
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


def _client(monkeypatch, api_key: str | None):
    if api_key is None:
        monkeypatch.delenv("CONTROL_API_KEY", raising=False)
    else:
        monkeypatch.setenv("CONTROL_API_KEY", api_key)

    # Reload config + app so the new env is picked up.
    import app.config as config
    importlib.reload(config)
    for mod in ["app.api.auth", "app.api.routes", "app.main"]:
        if mod in sys.modules:
            importlib.reload(sys.modules[mod])
    import app.main as main
    main = importlib.reload(main)

    from fastapi.testclient import TestClient

    return TestClient(main.app)


def test_health_always_open(monkeypatch):
    with _client(monkeypatch, api_key="secret") as c:
        assert c.get("/health").status_code == 200


def test_control_requires_key_when_configured(monkeypatch):
    with _client(monkeypatch, api_key="secret") as c:
        assert c.post("/control/pause").status_code == 401
        assert c.post("/control/pause", headers={"X-API-Key": "wrong"}).status_code == 401
        assert c.post("/control/pause", headers={"X-API-Key": "secret"}).status_code == 200


def test_control_open_when_no_key(monkeypatch):
    with _client(monkeypatch, api_key=None) as c:
        assert c.post("/control/pause").status_code == 200
