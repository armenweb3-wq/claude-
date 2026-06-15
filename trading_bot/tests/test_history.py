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
