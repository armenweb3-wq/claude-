"""Memecoins market: Solana wallet generation + dedicated-wallet endpoints."""
from __future__ import annotations

import pathlib
import sys

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.saas.solana_wallet import b58decode, b58encode, generate_wallet  # noqa: E402


# ── wallet generation (pure) ────────────────────────────────
def test_base58_roundtrip():
    for raw in (b"\x00\x01\x02", b"hello world", bytes(range(32))):
        assert b58decode(b58encode(raw)) == raw


def test_generate_wallet_shapes():
    w = generate_wallet()
    pub = b58decode(w["address"])
    sec = b58decode(w["secret_key"])
    assert len(pub) == 32            # Solana address = 32-byte ed25519 pubkey
    assert len(sec) == 64            # Solflare import = seed(32) + pubkey(32)
    assert sec[32:] == pub           # secret's trailing 32 bytes == the address


def test_generated_wallets_are_unique():
    assert generate_wallet()["address"] != generate_wallet()["address"]


# ── endpoints ───────────────────────────────────────────────
@pytest.fixture()
def client(tmp_path):
    for k, v in {"saas_db_path": str(tmp_path / "t.db"), "saas_secret_key": "test-secret",
                 "saas_seat_limit": 5, "saas_admin_email": "admin@z.com"}.items():
        object.__setattr__(settings, k, v)
    import app.saas.routes as r
    r._store = None
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def test_memecoins_gated_when_disabled(client):
    object.__setattr__(settings, "memecoins_enabled", False)
    client.post("/app/api/register", json={"email": "k@b.com", "password": "password1"})
    assert client.get("/app/api/memecoins").json()["available"] is False
    # Can't create a wallet while the market is off.
    assert client.post("/app/api/memecoins/wallet", json={"agreed": True}).status_code == 400


def test_admin_can_use_memecoins_in_preview(client):
    # Market switch OFF, but the admin can still create a wallet (preview/test).
    object.__setattr__(settings, "memecoins_enabled", False)
    client.post("/app/api/register", json={"email": "admin@z.com", "password": "password1"})
    r = client.post("/app/api/memecoins/wallet", json={"agreed": True})
    assert r.status_code == 200 and len(b58decode(r.json()["address"])) == 32


def test_memecoins_trade_endpoints_gated(client):
    object.__setattr__(settings, "memecoins_enabled", True)
    try:
        client.post("/app/api/register", json={"email": "t@b.com", "password": "password1"})
        # No wallet yet → buy is rejected.
        good_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"  # USDC mint (valid base58)
        r = client.post("/app/api/memecoins/buy", json={"mint": good_mint, "sol_amount": 0.1})
        assert r.status_code == 400
        # Invalid mint is rejected up front.
        client.post("/app/api/memecoins/wallet", json={"agreed": True})
        assert client.post("/app/api/memecoins/buy",
                           json={"mint": "not-a-mint", "sol_amount": 0.1}).status_code == 400
        # Invalid withdraw destination rejected.
        assert client.post("/app/api/memecoins/withdraw",
                           json={"destination": "xx"}).status_code == 400
    finally:
        object.__setattr__(settings, "memecoins_enabled", False)


# ── Jupiter executor (fake HTTP + stubbed signing) ──────────
def test_executor_reads_and_buys():
    from app.saas.solana_exec import JupiterExecutor, SOL_MINT
    from app.saas.solana_wallet import generate_wallet
    w = generate_wallet()
    calls = {"quote": None, "swap": None}

    def http(method, url, params=None, json=None):
        if url.endswith("/getBalance" ) or (json and json.get("method") == "getBalance"):
            return {"result": {"value": 2_000_000_000}}  # 2 SOL
        if json and json.get("method") == "getTokenAccountsByOwner":
            return {"result": {"value": [{"account": {"data": {"parsed": {"info": {
                "mint": "MintX", "tokenAmount": {"uiAmount": 5.0, "amount": "5000000", "decimals": 6}}}}}}]}}
        if url.endswith("/v6/quote"):
            calls["quote"] = params
            return {"outAmount": "123", "inAmount": str(params["amount"])}
        if url.endswith("/v6/swap"):
            calls["swap"] = json
            return {"swapTransaction": "base64tx"}
        return {}

    ex = JupiterExecutor(w["secret_key"], "https://rpc", "https://jup", http=http)
    ex._sign_and_send = lambda tx: "SIGNATURE"  # stub signing (no solders/network)

    assert ex.pubkey == w["address"]               # derived without the signing lib
    assert ex.get_balance_sol() == 2.0
    tokens = ex.get_token_balances()
    assert tokens[0]["mint"] == "MintX" and tokens[0]["raw"] == 5000000

    sig = ex.buy("MintX", 0.5, slippage_bps=150)
    assert sig == "SIGNATURE"
    assert calls["quote"]["inputMint"] == SOL_MINT and calls["quote"]["amount"] == 500_000_000
    assert calls["quote"]["outputMint"] == "MintX" and calls["quote"]["slippageBps"] == 150
    assert calls["swap"]["userPublicKey"] == w["address"]


def test_memecoins_wallet_lifecycle(client):
    object.__setattr__(settings, "memecoins_enabled", True)
    try:
        client.post("/app/api/register", json={"email": "l@b.com", "password": "password1"})
        # Must accept the disclaimer.
        assert client.post("/app/api/memecoins/wallet", json={"agreed": False}).status_code == 400
        r = client.post("/app/api/memecoins/wallet", json={"agreed": True})
        assert r.status_code == 200
        addr = r.json()["address"]
        assert len(b58decode(addr)) == 32
        # Idempotent — same wallet returned, not a new one.
        assert client.post("/app/api/memecoins/wallet", json={"agreed": True}).json()["address"] == addr
        # Status now shows the wallet.
        d = client.get("/app/api/memecoins").json()
        assert d["wallet"]["address"] == addr and d["settings"]["agreed"] is True
        # Export key matches the address (seed+pubkey form).
        sec = client.get("/app/api/memecoins/secret").json()["secret_key"]
        assert b58decode(sec)[32:] == b58decode(addr)
        # Settings save.
        assert client.post("/app/api/memecoins/settings",
                           json={"risk_pct": 8, "enabled": True, "agreed": True}).status_code == 200
        assert client.get("/app/api/memecoins").json()["settings"]["enabled"] is True
    finally:
        object.__setattr__(settings, "memecoins_enabled", False)
