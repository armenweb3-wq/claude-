"""Server-side break-even (Bybit trailing stop) + the fast manage pass.

The live failure this guards against: TP1 fills, price reverses inside the
bot's polling interval, and the remainder exits at the ORIGINAL stop because
break-even was never moved. The fix is exchange-native: a trailing stop armed
at entry that activates at TP1 with a trail of |entry -> TP1|, so Bybit itself
puts the stop at ~break-even the instant TP1 trades.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402
from app.exchange.base import Position  # noqa: E402
from app.strategy.base import TakeProfit  # noqa: E402


class FakeBybitClient:
    """Minimal pybit stand-in capturing every trading call."""

    def __init__(self, avg_entry: float, side: str = "Buy"):
        self.avg_entry = avg_entry
        self.side = side
        self.trading_stops: list[dict] = []
        self.orders: list[dict] = []

    def get_instruments_info(self, **kw):
        return {"result": {"list": [{
            "lotSizeFilter": {"minOrderQty": "0.001", "qtyStep": "0.001",
                              "minNotionalValue": "0"},
            "priceFilter": {"tickSize": "0.1"},
        }]}}

    def get_kline(self, **kw):
        p = str(self.avg_entry)
        return {"result": {"list": [["1700000000000", p, p, p, p, "1", "1"]]}}

    def get_positions(self, **kw):
        return {"result": {"list": [{
            "size": "1", "side": self.side, "avgPrice": str(self.avg_entry),
            "unrealisedPnl": "0", "stopLoss": "97", "leverage": "3",
            "createdTime": "1700000000000",
        }]}}

    def place_order(self, **kw):
        self.orders.append(kw)
        return {"result": {"orderId": "e1"}}

    def set_trading_stop(self, **kw):
        self.trading_stops.append(kw)
        return {}

    def set_leverage(self, **kw):
        return {}

    def switch_position_mode(self, **kw):
        return {}

    def set_margin_mode(self, **kw):
        return {}


def _exchange(client) -> "object":
    from app.exchange.bybit import BybitExchange
    ex = BybitExchange.__new__(BybitExchange)
    ex._client = client
    ex._category = "linear"
    ex._rules_cache = {}
    ex._margin_set = True  # skip the one-time margin-mode call
    return ex


def _tps(entry: float, sign: float) -> list[TakeProfit]:
    return [TakeProfit(p, f, entry * (1 + sign * p / 100))
            for p, f in ((6.0, 0.4), (15.0, 0.3), (50.0, 0.3))]


def _trailing_calls(client):
    return [c for c in client.trading_stops if "trailingStop" in c]


def test_open_long_arms_trailing_be_at_tp1():
    client = FakeBybitClient(avg_entry=100.0, side="Buy")
    ex = _exchange(client)
    res = ex.open_position("TBLONG", "Buy", qty=1.0, leverage=3,
                           stop_loss=97.0, take_profits=_tps(100.0, +1))
    assert res.ok and not res.warning
    calls = _trailing_calls(client)
    assert len(calls) == 1
    # trail = |TP1 - actual entry| = 6.0, activates exactly at TP1.
    assert float(calls[0]["trailingStop"]) == 6.0
    assert float(calls[0]["activePrice"]) == 106.0


def test_open_short_arms_trailing_be_at_tp1():
    client = FakeBybitClient(avg_entry=100.0, side="Sell")
    ex = _exchange(client)
    ex.open_position("TBSHORT", "Sell", qty=1.0, leverage=3,
                     stop_loss=103.0, take_profits=_tps(100.0, -1))
    calls = _trailing_calls(client)
    assert len(calls) == 1
    assert float(calls[0]["trailingStop"]) == 6.0
    assert float(calls[0]["activePrice"]) == 94.0


def test_trailing_be_anchors_to_actual_fill_not_signal_price():
    # Signal said entry 100 (TP1 106) but the market order actually filled at
    # 101 — the trail must be 5.0 so activation at 106 puts the stop at the
    # REAL entry, never below it.
    client = FakeBybitClient(avg_entry=101.0, side="Buy")
    ex = _exchange(client)
    ex.open_position("TBSLIP", "Buy", qty=1.0, leverage=3,
                     stop_loss=97.0, take_profits=_tps(100.0, +1))
    calls = _trailing_calls(client)
    assert len(calls) == 1
    assert abs(float(calls[0]["trailingStop"]) - 5.0) < 1e-9


def test_trailing_be_respects_config_flag(monkeypatch):
    # Patch the settings object bybit.py actually holds — other test modules
    # reload app.config, so the module-level import here can be a different
    # instance depending on test order.
    import app.exchange.bybit as bybit_mod
    prev = bybit_mod.settings.bybit_trailing_be
    object.__setattr__(bybit_mod.settings, "bybit_trailing_be", False)
    try:
        client = FakeBybitClient(avg_entry=100.0, side="Buy")
        ex = _exchange(client)
        ex.open_position("TBOFF", "Buy", qty=1.0, leverage=3,
                         stop_loss=97.0, take_profits=_tps(100.0, +1))
        assert _trailing_calls(client) == []
    finally:
        object.__setattr__(bybit_mod.settings, "bybit_trailing_be", prev)


# ── fast manage pass ────────────────────────────────────────
class _ManageEx:
    """Exchange double for manage_once: one open long past TP1 (via fills)."""

    def __init__(self):
        self.stops: list[tuple[str, float]] = []

    def closed_pnl(self, limit=100, start_ms=None):
        # A real TP1 fill at +6% since the position opened.
        return [{"symbol": "BTCUSDT", "exit_price": 106.0,
                 "closed_at": "2026-06-22T10:00:00+00:00"}]

    def get_position(self, symbol):
        return Position(symbol, "Buy", 0.6, 100.0, 0.0, 97.0,
                        created_at="2026-06-22T09:00:00+00:00")

    def set_stop_loss(self, symbol, price):
        self.stops.append((symbol, price))


def test_manage_once_trails_stop_without_trading():
    from app.saas.usertrader import UserTrader
    ex = _ManageEx()
    t = UserTrader(ex, None, risk_pct=2.0, symbols=["BTCUSDT"], dry=False)
    out = t.manage_once()
    assert out["managed"] == 1
    assert ex.stops and ex.stops[0][1] >= 100.0   # stop moved to >= break-even
    assert out["closed"]                           # fills surfaced for persistence


def test_manage_cycle_skips_in_dry_run():
    from app.saas.runner import MultiUserRunner

    class _Store:
        def get_meta(self, k):
            return None

        def list_users(self, **kw):
            raise AssertionError("manage_cycle must not touch users in dry-run")

    import app.saas.runner as runner_mod
    prev = runner_mod.settings.saas_dry_run
    object.__setattr__(runner_mod.settings, "saas_dry_run", True)
    try:
        MultiUserRunner(_Store()).manage_cycle()   # must return without touching users
    finally:
        object.__setattr__(runner_mod.settings, "saas_dry_run", prev)
