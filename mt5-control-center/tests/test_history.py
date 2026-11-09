from mt5cc import mt5_constants as C
from mt5cc.history import build_trades, normalize_deals
from mt5cc.stats import realized_pl, trade_stats, by_session, realized_curve, balance_curve


def deal(ticket, t, typ, entry, pid, vol, price, profit=0.0, comm=0.0, swap=0.0, fee=0.0, sym="EURUSD"):
    return {"ticket": ticket, "order": ticket, "time": t, "time_msc": t * 1000, "type": typ, "entry": entry,
            "magic": 0, "position_id": pid, "reason": 0, "volume": vol, "price": price, "commission": comm,
            "swap": swap, "profit": profit, "fee": fee, "symbol": sym, "comment": "", "external_id": ""}


def test_simple_round_trip():
    deals = normalize_deals([
        deal(1, 1000, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_IN, 10, 1.0, 1.1000, comm=-3.5),
        deal(2, 2000, C.DEAL_TYPE_SELL, C.DEAL_ENTRY_OUT, 10, 1.0, 1.1050, profit=500.0, comm=-3.5, swap=-1.2),
    ], 0)
    book = build_trades(deals)
    assert len(book.trades) == 1
    t = book.trades[0]
    assert t.direction == "BUY" and t.entry_price == 1.1 and t.exit_price == 1.105
    assert t.commission == -7.0 and t.swap == -1.2
    assert round(t.net, 2) == 491.8
    assert book.reconciliation["verified"]


def test_partial_close_allocates_entry_costs_and_vwap():
    deals = normalize_deals([
        deal(1, 1000, C.DEAL_TYPE_SELL, C.DEAL_ENTRY_IN, 10, 1.0, 2000.0, comm=-4.0, sym="XAUUSD"),
        deal(2, 1100, C.DEAL_TYPE_SELL, C.DEAL_ENTRY_IN, 10, 1.0, 2010.0, comm=-4.0, sym="XAUUSD"),
        deal(3, 1200, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_OUT, 10, 0.5, 1990.0, profit=750.0, comm=-2.0, sym="XAUUSD"),
        deal(4, 1300, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_OUT, 10, 1.5, 2000.0, profit=750.0, comm=-6.0, sym="XAUUSD"),
    ], 0)
    book = build_trades(deals)
    assert len(book.trades) == 2
    first, second = book.trades
    assert first.partial and not second.partial
    assert first.direction == "SELL" and first.entry_price == 2005.0
    assert first.entries == 2
    # entry commission pool -8 allocated 25% / 75%
    assert round(first.commission, 2) == -4.0   # -2 deal + -2 share
    assert round(second.commission, 2) == -12.0  # -6 deal + -6 share
    assert book.reconciliation["verified"]
    assert round(sum(t.net for t in book.trades), 2) == round(sum(d["profit"] + d["commission"] for d in deals), 2)


def test_reversal_inout():
    deals = normalize_deals([
        deal(1, 1000, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_IN, 10, 1.0, 100.0, comm=-2.0, sym="US500"),
        deal(2, 2000, C.DEAL_TYPE_SELL, C.DEAL_ENTRY_INOUT, 10, 2.0, 110.0, profit=100.0, comm=-4.0, sym="US500"),
        deal(3, 3000, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_OUT, 10, 1.0, 105.0, profit=50.0, comm=-2.0, sym="US500"),
    ], 0)
    book = build_trades(deals)
    assert len(book.trades) == 2
    a, b = book.trades
    assert a.reversal and a.direction == "BUY" and a.volume == 1.0 and a.entry_price == 100.0
    assert round(a.commission, 2) == -4.0   # -2 entry + half of inout
    assert b.direction == "SELL" and b.entry_price == 110.0 and b.exit_price == 105.0
    assert round(b.commission, 2) == -4.0   # other half of inout + exit
    assert book.reconciliation["verified"]


def test_incomplete_exit_without_entry_is_flagged_not_guessed():
    deals = normalize_deals([
        deal(5, 5000, C.DEAL_TYPE_SELL, C.DEAL_ENTRY_OUT, 77, 0.3, 1.25, profit=30.0, comm=-1.0, sym="GBPUSD"),
    ], 0)
    book = build_trades(deals)
    t = book.trades[0]
    assert t.incomplete and t.entry_price is None and t.direction == "BUY"
    assert book.reconciliation["verified"]   # the window still reconciles


def test_open_position_costs_and_balance_ops_separated():
    deals = normalize_deals([
        deal(1, 100, C.DEAL_TYPE_BALANCE, C.DEAL_ENTRY_IN, 0, 0, 0, profit=10000.0, sym=""),
        deal(2, 1000, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_IN, 10, 1.0, 1.1, comm=-3.0),
        deal(3, 2000, C.DEAL_TYPE_BALANCE, C.DEAL_ENTRY_IN, 0, 0, 0, profit=-500.0, sym=""),
    ], 0)
    book = build_trades(deals, open_position_ids=[10])
    assert book.trades == []
    assert book.open_entry_costs == -3.0
    assert [o["category"] for o in book.balance_ops] == ["deposit", "withdrawal"]
    assert book.reconciliation["verified"]
    rp = realized_pl(deals, None, None)
    assert rp["net"] == -3.0 and rp["deals"] == 1   # deposits never count as P/L
    curve = balance_curve(deals, 9497.0)
    assert curve[-1]["balance"] == 9497.0 and curve[0]["balance"] == 0.0


def test_server_offset_shifts_times():
    deals = normalize_deals([deal(1, 7200, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_IN, 1, 1, 1)], 2)
    assert deals[0]["time_utc"] == 0


def test_stats_and_sessions():
    deals = normalize_deals([
        deal(1, 3600 * 9, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_IN, 1, 1.0, 1.0),
        deal(2, 3600 * 10, C.DEAL_TYPE_SELL, C.DEAL_ENTRY_OUT, 1, 1.0, 1.1, profit=100.0),
        deal(3, 3600 * 14, C.DEAL_TYPE_BUY, C.DEAL_ENTRY_IN, 2, 2.0, 1.0),
        deal(4, 3600 * 15, C.DEAL_TYPE_SELL, C.DEAL_ENTRY_OUT, 2, 2.0, 0.9, profit=-50.0),
    ], 0)
    book = build_trades(deals)
    s = trade_stats(book.trades)
    assert s["trades"] == 2 and s["wins"] == 1 and s["losses"] == 1 and s["win_rate"] == 0.5
    assert s["profit_factor"] == 2.0 and s["volume"] == 3.0 and s["avg_win"] == 100.0 and s["avg_loss"] == -50.0
    sess = {r["session"]: r["trades"] for r in by_session(book.trades)}
    assert sess["London"] == 1 and sess["London / New York overlap"] == 1
    curve = realized_curve(book.trades)
    assert curve["max_drawdown"] == 50.0 and curve["points"][-1]["cum"] == 50.0
