"""RugCheck enricher: approves a clean token, and REJECTS on every failure mode
(bad authority, honeypot risk, no holders, network error). Reject-on-doubt is
the whole safety contract, so the reject paths matter most."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app.saas.enricher as enr  # noqa: E402
from app.saas.enricher import RugcheckEnricher, make_enricher  # noqa: E402
from app.saas.memestrategy import SafetyScreen, TokenMetrics  # noqa: E402


class _State:
    creator = "CreatorAddr"


class _Resp:
    def __init__(self, payload, status=200):
        self._p, self.status_code = payload, status

    def json(self):
        return self._p


def _clean_report():
    return {
        "token": {"mintAuthority": None, "freezeAuthority": None},
        "risks": [],
        "markets": [{"lp": {"lpLockedPct": 100}}],
        "topHolders": [{"address": "whale", "pct": 9.0},
                       {"address": "poolX", "pct": 60.0, "isLp": True}],
        "totalMarketLiquidity": 1500.0,   # USD -> /150 = 10 SOL
    }


def _patch(monkeypatch, payload, status=200, boom=False):
    def fake_get(*a, **k):
        if boom:
            raise RuntimeError("network down")
        return _Resp(payload, status)
    monkeypatch.setattr(enr, "requests", type("R", (), {"get": staticmethod(fake_get)}))


def _passes(monkeypatch, payload):
    _patch(monkeypatch, payload)
    safety, extra = RugcheckEnricher()("MintX", _State())
    m = TokenMetrics(liquidity_sol=extra.get("liquidity_sol", 0.0))
    return SafetyScreen().check(safety, m)


def test_clean_token_is_approved(monkeypatch):
    ok, why = _passes(monkeypatch, _clean_report())
    assert ok, why
    # the LP pool (60%) is excluded from top-holder concentration; whale=9% used
    _patch(monkeypatch, _clean_report())
    safety, extra = RugcheckEnricher()("MintX", _State())
    assert safety.top_holder_pct == 9.0 and extra["liquidity_sol"] == 10.0


def test_live_mint_authority_is_rejected(monkeypatch):
    rep = _clean_report(); rep["token"]["mintAuthority"] = "SomeAuthority"
    ok, why = _passes(monkeypatch, rep)
    assert not ok and "mint" in why.lower()


def test_missing_authority_key_is_rejected(monkeypatch):
    rep = _clean_report(); rep["token"] = {}   # unknown == unsafe
    ok, _ = _passes(monkeypatch, rep)
    assert not ok


def test_honeypot_risk_blocks_can_sell(monkeypatch):
    rep = _clean_report(); rep["risks"] = [{"name": "Transfer Fee", "level": "danger"}]
    ok, why = _passes(monkeypatch, rep)
    assert not ok  # both can_sell False AND rug score tanked by the danger risk


def test_unlocked_lp_is_rejected(monkeypatch):
    rep = _clean_report(); rep["markets"] = [{"lp": {"lpLockedPct": 10}}]
    ok, why = _passes(monkeypatch, rep)
    assert not ok and "lp" in why.lower()


def test_no_holders_is_rejected(monkeypatch):
    rep = _clean_report(); rep["topHolders"] = []
    ok, _ = _passes(monkeypatch, rep)
    assert not ok


def test_network_error_rejects(monkeypatch):
    _patch(monkeypatch, {}, boom=True)
    safety, extra = RugcheckEnricher()("MintX", _State())
    ok, _ = SafetyScreen().check(safety, TokenMetrics())
    assert not ok and extra == {}


def test_non_200_rejects(monkeypatch):
    _patch(monkeypatch, _clean_report(), status=429)
    safety, extra = RugcheckEnricher()("MintX", _State())
    ok, _ = SafetyScreen().check(safety, TokenMetrics())
    assert not ok and extra == {}


def test_make_enricher_selects_by_config():
    class S:
        meme_enricher = "rugcheck"; sol_price_usd = 150.0
    assert isinstance(make_enricher(S()), RugcheckEnricher)
    class S2:
        meme_enricher = ""
    assert make_enricher(S2()) is None
