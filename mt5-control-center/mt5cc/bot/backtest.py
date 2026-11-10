"""Event-driven backtester with realistic costs.

Rules of the simulation (shared with the live engine so results are comparable):

* decisions are taken on the close of each completed bar; entries fill at the
  next bar's open plus half the spread (longs pay the ask, shorts the bid);
* stops and targets are checked against each bar's high/low; if both are hit
  in one bar the stop is assumed first (conservative);
* position size = risk % of current equity ÷ (stop distance in money per lot),
  rounded down to the lot step; commission per lot per side is charged;
* one position per symbol; no pyramiding.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, asdict
from typing import Any

from .strategies import Bar, Strategy


@dataclass
class SymbolSpec:
    point: float
    tick_size: float
    tick_value: float          # money per tick per 1.0 lot (deposit currency)
    volume_min: float = 0.01
    volume_max: float = 100.0
    volume_step: float = 0.01
    spread_points: float = 10.0
    commission_per_lot: float = 3.5   # per side
    contract_size: float = 100000.0

    def money_per_price_unit(self) -> float:
        return self.tick_value / self.tick_size if self.tick_size else 0.0


@dataclass
class BtTrade:
    direction: int
    entry_time: int
    exit_time: int
    entry: float
    exit: float
    stop_initial: float
    volume: float
    gross: float
    commission: float
    net: float
    r_multiple: float
    bars_held: int
    reason_in: str
    reason_out: str


def round_volume(v: float, spec: SymbolSpec) -> float:
    step = spec.volume_step or 0.01
    lots = math.floor(v / step + 1e-9) * step
    lots = round(lots, 8)
    if lots < spec.volume_min:
        return 0.0
    return min(lots, spec.volume_max)


def size_for_risk(equity: float, risk_pct: float, stop_distance: float, spec: SymbolSpec, max_lots: float | None = None) -> float:
    mpu = spec.money_per_price_unit()
    if stop_distance <= 0 or mpu <= 0 or equity <= 0:
        return 0.0
    lots = (equity * risk_pct / 100.0) / (stop_distance * mpu)
    if max_lots:
        lots = min(lots, max_lots)
    return round_volume(lots, spec)


def run_backtest(bars: list[Bar], strategy: Strategy, spec: SymbolSpec, *, equity: float = 10000.0, risk_pct: float = 1.0,
                 max_lots: float | None = None, max_bars_held: int | None = None) -> dict[str, Any]:
    s = strategy.prepare(bars)
    half_spread = spec.spread_points * spec.point / 2.0
    mpu = spec.money_per_price_unit()
    trades: list[BtTrade] = []
    curve: list[dict[str, float]] = []
    eq = float(equity)
    peak = eq
    max_dd = 0.0
    pos = None  # dict with direction, entry, stop, target, volume, time, idx, reason
    pending = None  # Entry decided at bar i, filled at open of i+1
    for i in range(len(bars)):
        b = bars[i]
        # 1) fill pending entry at this bar's open
        if pending is not None and pos is None:
            e = pending; pending = None
            price = b.open + half_spread if e.direction > 0 else b.open - half_spread
            dist = abs(price - e.stop)
            vol = size_for_risk(eq, risk_pct, dist, spec, max_lots)
            if vol > 0 and ((e.direction > 0 and e.stop < price) or (e.direction < 0 and e.stop > price)):
                pos = {"direction": e.direction, "entry": price, "stop": e.stop, "stop_initial": e.stop, "target": e.target,
                       "volume": vol, "time": b.time, "idx": i, "reason": e.reason, "comm": vol * spec.commission_per_lot}
        # 2) manage open position within this bar: stop / target hits
        if pos is not None:
            exit_price = None; reason = ""
            if pos["direction"] > 0:
                if b.low <= pos["stop"]:
                    exit_price, reason = min(pos["stop"], b.open), "stop"
                elif pos["target"] and b.high >= pos["target"]:
                    exit_price, reason = pos["target"], "target"
            else:
                if b.high >= pos["stop"]:
                    exit_price, reason = max(pos["stop"], b.open), "stop"
                elif pos["target"] and b.low <= pos["target"]:
                    exit_price, reason = pos["target"], "target"
            if exit_price is None:
                # end-of-bar management
                new_stop, exit_now = strategy.manage(s, i, pos["direction"], pos["entry"], pos["stop"], i - pos["idx"])
                pos["stop"] = new_stop
                if exit_now:
                    exit_price, reason = (b.close - half_spread if pos["direction"] > 0 else b.close + half_spread), "signal exit"
                elif max_bars_held and i - pos["idx"] >= max_bars_held:
                    exit_price, reason = (b.close - half_spread if pos["direction"] > 0 else b.close + half_spread), "time exit"
            if exit_price is not None:
                if pos["direction"] > 0:
                    exit_fill = exit_price - (0 if reason in ("stop", "target") else 0)  # spread already in close exits
                else:
                    exit_fill = exit_price
                gross = (exit_fill - pos["entry"]) * pos["direction"] * pos["volume"] * mpu
                comm = pos["comm"] + pos["volume"] * spec.commission_per_lot
                net = gross - comm
                risk_money = abs(pos["entry"] - pos["stop_initial"]) * pos["volume"] * mpu
                trades.append(BtTrade(pos["direction"], pos["time"], b.time, pos["entry"], exit_fill, pos["stop_initial"], pos["volume"],
                                      round(gross, 2), round(comm, 2), round(net, 2), round(net / risk_money, 3) if risk_money else 0.0,
                                      i - pos["idx"], pos["reason"], reason))
                eq += net
                pos = None
        # 3) decide a new entry on this bar's close (filled next bar)
        if pos is None and pending is None and i >= strategy.warmup:
            e = strategy.entry(s, i)
            if e is not None:
                pending = e
        # equity curve (mark-to-market)
        mtm = eq
        if pos is not None:
            mtm += (b.close - pos["entry"]) * pos["direction"] * pos["volume"] * mpu - pos["comm"]
        peak = max(peak, mtm)
        dd = peak - mtm
        max_dd = max(max_dd, dd)
        curve.append({"t": b.time, "equity": round(mtm, 2), "dd": round(-dd, 2)})
    return {"trades": [asdict(t) for t in trades], "curve": curve, "stats": stats(trades, equity, eq, max_dd, len(bars), bars[0].time if bars else 0, bars[-1].time if bars else 0)}


def stats(trades: list[BtTrade], start_eq: float, end_eq: float, max_dd: float, nbars: int, t0: int, t1: int) -> dict[str, Any]:
    wins = [t for t in trades if t.net > 0]; losses = [t for t in trades if t.net < 0]
    gp = sum(t.net for t in wins); gl = -sum(t.net for t in losses)
    net = end_eq - start_eq
    rets = [t.net for t in trades]
    mean = sum(rets) / len(rets) if rets else 0.0
    var = sum((r - mean) ** 2 for r in rets) / (len(rets) - 1) if len(rets) > 1 else 0.0
    days = max(1.0, (t1 - t0) / 86400.0)
    # consecutive losses
    worst_streak = streak = 0
    for t in trades:
        streak = streak + 1 if t.net < 0 else 0
        worst_streak = max(worst_streak, streak)
    return {
        "start_equity": round(start_eq, 2), "end_equity": round(end_eq, 2), "net": round(net, 2),
        "return_pct": round(net / start_eq * 100, 2) if start_eq else None,
        "trades": len(trades), "wins": len(wins), "losses": len(losses),
        "win_rate": round(len(wins) / len(trades), 4) if trades else None,
        "profit_factor": round(gp / gl, 2) if gl > 0 else ("inf" if gp > 0 else None),
        "avg_win": round(gp / len(wins), 2) if wins else None, "avg_loss": round(-gl / len(losses), 2) if losses else None,
        "expectancy": round(net / len(trades), 2) if trades else None,
        "avg_r": round(sum(t.r_multiple for t in trades) / len(trades), 3) if trades else None,
        "max_drawdown": round(max_dd, 2), "max_drawdown_pct": round(max_dd / start_eq * 100, 2) if start_eq else None,
        "worst_losing_streak": worst_streak,
        "trade_sharpe": round(mean / var ** 0.5 * (len(rets) ** 0.5), 2) if var > 0 else None,
        "days": round(days, 1), "bars": nbars, "trades_per_month": round(len(trades) / days * 30, 1),
        "avg_bars_held": round(sum(t.bars_held for t in trades) / len(trades), 1) if trades else None,
        "commission": round(sum(t.commission for t in trades), 2),
    }
