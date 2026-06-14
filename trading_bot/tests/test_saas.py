"""Multi-user beta: auth, seat cap, key encryption, withdrawal rejection."""
from __future__ import annotations

import pathlib
import sys

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.saas import security  # noqa: E402
from app.saas.keycheck import parse_permissions  # noqa: E402


def test_password_hash_roundtrip():
    salt, h = security.hash_password("hunter2pass")
    assert security.verify_password("hunter2pass", salt, h)
    assert not security.verify_password("wrong", salt, h)


def test_key_encryption_roundtrip():
    enc = security.encrypt("my-secret-api-key")
    assert enc != "my-secret-api-key"
    assert security.decrypt(enc) == "my-secret-api-key"


def test_parse_permissions_rejects_withdrawal():
    res = {"readOnly": 0, "permissions": {"ContractTrade": ["Order", "Position"],
                                          "Wallet": ["AccountTransfer", "Withdraw"]}}
    p = parse_permissions(res)
    assert p["can_withdraw"] is True


def test_parse_permissions_trade_only_ok():
    res = {"readOnly": 0, "permissions": {"ContractTrade": ["Order", "Position"],
                                          "Wallet": ["AccountTransfer"]}}
    p = parse_permissions(res)
    assert p["can_trade"] and not p["can_withdraw"]


def test_parse_permissions_readonly_cannot_trade():
    res = {"readOnly": 1, "permissions": {"ContractTrade": []}}
    p = parse_permissions(res)
    assert not p["can_trade"]


@pytest.fixture()
def client(tmp_path):
    # settings is a frozen dataclass — set fields directly for the test
    for k, v in {"saas_db_path": str(tmp_path / "t.db"), "saas_secret_key": "test-secret",
                 "saas_seat_limit": 2, "saas_admin_email": "admin@z.com"}.items():
        object.__setattr__(settings, k, v)
    import app.saas.routes as r
    r._store = None  # force a fresh store on the temp path
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def test_register_login_me_flow(client):
    rr = client.post("/app/api/register", json={"email": "a@b.com", "password": "password1"})
    assert rr.status_code == 200, rr.text
    me = client.get("/app/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == "a@b.com"
    assert me.json()["has_keys"] is False


def test_seat_cap_enforced(client):
    client.post("/app/api/register", json={"email": "one@b.com", "password": "password1"})
    client.cookies.clear()
    client.post("/app/api/register", json={"email": "two@b.com", "password": "password1"})
    client.cookies.clear()
    third = client.post("/app/api/register", json={"email": "three@b.com", "password": "password1"})
    assert third.status_code == 403
    assert "full" in third.json()["detail"].lower()


def test_admin_bypasses_seat_cap_and_can_activate(client):
    client.post("/app/api/register", json={"email": "one@b.com", "password": "password1"})
    client.cookies.clear()
    client.post("/app/api/register", json={"email": "two@b.com", "password": "password1"})
    client.cookies.clear()
    # admin email registers even though seats are full
    adm = client.post("/app/api/register", json={"email": "admin@z.com", "password": "password1"})
    assert adm.status_code == 200 and adm.json()["is_admin"] is True
    users = client.get("/app/api/admin/users").json()["users"]
    uid = users[0]["id"]
    act = client.post("/app/api/admin/activate", json={"user_id": uid, "days": 30})
    assert act.status_code == 200
