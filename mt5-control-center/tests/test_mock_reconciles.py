"""The synthetic data source must itself reconcile - otherwise the demo would
show numbers that do not add up."""
from datetime import datetime, timedelta, timezone

from mt5cc.mock_adapter import MockAdapter
from mt5cc.history import build_trades, normalize_deals


def test_mock_history_reconciles():
    m = MockAdapter({"id": "account1", "label": "A"})
    m.connect()
    now = datetime.now(timezone.utc)
    deals = m.deals(now - timedelta(days=400), now + timedelta(days=1))
    assert len(deals) > 100
    open_ids = [p["identifier"] for p in m.positions()]
    book = build_trades(normalize_deals(deals, 0), open_ids)
    assert book.reconciliation["verified"], book.reconciliation
    assert book.reconciliation["incomplete_trades"] == 0
    assert not book.unresolved_positions
    assert any(t.partial for t in book.trades)
    assert any(t.reversal for t in book.trades)
    # balance anchored to the mock's own balance
    info = m.account_info()
    total = sum(d["profit"] + d["commission"] + d["swap"] + d["fee"] for d in deals)
    assert abs(total - info["balance"]) < 0.01
