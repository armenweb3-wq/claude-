"""Global kill switch: a persisted flag halts NEW entries for every user while
existing positions keep being managed. Admin-only to flip."""
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings  # noqa: E402
from app.saas.runner import MultiUserRunner  # noqa: E402
from app.saas.store import Store  # noqa: E402


# ── the flag itself ─────────────────────────────────────────
def test_flag_defaults_off_and_round_trips():
    st = Store(path=":memory:")
    assert st.trading_halted() is False
    st.set_trading_halted(True, by="admin@z.com")
    assert st.trading_halted() is True
    assert st.get_meta("trading_halted_by") == "admin@z.com"
    st.set_trading_halted(False)
    assert st.trading_halted() is False


# ── the runner respects it ──────────────────────────────────
def test_run_cycle_short_circuits_when_halted():
    st = Store(path=":memory:")
    st.set_trading_halted(True)
    runner = MultiUserRunner(st)
    # If run_cycle tried to trade it would call list_users — make that explode.
    def boom(*a, **k):
        raise AssertionError("run_cycle must not touch users while halted")
    runner.store.list_users = boom
    runner.run_cycle()          # returns cleanly — no entries attempted
    runner.run_indices_cycle()  # indices entries are gated too


def test_run_cycle_runs_when_not_halted():
    st = Store(path=":memory:")
    called = {"n": 0}
    runner = MultiUserRunner(st)
    def spy(*a, **k):
        called["n"] += 1
        return []
    runner.store.list_users = spy
    runner.run_cycle()          # not halted -> it iterates users (empty list)
    assert called["n"] >= 1


# ── admin endpoint ──────────────────────────────────────────
@pytest.fixture()
def client(tmp_path):
    import app.config as _cfg
    targets = [settings] if settings is _cfg.settings else [settings, _cfg.settings]
    for target in targets:
        for k, v in {"saas_db_path": str(tmp_path / "t.db"),
                     "saas_secret_key": "test-secret", "saas_seat_limit": 5,
                     "saas_admin_email": "admin@z.com"}.items():
            object.__setattr__(target, k, v)
    import app.saas.routes as r
    r._store = None
    r._rl_buckets.clear()
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def test_kill_endpoint_admin_only_and_toggles(client):
    # a normal user cannot see or flip it
    client.post("/app/api/register", json={"email": "u@b.com", "password": "password1"})
    assert client.get("/app/api/admin/kill").status_code == 403
    assert client.post("/app/api/admin/kill", json={"halted": True}).status_code == 403
    client.cookies.clear()
    # admin can
    client.post("/app/api/register", json={"email": "admin@z.com", "password": "password1"})
    assert client.get("/app/api/admin/kill").json()["halted"] is False
    r = client.post("/app/api/admin/kill", json={"halted": True}).json()
    assert r["ok"] is True and r["halted"] is True
    got = client.get("/app/api/admin/kill").json()
    assert got["halted"] is True and got["by"] == "admin@z.com" and got["at"]
    assert client.post("/app/api/admin/kill", json={"halted": False}).json()["halted"] is False
