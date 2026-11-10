"""Position sizing, request building and the guards that keep bad orders away
from the broker. Pure logic - no terminal needed."""
import pytest

from mt5cc import mt5_constants as C
from mt5cc import trading as T

INFO = {"digits": 5, "point": 0.00001, "trade_tick_size": 0.00001, "trade_tick_value": 1.0, "volume_min": 0.01,
        "volume_max": 100.0, "volume_step": 0.01, "trade_stops_level": 10, "trade_mode": C.SYMBOL_TRADE_MODE_FULL,
        "filling_mode": C.SYMBOL_FILLING_FOK | C.SYMBOL_FILLING_IOC}
TICK = {"bid": 1.10000, "ask": 1.10010}
ACC = {"equity": 10000.0}
LIMITS = {"max_risk_percent": 2.0, "max_lots": 5.0, "allowed_symbols": []}


def test_one_percent_risk_sizing():
    plan = T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "risk", "risk_percent": 1, "sl_mode": "points", "sl": 200, "tp_mode": "rr", "tp": 2}, INFO, TICK, ACC, LIMITS)
    # 1% of 10,000 = 100; 200 points * 1.0 per point per lot = 200 per lot -> 0.5 lots
    assert plan.volume == 0.5 and plan.entry == 1.1001
    assert plan.sl == 1.0981 and plan.tp == 1.1041
    assert plan.risk_amount == pytest.approx(100.0) and plan.risk_percent == pytest.approx(1.0) and plan.reward_amount == pytest.approx(200.0)
    assert plan.order_type == C.ORDER_TYPE_BUY


def test_sell_sizing_and_price_stop():
    plan = T.build_plan({"symbol": "EURUSD", "side": "SELL", "sizing": "risk", "risk_percent": 0.5, "sl_mode": "price", "sl": 1.1050, "tp_mode": "price", "tp": 1.0900}, INFO, TICK, ACC, LIMITS)
    # entry at bid 1.1000, stop 500 points away -> 500/lot; 0.5% = 50 -> 0.1 lot
    assert plan.volume == pytest.approx(0.1) and plan.sl == 1.105 and plan.tp == 1.09 and plan.order_type == C.ORDER_TYPE_SELL
    assert plan.risk_amount == pytest.approx(50.0) and plan.reward_amount == pytest.approx(100.0)


def test_volume_rounds_down_to_lot_step():
    plan = T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "risk", "risk_percent": 1, "sl_mode": "points", "sl": 350}, INFO, TICK, ACC, LIMITS)
    # 100 / 350 = 0.2857 -> rounded DOWN to 0.28 so the risk never exceeds the request
    assert plan.volume == pytest.approx(0.28) and plan.risk_amount == pytest.approx(98.0, abs=0.01) and plan.warnings


def test_risk_above_limit_rejected():
    with pytest.raises(T.TradeRejected, match="max_risk_percent"):
        T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "risk", "risk_percent": 3, "sl_mode": "points", "sl": 200}, INFO, TICK, ACC, LIMITS)


def test_lots_above_limit_rejected():
    with pytest.raises(T.TradeRejected, match="max_lots"):
        T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "lots", "lots": 6}, INFO, TICK, ACC, LIMITS)


def test_risk_sizing_needs_stop():
    with pytest.raises(T.TradeRejected, match="stop-loss"):
        T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "risk", "risk_percent": 1, "sl_mode": "none"}, INFO, TICK, ACC, LIMITS)


def test_wrong_side_stop_rejected():
    with pytest.raises(T.TradeRejected):
        T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "lots", "lots": 0.1, "sl_mode": "price", "sl": 1.2}, INFO, TICK, ACC, LIMITS)


def test_stop_inside_broker_minimum_rejected():
    with pytest.raises(T.TradeRejected, match="minimum distance"):
        T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "lots", "lots": 0.1, "sl_mode": "points", "sl": 5}, INFO, TICK, ACC, LIMITS)


def test_symbol_allowlist():
    with pytest.raises(T.TradeRejected, match="allowed_symbols"):
        T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "lots", "lots": 0.1}, INFO, TICK, ACC, {**LIMITS, "allowed_symbols": ["XAUUSD"]})


def test_pending_orders_need_sane_price():
    with pytest.raises(T.TradeRejected, match="limit order"):
        T.build_plan({"symbol": "EURUSD", "side": "BUY", "order_kind": "limit", "price": 1.2, "sizing": "lots", "lots": 0.1}, INFO, TICK, ACC, LIMITS)
    plan = T.build_plan({"symbol": "EURUSD", "side": "BUY", "order_kind": "limit", "price": 1.09, "sizing": "lots", "lots": 0.1}, INFO, TICK, ACC, LIMITS)
    req = T.build_order_request(plan, INFO, 7, 20, "x")
    assert req["action"] == C.TRADE_ACTION_PENDING and req["type"] == C.ORDER_TYPE_BUY_LIMIT and req["price"] == 1.09


def test_market_request_shape():
    plan = T.build_plan({"symbol": "EURUSD", "side": "SELL", "sizing": "lots", "lots": 0.25, "sl_mode": "points", "sl": 100, "tp_mode": "points", "tp": 300}, INFO, TICK, ACC, LIMITS)
    req = T.build_order_request(plan, INFO, 710001, 20, "hello")
    assert req == {"action": C.TRADE_ACTION_DEAL, "symbol": "EURUSD", "volume": 0.25, "type": C.ORDER_TYPE_SELL, "price": 1.1,
                   "deviation": 20, "magic": 710001, "comment": "hello", "type_time": C.ORDER_TIME_GTC,
                   "type_filling": C.ORDER_FILLING_FOK, "sl": 1.101, "tp": 1.097}


def test_close_request_opposite_side_and_volume_checks():
    pos = {"ticket": 55, "symbol": "EURUSD", "type": C.POSITION_TYPE_BUY, "volume": 0.3, "price_current": 1.1}
    req = T.build_close_request(pos, INFO, TICK, None, 1, 20)
    assert req["type"] == C.ORDER_TYPE_SELL and req["volume"] == 0.3 and req["position"] == 55 and req["price"] == TICK["bid"]
    part = T.build_close_request(pos, INFO, TICK, 0.1, 1, 20)
    assert part["volume"] == 0.1
    with pytest.raises(T.TradeRejected):
        T.build_close_request(pos, INFO, TICK, 0.5, 1, 20)


def test_modify_request_validates_sides():
    pos = {"ticket": 55, "symbol": "EURUSD", "type": C.POSITION_TYPE_SELL, "volume": 0.3, "price_current": 1.1}
    req = T.build_modify_request(pos, INFO, 1.105, 1.09)
    assert req == {"action": C.TRADE_ACTION_SLTP, "symbol": "EURUSD", "position": 55, "sl": 1.105, "tp": 1.09}
    with pytest.raises(T.TradeRejected):
        T.build_modify_request(pos, INFO, 1.09, None)


def test_risk_from_free_margin():
    acc = {"equity": 10000.0, "balance": 10500.0, "margin_free": 4000.0}
    req = {"symbol": "EURUSD", "side": "BUY", "sizing": "risk", "risk_percent": 1, "risk_basis": "free_margin", "sl_mode": "points", "sl": 200}
    plan = T.build_plan(req, INFO, TICK, acc, LIMITS)
    # 1% of free margin 4,000 = 40; 200/lot -> 0.2 lots
    assert plan.volume == pytest.approx(0.2) and plan.risk_amount == pytest.approx(40.0)
    assert plan.risk_basis == "free_margin" and plan.basis_amount == 4000.0
    assert plan.risk_percent == pytest.approx(1.0) and plan.risk_percent_of_equity == pytest.approx(0.4)
    bal = T.build_plan({**req, "risk_basis": "balance"}, INFO, TICK, acc, LIMITS)
    assert bal.volume == pytest.approx(0.52)
    with pytest.raises(T.TradeRejected, match="risk_basis"):
        T.build_plan({**req, "risk_basis": "margin"}, INFO, TICK, acc, LIMITS)


def test_free_margin_basis_still_capped_by_equity():
    # free margin larger than equity (credit / bonus) must not let risk exceed the cap on equity
    acc = {"equity": 1000.0, "balance": 1000.0, "margin_free": 5000.0}
    with pytest.raises(T.TradeRejected, match="of equity"):
        T.build_plan({"symbol": "EURUSD", "side": "BUY", "sizing": "risk", "risk_percent": 2, "risk_basis": "free_margin", "sl_mode": "points", "sl": 100}, INFO, TICK, acc, LIMITS)
