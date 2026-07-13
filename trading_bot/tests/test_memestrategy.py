"""Memecoin strategy brain: safety screen, classifier, exit engine, orchestration."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.saas.memeengine import MemeEngine  # noqa: E402
from app.saas.memeproviders import Candidate  # noqa: E402
from app.saas.memestrategy import (  # noqa: E402
    PositionManager, Position, SafetyScreen, TokenMetrics, TokenSafety, classify,
)


def _safe() -> TokenSafety:
    return TokenSafety(can_sell=True, mint_renounced=True, freeze_revoked=True,
                       lp_locked_or_burned=True, top_holder_pct=10, dev_holder_pct=3,
                       rug_score=80)


# ── safety screen ───────────────────────────────────────────
def test_screen_passes_clean_token():
    ok, why = SafetyScreen().check(_safe(), TokenMetrics(liquidity_sol=10))
    assert ok, why


def test_screen_rejects_honeypot_and_rug_vectors():
    s = SafetyScreen()
    m = TokenMetrics(liquidity_sol=10)
    assert s.check(TokenSafety(**{**_safe().__dict__, "can_sell": False}), m)[0] is False
    assert s.check(TokenSafety(**{**_safe().__dict__, "mint_renounced": False}), m)[0] is False
    assert s.check(TokenSafety(**{**_safe().__dict__, "lp_locked_or_burned": False}), m)[0] is False
    assert s.check(TokenSafety(**{**_safe().__dict__, "top_holder_pct": 40}), m)[0] is False
    assert s.check(_safe(), TokenMetrics(liquidity_sol=0.5))[0] is False  # low liquidity


# ── classifier ──────────────────────────────────────────────
def test_classify_skips_weak_and_buys_strong():
    weak = TokenMetrics(buys_5m=2, sells_5m=5, volume_5m_sol=1)
    assert classify(weak, base_size_sol=0.1, max_size_sol=0.5).action == "skip"

    strong = TokenMetrics(buys_5m=40, sells_5m=5, volume_5m_sol=40,
                          smart_money_buys=3, social_score=0.7, holder_growth_5m=80)
    plan = classify(strong, base_size_sol=0.1, max_size_sol=0.5)
    assert plan.action == "buy" and plan.mode == "hold"   # insiders + social => hold
    assert 0.1 <= plan.size_sol <= 0.5


def test_classify_flip_for_momentum_without_conviction():
    # Strong velocity/volume but no insiders/social → qualifies, but as a flip.
    m = TokenMetrics(buys_5m=60, sells_5m=5, volume_5m_sol=60, smart_money_buys=0,
                     social_score=0.15, holder_growth_5m=150)
    plan = classify(m, base_size_sol=0.1, max_size_sol=0.5)
    assert plan.action == "buy" and plan.mode == "flip"


# ── position manager: the exit logic you described ──────────
def test_flip_takes_profit_at_target():
    pm = PositionManager(flip_target_x=1.8)
    p = Position("flip", entry_price=1.0, tokens=100, cost_sol=0.1)
    assert pm.decide(p, 1.9).kind == "sell_all"


def test_flip_stops_out_and_times_out():
    pm = PositionManager(flip_stop_x=0.6, flip_timeout_min=30)
    p = Position("flip", entry_price=1.0, tokens=100, cost_sol=0.1)
    assert pm.decide(p, 0.55).kind == "sell_all"                     # stop
    p2 = Position("flip", entry_price=1.0, tokens=100, cost_sol=0.1, age_minutes=31)
    assert pm.decide(p2, 1.2).kind == "sell_all"                     # timeout


def test_hold_derisks_to_recover_initial_then_keeps_moonbag():
    pm = PositionManager(hold_derisk_x=2.0)
    # entry 1.0, now 2.0, holds 100 tokens worth 200 cost-units; cost_sol basis 100.
    p = Position("hold", entry_price=1.0, tokens=100, cost_sol=100.0, peak_price=1.0)
    act = pm.decide(p, 2.0)
    assert act.kind == "sell_fraction"
    # value=100*2=200; recover 100 => sell 50% leaving a free moonbag.
    assert abs(act.fraction - 0.5) < 1e-6
    assert act.reason.startswith("de-risk")


def test_moonbag_trails_and_ladders():
    pm = PositionManager(trail_drop_pct=55, ladder=((5.0, 0.34), (10.0, 0.5)))
    # recovered moonbag, peaked at 10, now down 60% from peak -> trailing stop.
    p = Position("hold", entry_price=1.0, tokens=50, cost_sol=0.0, peak_price=10.0, recovered=True)
    assert pm.decide(p, 4.0).kind == "sell_all"
    # at 5x with no rungs taken -> ladder take-profit
    p2 = Position("hold", entry_price=1.0, tokens=50, cost_sol=0.0, peak_price=5.0, recovered=True)
    act = pm.decide(p2, 5.0)
    assert act.kind == "sell_fraction" and abs(act.fraction - 0.34) < 1e-6


def test_hold_stops_out_before_derisk():
    pm = PositionManager(hold_stop_x=0.5)
    p = Position("hold", entry_price=1.0, tokens=100, cost_sol=0.1)
    assert pm.decide(p, 0.45).kind == "sell_all"


# ── engine orchestration (fake provider + executor) ─────────
class FakeProvider:
    def __init__(self, candidates, prices=None):
        self._c = candidates
        self._p = prices or {}

    def discover(self, limit=20):
        return self._c

    def price(self, mint):
        return self._p.get(mint, 0.0)


class FakeExec:
    def __init__(self):
        self.buys = []
        self.sells = []

    def buy(self, mint, sol, slippage_bps=150):
        self.buys.append((mint, sol))

    def sell(self, mint, raw, slippage_bps=150):
        self.sells.append((mint, raw))


def test_engine_screens_classifies_and_opens():
    good = Candidate("MintGood", "GOOD", _safe(),
                     TokenMetrics(liquidity_sol=10, buys_5m=40, sells_5m=4,
                                  volume_5m_sol=40, smart_money_buys=3, social_score=0.7),
                     price_sol=0.001)
    scam = Candidate("MintScam", "SCAM",
                     TokenSafety(can_sell=False), TokenMetrics(liquidity_sol=10), price_sol=0.001)
    eng = MemeEngine(FakeProvider([scam, good]), FakeExec(),
                     base_size_sol=0.1, max_size_sol=0.5, dry=True)
    positions = {}
    opened = eng.find_and_open(positions)
    assert [o["mint"] for o in opened] == ["MintGood"]   # scam rejected
    assert "MintGood" in positions and positions["MintGood"].mode == "hold"


def test_engine_manages_to_exit():
    # Open at 0.001, price doubles -> de-risk; provider returns the new price.
    good = Candidate("M", "G", _safe(),
                     TokenMetrics(liquidity_sol=10, buys_5m=40, sells_5m=4, volume_5m_sol=40,
                                  smart_money_buys=3, social_score=0.7), price_sol=0.001)
    prov = FakeProvider([good], prices={"M": 0.002})
    eng = MemeEngine(prov, FakeExec(), base_size_sol=0.1, max_size_sol=0.5, dry=True)
    positions = {}
    eng.find_and_open(positions)
    acts = eng.manage_open(positions)
    assert acts and acts[0]["action"] == "sell_fraction"
    assert positions["M"].recovered is True               # initial recovered, moonbag kept
