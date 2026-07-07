"""Sniper shadow worker: feed parsing, reject-by-default, paper ledger, restarts."""
from __future__ import annotations

import json
import pathlib
import sys
import time

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.saas.sniper import (  # noqa: E402
    MintState, PumpFeed, SniperProvider, SniperService,
)
from app.saas.memestrategy import TokenSafety  # noqa: E402
from app.saas.store import Store  # noqa: E402

SMART = "TrackedWa11etAddr355xxxxxxxxxxxxxxxxxxxxxxx"


def _feed_with_token(mint="MintA", smart_buys=3, age_s=120) -> PumpFeed:
    feed = PumpFeed(tracked_wallets=[SMART])
    feed.handle({"txType": "create", "mint": mint, "symbol": "TEST",
                 "traderPublicKey": "creator1"})
    feed.mints[mint].first_seen = time.time() - age_s   # age it past min_age
    for _ in range(smart_buys):
        feed.handle({"txType": "buy", "mint": mint, "traderPublicKey": SMART,
                     "solAmount": 1.0, "tokenAmount": 1_000_000})
    for _ in range(20):
        feed.handle({"txType": "buy", "mint": mint, "traderPublicKey": "rando",
                     "solAmount": 1.0, "tokenAmount": 1_000_000})
    return feed


def good_enricher(mint, state):
    """Stand-in for a real RugCheck/Helius enricher: verified-safe token."""
    return (TokenSafety(can_sell=True, mint_renounced=True, freeze_revoked=True,
                        lp_locked_or_burned=True, top_holder_pct=8,
                        dev_holder_pct=2, rug_score=85),
            {"liquidity_sol": 20.0, "social_score": 0.7})


# ── feed parsing ────────────────────────────────────────────
def test_feed_parses_create_and_trades_and_smart_money():
    feed = _feed_with_token()
    st = feed.mints["MintA"]
    assert st.symbol == "TEST" and st.buys == 23 and st.smart_buys == 3
    assert abs(st.last_price - 1e-6) < 1e-12          # 1 SOL / 1M tokens
    assert st.vol_sol == 23.0


def test_feed_survives_malformed_events_and_prunes():
    feed = PumpFeed()
    for bad in ({}, {"mint": 5}, {"txType": "buy"}, {"mint": "X", "txType": "buy",
                                                     "solAmount": "abc"}):
        feed.handle(bad)                               # must not raise
    feed.handle({"txType": "create", "mint": "Old"})
    feed.mints["Old"].first_seen = time.time() - 4000
    feed.prune(older_than_s=1800)
    assert "Old" not in feed.mints


# ── reject-by-default ───────────────────────────────────────
def test_without_enrichment_nothing_is_bought():
    feed = _feed_with_token()
    st = Store(path=":memory:")
    svc = SniperService(st, SniperProvider(feed, min_age_s=30))  # default enricher
    stats = svc.cycle()
    assert stats["opened_now"] == 0 and svc.positions == {}
    assert st.sniper_events() == []                    # no paper rows either


# ── paper open + exit + persistence ─────────────────────────
def test_enriched_token_opens_paper_position_and_derisks():
    feed = _feed_with_token()
    st = Store(path=":memory:")
    svc = SniperService(st, SniperProvider(feed, enricher=good_enricher, min_age_s=30))
    stats = svc.cycle()
    assert stats["opened_now"] == 1 and "MintA" in svc.positions
    rows = st.sniper_events()
    assert rows[0]["action"] == "open" and rows[0]["mint"] == "MintA"
    assert rows[0]["size_sol"] > 0 and rows[0]["price_sol"] > 0

    # Restart: a NEW service on the same store must reload the open position.
    svc2 = SniperService(st, SniperProvider(feed, enricher=good_enricher, min_age_s=30))
    assert "MintA" in svc2.positions

    # Price doubles -> hold-mode de-risk (sell enough to recover the cost).
    feed.handle({"txType": "buy", "mint": "MintA", "traderPublicKey": "rando",
                 "solAmount": 2.0, "tokenAmount": 1_000_000})
    svc2.cycle()
    actions = [r for r in st.sniper_events() if r["action"] == "sell_fraction"]
    assert actions and "de-risk" in actions[0]["reason"]
    assert svc2.positions["MintA"].recovered is True


def test_stale_position_is_swept():
    feed = _feed_with_token()
    st = Store(path=":memory:")
    svc = SniperService(st, SniperProvider(feed, enricher=good_enricher, min_age_s=30))
    svc.cycle()
    svc.opened_at["MintA"] = time.time() - 25 * 3600   # pretend it's a day old
    feed.mints.pop("MintA")                            # and its feed died
    svc.cycle()
    assert "MintA" not in svc.positions
    assert any(r["action"] == "sell_all" and "stale" in r["reason"]
               for r in st.sniper_events())


# ── flags / plumbing ────────────────────────────────────────
def test_worker_exits_when_flag_off():
    import sniper_worker
    prev = sniper_worker.settings.sniper_enabled
    object.__setattr__(sniper_worker.settings, "sniper_enabled", False)
    try:
        assert sniper_worker.main() == 0               # dormant, clean exit
    finally:
        object.__setattr__(sniper_worker.settings, "sniper_enabled", prev)


def test_settings_migration_has_sniper_flag():
    st = Store(path=":memory:")
    assert st.get_settings(1).get("sniper_enabled") == 0


@pytest.fixture()
def client(tmp_path):
    # Patch the LIVE config module: earlier suite files (test_saas_dashboard,
    # test_auth) reload app.config, so the settings object this file imported
    # at collection time can be a stale instance the routes no longer read.
    import app.config as _cfg
    targets = [settings] if settings is _cfg.settings else [settings, _cfg.settings]
    for target in targets:
        for k, v in {"saas_db_path": str(tmp_path / "t.db"),
                     "saas_secret_key": "test-secret", "saas_seat_limit": 5,
                     "saas_admin_email": "admin@z.com"}.items():
            object.__setattr__(target, k, v)
    import app.saas.routes as r
    r._store = None
    # The per-IP register rate limit is process-global and TestClient always
    # presents the same fake IP — by this point in the suite the bucket is
    # full, so clear it for a deterministic fixture.
    r._rl_buckets.clear()
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def test_admin_sniper_endpoint(client):
    client.post("/app/api/register", json={"email": "u@b.com", "password": "password1"})
    assert client.get("/app/api/admin/sniper").status_code == 403   # admin only
    client.cookies.clear()
    client.post("/app/api/register", json={"email": "admin@z.com", "password": "password1"})
    d = client.get("/app/api/admin/sniper").json()
    assert d["enabled"] is False and d["events"] == [] and isinstance(d["stats"], dict)
