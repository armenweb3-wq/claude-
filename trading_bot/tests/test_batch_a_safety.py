"""Regression tests for the Batch A trading-safety fixes:
- position sizing stays affordable and doesn't max leverage
- TP-trailing counts only real TP-price fills and never force-closes on the
  fills path (the exchange's reduce-only ladder closes the final TP itself).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.exchange.base import Position  # noqa: E402
from app.risk.sizing import plan_position  # noqa: E402
from app.saas.usertrader import manage_breakeven, _tp_hits_from_fills  # noqa: E402


class _FX:
    def __init__(self):
        self.stops = []
        self.closed = []

    def set_stop_loss(self, s, p):
        self.stops.append(p)

    def close_position(self, s):
        self.closed.append(s)


# ── sizing ────────────────────────────────────────────────────
def test_sizing_stays_affordable_and_not_maxed():
    # High risk + tight stop would demand ~10x equity notional; the planner must
    # cap the size so the required margin fits the balance.
    plan = plan_position(equity=1000, risk_pct=10.0, entry=100.0, stop=99.0,
                         side="long", leverage_cap=10.0)
    assert plan.margin <= 1000 * 0.95 + 1e-6      # affordable
    assert plan.leverage <= 10
    assert plan.qty > 0
    assert "reduced" in plan.reason               # size was capped


def test_sizing_uses_minimum_leverage_when_affordable():
    # 5% risk, 3% stop on 10k -> notional ~1.67x equity, easily affordable;
    # leverage should be small (not the 10x cap).
    plan = plan_position(equity=10_000, risk_pct=5.0, entry=100.0, stop=97.0,
                         side="long", leverage_cap=10.0)
    assert plan.leverage < 10            # not maxed
    assert plan.safe


# ── TP-fill matching ──────────────────────────────────────────
def test_tp_hits_match_prices_not_unrelated_closes():
    tps = [106.0, 112.0, 120.0]
    closed = [
        {"symbol": "BTCUSDT", "exit_price": 106.0, "closed_at": "2026-06-19T10:00:00+00:00"},
        {"symbol": "BTCUSDT", "exit_price": 113.0, "closed_at": "2026-06-19T11:00:00+00:00"},  # not a TP
    ]
    # only the 106 fill matches a TP level
    assert _tp_hits_from_fills(closed, "BTCUSDT", "2026-06-19T09:00:00+00:00", tps) == 1


def test_fills_path_does_not_force_close_on_final_tp():
    ex = _FX()
    pos = Position("BTCUSDT", "Buy", 0.3, 100.0, 0.0, 0.0)
    tps = [106.0, 112.0, 120.0]
    closed = [{"symbol": "BTCUSDT", "exit_price": p, "closed_at": "2026-06-19T10:00:00+00:00"}
              for p in tps]
    manage_breakeven(ex, "BTCUSDT", pos, closed=closed, opened_at="2026-06-19T09:00:00+00:00")
    assert ex.closed == []                 # exchange ladder closes TP3, not us
    assert ex.stops and ex.stops[-1] >= 106.0  # stop trailed up


def test_unrelated_close_does_not_trail_stop():
    ex = _FX()
    pos = Position("BTCUSDT", "Buy", 0.3, 100.0, 0.0, 0.0)
    closed = [{"symbol": "BTCUSDT", "exit_price": 113.0, "closed_at": "2026-06-19T10:00:00+00:00"}]
    manage_breakeven(ex, "BTCUSDT", pos, closed=closed, opened_at="2026-06-19T09:00:00+00:00")
    assert ex.stops == []                   # no TP matched -> no stop move
    assert ex.closed == []
