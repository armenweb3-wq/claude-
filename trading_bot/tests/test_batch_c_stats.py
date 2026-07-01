"""Batch C: closed-trade grouping correctness — separate positions stay
separate (a loss can't hide inside a win) and a laddered position's ROI% is the
qty-weighted average of its fills, not their (inflated) sum."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.saas.store import group_closed  # noqa: E402


def test_separate_positions_not_merged_loss_not_hidden():
    # Same symbol+side, but two DIFFERENT entry prices = two positions.
    trades = [
        {"symbol": "BTCUSDT", "side": "Buy", "pnl": 10.0, "pnl_pct": 10, "qty": 1,
         "entry_price": 100.0, "closed_at": "2026-06-10T10:00:00+00:00"},
        {"symbol": "BTCUSDT", "side": "Buy", "pnl": -8.0, "pnl_pct": -8, "qty": 1,
         "entry_price": 200.0, "closed_at": "2026-06-10T12:00:00+00:00"},
    ]
    g = group_closed(trades)
    assert len(g) == 2                       # NOT merged
    pnls = sorted(t["pnl"] for t in g)
    assert pnls == [-8.0, 10.0]              # the loss is still visible


def test_same_price_far_apart_not_merged():
    # Same symbol/side AND same entry price, but a month apart = two separate
    # positions. Must NOT merge (else a later loss hides in an earlier win).
    trades = [
        {"symbol": "BTCUSDT", "side": "Buy", "pnl": 50.0, "pnl_pct": 10, "qty": 1,
         "entry_price": 100.0, "closed_at": "2026-01-10T10:00:00+00:00"},
        {"symbol": "BTCUSDT", "side": "Buy", "pnl": -30.0, "pnl_pct": -6, "qty": 1,
         "entry_price": 100.0, "closed_at": "2026-02-10T10:00:00+00:00"},
    ]
    g = group_closed(trades)
    assert len(g) == 2
    assert sorted(t["pnl"] for t in g) == [-30.0, 50.0]


def test_ladder_fills_merge_with_weighted_pct():
    # Three TP fills of ONE position (same entry), even days apart, -> one trade.
    trades = [
        {"symbol": "SOLUSDT", "side": "Buy", "pnl": 1.8, "pnl_pct": 6, "qty": 0.3,
         "entry_price": 100.0, "closed_at": "2026-06-10T10:00:00+00:00"},
        {"symbol": "SOLUSDT", "side": "Buy", "pnl": 4.8, "pnl_pct": 12, "qty": 0.4,
         "entry_price": 100.0, "closed_at": "2026-06-12T10:00:00+00:00"},
        {"symbol": "SOLUSDT", "side": "Buy", "pnl": 6.0, "pnl_pct": 20, "qty": 0.3,
         "entry_price": 100.0, "closed_at": "2026-06-14T10:00:00+00:00"},
    ]
    g = group_closed(trades)
    assert len(g) == 1
    assert abs(g[0]["pnl"] - 12.6) < 1e-6
    # weighted avg = 6*.3 + 12*.4 + 20*.3 = 12.6 (NOT 6+12+20 = 38)
    assert abs(g[0]["pnl_pct"] - 12.6) < 1e-6
    assert g[0]["entry_price"] == 100.0


def test_marketing_filter_excludes_gamed_trades():
    from app.saas.store import Store
    # tiny notional + extreme % = a gamed trade → not marketing-eligible
    assert not Store._marketing_eligible(
        {"entry_price": 0.01, "qty": 1, "pnl_pct": 900})   # $0.01 notional
    assert not Store._marketing_eligible(
        {"entry_price": 100, "qty": 5, "pnl_pct": 900})     # implausible %
    # a real, sizeable, sane trade qualifies
    assert Store._marketing_eligible(
        {"entry_price": 100, "qty": 5, "pnl_pct": 18})      # $500 notional, +18%
