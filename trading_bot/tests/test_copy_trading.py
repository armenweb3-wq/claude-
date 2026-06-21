"""Copy trading: leader-signal ledger + follower mirroring (proportional sizing,
mirrored closes, dry-run, skip-in-position, stale-entry protection)."""
from __future__ import annotations

import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.exchange.base import ExecutionResult, Position  # noqa: E402
from app.saas.copy import CopyTrader, record_leader_activity  # noqa: E402
from app.saas.store import Store  # noqa: E402


def _store() -> Store:
    # One persistent in-memory connection — schema + migrations run on init.
    return Store(path=":memory:")


# A leader open as UserTrader now emits it (entry/stop/TP/leverage/risk_pct).
_LEADER_OPEN = {
    "symbol": "BTCUSDT", "side": "Buy", "qty": 1.0,
    "entry": 100.0, "stop_loss": 97.0, "leverage": 5, "risk_pct": 2.0,
    "take_profits": [{"pct": 6, "close_fraction": 0.3, "price": 106.0},
                     {"pct": 12, "close_fraction": 0.4, "price": 112.0}],
}


def _seed_open_signal(st: Store) -> int:
    record_leader_activity(st, {"opened": [_LEADER_OPEN], "closed": []})
    sigs = st.open_leader_signals()
    return sigs[0]["id"]


class FollowerEx:
    """Minimal exchange double for a follower's account."""

    def __init__(self, equity: float = 1000.0):
        self._eq = equity
        self.pos: dict[str, Position] = {}
        self.opened: list[dict] = []
        self.closed_syms: list[str] = []

    def get_equity(self) -> float:
        return self._eq

    def get_position(self, symbol: str) -> Position:
        return self.pos.get(symbol, Position(symbol, None, 0.0, 0.0))

    def open_position(self, **kw) -> ExecutionResult:
        self.opened.append(kw)
        self.pos[kw["symbol"]] = Position(kw["symbol"], kw["side"], kw["qty"], 100.0)
        return ExecutionResult(ok=True, qty=kw["qty"], leverage=kw["leverage"])

    def close_position(self, symbol: str):
        self.closed_syms.append(symbol)
        self.pos.pop(symbol, None)

    def closed_pnl(self, limit: int = 100, start_ms=None) -> list[dict]:
        return []


def test_leader_open_recorded_and_idempotent():
    st = _store()
    record_leader_activity(st, {"opened": [_LEADER_OPEN], "closed": []})
    record_leader_activity(st, {"opened": [_LEADER_OPEN], "closed": []})  # same cycle repeat
    sigs = st.open_leader_signals()
    assert len(sigs) == 1
    assert sigs[0]["symbol"] == "BTCUSDT" and sigs[0]["status"] == "open"


def test_follower_mirrors_open_sized_to_balance():
    st = _store()
    sid = _seed_open_signal(st)
    ex = FollowerEx(equity=1000.0)  # risk 2% of 1000 = 20, stop dist 3 -> qty ~6.667
    out = CopyTrader(ex, st, user_id=2, dry=False, max_age_s=1e9, leverage_cap=5).run_once()
    assert out["error"] is None
    assert len(ex.opened) == 1
    o = ex.opened[0]
    assert o["symbol"] == "BTCUSDT" and o["side"] == "Buy"
    assert abs(o["qty"] - (20.0 / 3.0)) < 0.01      # proportional to follower equity
    assert o["stop_loss"] == 97.0
    assert st.has_copy_exec(sid, 2)


def test_smaller_balance_gets_proportionally_smaller_qty():
    st = _store()
    _seed_open_signal(st)
    small = FollowerEx(equity=100.0)
    CopyTrader(small, st, user_id=3, dry=False, max_age_s=1e9, leverage_cap=5).run_once()
    # 10x smaller balance -> ~10x smaller position (2% of 100 / 3).
    assert abs(small.opened[0]["qty"] - (2.0 / 3.0)) < 0.01


def test_skips_when_already_in_position():
    st = _store()
    sid = _seed_open_signal(st)
    ex = FollowerEx(equity=1000.0)
    ex.pos["BTCUSDT"] = Position("BTCUSDT", "Buy", 0.5, 100.0)
    CopyTrader(ex, st, user_id=4, dry=False, max_age_s=1e9, leverage_cap=5).run_once()
    assert ex.opened == []
    assert st.has_copy_exec(sid, 4)  # decision ledgered as skipped


def test_dry_run_places_no_orders_but_ledgers():
    st = _store()
    sid = _seed_open_signal(st)
    ex = FollowerEx(equity=1000.0)
    out = CopyTrader(ex, st, user_id=5, dry=True, max_age_s=1e9, leverage_cap=5).run_once()
    assert ex.opened == []
    assert out["opened"] and out["opened"][0]["dry"] is True
    assert st.has_copy_exec(sid, 5)


def test_mirrors_close_when_leader_closes():
    st = _store()
    _seed_open_signal(st)
    ex = FollowerEx(equity=1000.0)
    ct = CopyTrader(ex, st, user_id=6, dry=False, max_age_s=1e9, leverage_cap=5)
    ct.run_once()                       # follower opens
    assert ex.pos.get("BTCUSDT")
    # Leader closes the position (shows up in realised PnL).
    record_leader_activity(st, {"opened": [], "closed": [{"symbol": "BTCUSDT", "pnl_pct": 5.0}]})
    out = ct.run_once()                 # follower should mirror the close
    assert ex.closed_syms == ["BTCUSDT"]
    assert out["mirrored_closed"] == ["BTCUSDT"]
    assert st.open_copy_execs(6) == []


def test_stale_signal_is_not_chased():
    st = _store()
    sid = _seed_open_signal(st)
    # Age the signal well beyond the freshness window.
    st._q("UPDATE leader_signals SET opened_at=? WHERE id=?", (time.time() - 10_000, sid))
    ex = FollowerEx(equity=1000.0)
    out = CopyTrader(ex, st, user_id=7, dry=False, max_age_s=60, leverage_cap=5).run_once()
    assert ex.opened == []
    assert out["opened"] == []


# ── API endpoints ───────────────────────────────────────────
import pytest  # noqa: E402

from app.config import settings  # noqa: E402


@pytest.fixture()
def client(tmp_path):
    for k, v in {"saas_db_path": str(tmp_path / "t.db"), "saas_secret_key": "test-secret",
                 "saas_seat_limit": 5, "saas_admin_email": "admin@z.com"}.items():
        object.__setattr__(settings, k, v)
    import app.saas.routes as r
    r._store = None  # fresh store on the temp path
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def test_copy_endpoint_gated_when_disabled(client):
    object.__setattr__(settings, "copy_trading_enabled", False)
    client.post("/app/api/register", json={"email": "f@b.com", "password": "password1"})
    assert client.get("/app/api/copy").json()["available"] is False
    # Opting in is rejected while the platform switch is off.
    assert client.post("/app/api/copy", json={"enabled": True}).status_code == 400


def test_copy_opt_in_when_enabled(client):
    object.__setattr__(settings, "copy_trading_enabled", True)
    try:
        client.post("/app/api/register", json={"email": "g@b.com", "password": "password1"})
        assert client.get("/app/api/copy").json() == {"available": True, "copy_enabled": False}
        r = client.post("/app/api/copy", json={"enabled": True})
        assert r.status_code == 200 and r.json()["copy_enabled"] is True
        assert client.get("/app/api/copy").json()["copy_enabled"] is True
    finally:
        object.__setattr__(settings, "copy_trading_enabled", False)


def test_admin_members_health(client):
    # Admin registers first (admin@z.com per fixture), then a member joins.
    client.post("/app/api/register", json={"email": "admin@z.com", "password": "password1"})
    body = client.get("/app/api/admin/members").json()
    assert "summary" in body and "members" in body
    # Non-admin can't see member health.
    client.cookies.clear()
    client.post("/app/api/register", json={"email": "m1@b.com", "password": "password1"})
    assert client.get("/app/api/admin/members").status_code == 403
    # Admin now sees the member (not the admin) counted, with no keys yet.
    client.cookies.clear()
    client.post("/app/api/login", json={"email": "admin@z.com", "password": "password1"})
    body = client.get("/app/api/admin/members").json()
    assert body["summary"]["total"] == 1
    m1 = next(m for m in body["members"] if m["email"] == "m1@b.com")
    assert m1["has_keys"] is False and m1["is_admin"] is False
