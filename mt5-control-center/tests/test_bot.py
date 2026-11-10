"""Indicators, strategies, backtester and the paper engine (with a scripted adapter)."""
import math
import time
from pathlib import Path

import pytest

from mt5cc.bot import indicators as I
from mt5cc.bot.backtest import SymbolSpec, run_backtest, size_for_risk
from mt5cc.bot.engine import BotEngine, _hours_ok
from mt5cc.bot.strategies import Bar, TrendBreakout, EmaPullback, make_strategy, catalogue

SPEC = SymbolSpec(point=0.0001, tick_size=0.0001, tick_value=1.0, spread_points=10, commission_per_lot=3.5)


def synth_bars(n=600, seed=1, trend=0.0003):
    import random
    rng = random.Random(seed)
    bars, p, t = [], 1.1, 1_700_000_000
    for i in range(n):
        o = p
        c = o + trend * (1 if (i // 150) % 2 == 0 else -1) + rng.gauss(0, 0.0008)
        h = max(o, c) + abs(rng.gauss(0, 0.0004)); l = min(o, c) - abs(rng.gauss(0, 0.0004))
        bars.append(Bar(t, o, h, l, c, 100, 10)); p = c; t += 3600
    return bars


def test_indicators_basic():
    vals = [float(i) for i in range(1, 21)]
    assert I.sma(vals, 5)[4] == 3.0 and I.sma(vals, 5)[-1] == 18.0
    e = I.ema(vals, 5); assert e[3] is None and e[4] == 3.0 and e[-1] > e[-2]
    r = I.rsi(vals, 14); assert r[14] == 100.0
    hi, lo = I.donchian([1, 2, 3, 4, 5], [0, 1, 2, 3, 4], 2); assert hi[2] == 2 and lo[2] == 0 and hi[0] is None
    a = I.atr([2, 3, 4], [1, 2, 3], [1.5, 2.5, 3.5], 2); assert a[1] == pytest.approx(1.25)
    adx = I.adx([float(i) for i in range(1, 60)], [float(i) - 0.5 for i in range(1, 60)], [float(i) for i in range(1, 60)], 5)
    assert adx[-1] is not None and adx[-1] > 50   # perfectly trending series


def test_strategy_params_and_catalogue():
    s = make_strategy("trend_breakout", {"channel": "30", "bogus": 1, "adx_min": ""})
    assert s.p["channel"] == 30 and "bogus" not in s.p and s.p["adx_min"] == 20.0
    assert {c["key"] for c in catalogue()} == {"trend_breakout", "ema_pullback"}
    with pytest.raises(ValueError):
        make_strategy("nope")


def test_entry_stop_on_correct_side():
    bars = synth_bars()
    for strat in (TrendBreakout(), EmaPullback()):
        s = strat.prepare(bars)
        found = 0
        for i in range(strat.warmup, len(bars)):
            e = strat.entry(s, i)
            if e:
                found += 1
                assert (e.direction > 0 and e.stop < bars[i].close) or (e.direction < 0 and e.stop > bars[i].close)
        assert found > 0, strat.key


def test_size_for_risk():
    assert size_for_risk(10000, 1.0, 0.0050, SPEC) == 2.0          # 100 / (50 pips * 1/pip) = 2 lots
    assert size_for_risk(10000, 1.0, 0.0050, SPEC, max_lots=0.5) == 0.5
    assert size_for_risk(100, 1.0, 0.0500, SPEC) == 0.0              # below min lot
    assert size_for_risk(10000, 1.0, 0, SPEC) == 0.0


def test_backtest_runs_and_accounts_costs():
    bars = synth_bars(800)
    r = run_backtest(bars, TrendBreakout(), SPEC, equity=10000, risk_pct=1.0)
    s = r["stats"]
    assert s["trades"] > 0 and len(r["curve"]) == len(bars)
    assert s["end_equity"] == pytest.approx(10000 + s["net"], abs=0.01)
    assert all(t["commission"] == pytest.approx(t["volume"] * 7.0, abs=0.01) for t in r["trades"])
    assert all(abs(t["net"] - (t["gross"] - t["commission"])) < 0.011 for t in r["trades"])
    assert s["max_drawdown"] >= 0 and s["trades_per_month"] >= 0
    # stop first when both hit: losses never exceed ~1R + costs by much
    for t in r["trades"]:
        if t["reason_out"] == "stop":
            assert t["r_multiple"] > -1.6


def test_hours():
    from datetime import datetime, timezone
    assert _hours_ok("07:00-21:00", datetime(2026, 1, 1, 8, tzinfo=timezone.utc))
    assert not _hours_ok("07:00-21:00", datetime(2026, 1, 1, 22, tzinfo=timezone.utc))
    assert _hours_ok("22:00-02:00", datetime(2026, 1, 1, 23, tzinfo=timezone.utc))
    assert _hours_ok("garbage", datetime(2026, 1, 1, 23, tzinfo=timezone.utc))


class ScriptedAdapter:
    """Feeds the engine a breakout bar, then a price that hits the stop."""
    connected = True

    def __init__(self):
        now = int(time.time())
        tf = 60
        self.last_closed = (now // tf) * tf - tf
        self.bars = []
        p = 1.1
        t = self.last_closed - 400 * tf
        for i in range(400):
            o = p; c = o + 0.0002 + (0.0001 if i % 3 else -0.0001); h = max(o, c) + 0.0002; l = min(o, c) - 0.0002
            self.bars.append({"time": t, "open": o, "high": h, "low": l, "close": c, "volume": 1, "spread": 10}); p = c; t += tf
        # last closed bar is a strong breakout close
        self.bars[-1]["close"] = self.bars[-1]["high"] = p + 0.01
        self.ask = self.bid = None
        self.set_price(p + 0.0101)
        self.positions_list = []

    def set_price(self, mid):
        self.bid, self.ask = mid - 0.00005, mid + 0.00005

    def account_info(self): return {"equity": 10000.0, "balance": 10000.0, "margin_free": 10000.0, "currency": "USD", "login": 1}
    def positions(self): return self.positions_list
    def symbol_info(self, s): return {"point": 0.0001, "trade_tick_size": 0.0001, "trade_tick_value": 1.0, "volume_min": 0.01, "volume_max": 100, "volume_step": 0.01, "spread": 10, "trade_contract_size": 100000, "trade_stops_level": 0, "digits": 5}
    def symbol_tick(self, s): return {"bid": self.bid, "ask": self.ask}
    def rates(self, s, tf, n): return self.bars[-n:] + [{"time": self.last_closed + 60, "open": self.ask, "high": self.ask, "low": self.bid, "close": self.ask, "volume": 1, "spread": 10}]


def test_paper_engine_opens_and_stops_out(tmp_path: Path):
    ad = ScriptedAdapter()
    logs = []
    eng = BotEngine("t", ad, {"strategy": "trend_breakout", "symbols": ["EURUSD"], "timeframe": "M1", "risk_percent": 1.0,
                              "params": {"ema": 50, "adx_min": 0, "channel": 20}, "max_daily_loss_percent": 50},
                    data_dir=tmp_path, log=lambda lvl, m: logs.append((lvl, m)), live_open=lambda a: {"ok": False}, live_close=lambda t: {},
                    live_modify=lambda t, s, p: {}, magic=99, deals=lambda: [])
    eng.start("paper")
    eng.tick()
    assert "EURUSD" in eng.paper["positions"], logs
    pos = eng.paper["positions"]["EURUSD"]
    assert pos["direction"] == 1 and pos["stop"] < pos["entry"] and pos["volume"] > 0
    expected_risk = (pos["entry"] - pos["stop"]) * pos["volume"] * 10000
    assert expected_risk <= 100.0 + 1e-6            # never more than 1% of 10,000
    # price falls through the stop -> paper close on next tick
    ad.set_price(pos["stop"] - 0.001)
    eng.tick()
    assert not eng.paper["positions"] and len(eng.paper["trades"]) == 1
    t = eng.paper["trades"][0]
    assert t["reason_out"] == "stop" and t["net"] < 0 and eng.paper["equity"] == pytest.approx(10000 + t["net"])
    st = eng.state()
    assert st["running"] and st["mode"] == "paper" and st["paper"]["trade_count"] == 1
    # ledger persisted
    assert (tmp_path / "bot-paper-t.json").exists()
    eng.stop()
    assert not eng.state()["running"]


def test_daily_loss_halts_new_entries(tmp_path: Path):
    ad = ScriptedAdapter()
    eng = BotEngine("t", ad, {"strategy": "trend_breakout", "symbols": ["EURUSD"], "timeframe": "M1", "risk_percent": 1.0,
                              "params": {"ema": 50, "adx_min": 0}, "max_daily_loss_percent": 0.5},
                    data_dir=tmp_path, log=lambda *a: None, live_open=lambda a: {"ok": False}, live_close=lambda t: {},
                    live_modify=lambda t, s, p: {}, magic=99, deals=lambda: [])
    eng.start("paper")
    eng.paper["trades"].append({"net": -60.0, "exit_time": time.time(), "symbol": "X"})   # already lost 0.6% today
    eng.tick()
    assert not eng.paper["positions"] and eng.halt_reason and "daily loss" in eng.halt_reason
