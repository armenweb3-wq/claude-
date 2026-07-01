"""Reconciliation: a live position with no stop-loss is detected, auto-repaired,
and the user is alerted via the durable event outbox."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings  # noqa: E402
from app.exchange.base import Position  # noqa: E402
from app.saas import live as live_mod  # noqa: E402
from app.saas.runner import MultiUserRunner  # noqa: E402
from app.saas.store import Store  # noqa: E402


class _FakeEx:
    def __init__(self):
        self.stops = []

    def get_open_positions(self):
        # one open position with NO stop-loss (stop_loss=0) on a tracked symbol
        return [Position("BTCUSDT", "Buy", 0.01, 100.0, 0.0, stop_loss=0.0)]

    def set_stop_loss(self, symbol, price):
        self.stops.append((symbol, price))


def test_reconcile_autofixes_unprotected_position(monkeypatch):
    st = Store(path=tempfile.mktemp(suffix=".db"))
    u = st.create_user("u@t.com", "s", "h", False, username="u")
    uid = u["id"]
    st.set_activation(uid, True, None)
    st.save_keys(uid, "enc", "enc", False)
    st.get_settings(uid)
    st.save_settings(uid, 2.0, "BTCUSDT", True)  # enabled, BTC tracked

    fake = _FakeEx()
    monkeypatch.setattr(live_mod, "_exchange", lambda keys: fake)
    object.__setattr__(settings, "saas_dry_run", False)  # reconcile is live-only

    runner = MultiUserRunner(st)
    runner._reconcile()

    # a protective stop was placed near 97 (entry 100, -3%)
    assert fake.stops and fake.stops[0][0] == "BTCUSDT"
    assert abs(fake.stops[0][1] - 97.0) < 0.5
    # and the user got a durable alert event
    pend = st.pending_events()
    assert any("stop" in (__import__("json").loads(e["payload"]).get("text", "").lower())
               for e in pend)
    object.__setattr__(settings, "saas_dry_run", True)  # restore
