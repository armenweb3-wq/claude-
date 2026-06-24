"""Closed-trade history + win/loss stats (paper exchange, no network)."""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.exchange.base import Order, Position
from app.exchange.paper import PaperExchange


def _open(ex: PaperExchange, symbol: str, side: str, qty: float, entry: float) -> None:
    ex._positions[symbol] = Position(symbol, side, qty, entry)


def test_paper_records_wins_and_losses():
    ex = PaperExchange(starting_equity=20.0)

    # Winning long: bought 0.10, exit 0.12.
    _open(ex, "OPUSDT", "Buy", 10, 0.10)
    ex.place_order(Order(symbol="OPUSDT", side="Sell", qty=10, price=0.12, reduce_only=True))

    # Losing short: shorted 0.19, exit 0.20.
    _open(ex, "XLMUSDT", "Sell", 100, 0.19)
    ex.place_order(Order(symbol="XLMUSDT", side="Buy", qty=100, price=0.20, reduce_only=True))

    closed = ex.closed_pnl()
    assert len(closed) == 2
    # Newest first.
    assert closed[0]["symbol"] == "XLMUSDT"
    assert closed[0]["pnl"] < 0
    assert closed[1]["symbol"] == "OPUSDT"
    assert closed[1]["pnl"] > 0


def test_history_endpoint_aggregates_stats():
    import app.main as main
    from fastapi.testclient import TestClient

    with TestClient(main.app) as client:
        ex = main.app.state.bot.exchange
        # Seed two closed trades directly on the (paper) exchange.
        _open(ex, "OPUSDT", "Buy", 10, 0.10)
        ex.place_order(Order(symbol="OPUSDT", side="Sell", qty=10, price=0.12, reduce_only=True))
        _open(ex, "XLMUSDT", "Sell", 100, 0.19)
        ex.place_order(Order(symbol="XLMUSDT", side="Buy", qty=100, price=0.20, reduce_only=True))

        data = client.get("/history").json()

    stats = data["stats"]
    assert stats["wins"] == 1
    assert stats["losses"] == 1
    assert stats["total"] == 2
    assert stats["win_rate"] == 50.0
    assert len(data["trades"]) == 2


# ── dashboard TP-hit counting (regression: stop-out must not show as TP) ──
def test_tps_hit_ignores_stop_and_prior_closes():
    """A short re-entry after a stop-out used to count the stop close as 'TP1 hit'.
    Only a close whose PRICE matches a TP level should count."""
    from app.strategy.trailing import tp_hits_from_fills
    # Short from entry 74.18 -> TP ladder below entry.
    tps = [69.73, 65.28, 59.34]
    opened = "2026-06-22T04:30:00+00:00"
    # The prior trade's stop-out filled at 74.60 (above entry) — NOT a take-profit.
    stop = [{"symbol": "SOLUSDT", "exit_price": 74.60, "closed_at": "2026-06-22T04:31:00+00:00"}]
    assert tp_hits_from_fills(stop, "SOLUSDT", opened, tps) == 0
    # A genuine TP1 fill at ~69.73 DOES count.
    tp1 = [{"symbol": "SOLUSDT", "exit_price": 69.70, "closed_at": "2026-06-22T05:00:00+00:00"}]
    assert tp_hits_from_fills(tp1, "SOLUSDT", opened, tps) == 1


# ── TP-level labelling for profit alerts ────────────────────
def test_tp_level_labels_profit_closes():
    from app.saas.runner import _tp_level
    # ladder is +6 / +15 / +50%
    assert _tp_level({"entry_price": 100, "exit_price": 106, "side": "Buy"}) == 1
    assert _tp_level({"entry_price": 100, "exit_price": 115, "side": "Buy"}) == 2
    assert _tp_level({"entry_price": 100, "exit_price": 150, "side": "Buy"}) == 3
    # short: +6% move down = TP1
    assert _tp_level({"entry_price": 100, "exit_price": 94, "side": "Sell"}) == 1
    # a stop-out (against the position) is NOT a TP
    assert _tp_level({"entry_price": 100, "exit_price": 97, "side": "Buy"}) is None
