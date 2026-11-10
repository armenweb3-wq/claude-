"""Live / paper execution engine. One instance per account, living inside
that account's worker process (the only place with an MT5 connection).

Paper mode simulates fills against the real live tick (ask/bid) and keeps its
own ledger; live mode sends orders through the same validated path as the
manual Trade page (limits, broker pre-check, audit) under the bot's own magic
number. Either way every decision is logged.
"""

from __future__ import annotations

import json
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .. import mt5_constants as C
from .backtest import SymbolSpec, size_for_risk
from .strategies import Bar, Strategy, make_strategy

DEFAULT_CONFIG: dict[str, Any] = {
    "mode": "paper",                 # paper | live
    "strategy": "trend_breakout",
    "params": {},
    "symbols": ["EURUSD"],
    "timeframe": "H1",
    "risk_percent": 0.5,
    "max_positions": 2,
    "max_daily_loss_percent": 2.0,
    "max_lots": 1.0,
    "max_spread_points": 0,          # 0 = no filter
    "trading_hours_utc": "00:00-24:00",
    "max_bars_held": 0,              # 0 = no time exit
    "paper_equity": 0.0,             # 0 = start from live equity
    "autostart": False,              # start automatically when the worker connects
}


def _hours_ok(spec: str, now: datetime) -> bool:
    try:
        a, b = spec.split("-")
        h1, m1 = (int(x) for x in a.split(":")); h2, m2 = (int(x) for x in b.split(":"))
    except (ValueError, AttributeError):
        return True
    cur = now.hour * 60 + now.minute
    start, end = h1 * 60 + m1, h2 * 60 + m2
    if end >= 24 * 60:
        end = 24 * 60
    return start <= cur < end if start <= end else (cur >= start or cur < end)


class BotEngine:
    def __init__(self, acc_id: str, adapter: Any, cfg: dict[str, Any], *, data_dir: Path, log: Callable[[str, str], None],
                 live_open: Callable[[dict[str, Any]], dict[str, Any]], live_close: Callable[[int], dict[str, Any]],
                 live_modify: Callable[[int, float, float | None], dict[str, Any]], magic: int, deals: Callable[[], list[dict[str, Any]]]):
        self.acc_id = acc_id
        self.adapter = adapter
        self.cfg = {**DEFAULT_CONFIG, **(cfg or {})}
        self.data_dir = data_dir
        self._log = log
        self.live_open, self.live_close, self.live_modify = live_open, live_close, live_modify
        self.magic = magic
        self._deals = deals
        self.running = False
        self.mode = self.cfg.get("mode", "paper")
        self.started_at: float | None = None
        self.halt_reason: str | None = None
        self.day: str | None = None
        self.day_start_equity: float | None = None
        self.symbols: dict[str, dict[str, Any]] = {}      # per-symbol runtime state
        self.paper = {"equity": 0.0, "start_equity": 0.0, "trades": [], "positions": {}}
        self.decisions: deque = deque(maxlen=200)
        self.strategy: Strategy = make_strategy(self.cfg["strategy"], self.cfg.get("params"))
        self._specs: dict[str, SymbolSpec] = {}
        self._dirty = True
        self._last_error: str | None = None
        self.load_paper()

    # ------------------------------------------------------------------ #
    def note(self, level: str, msg: str, **extra: Any) -> None:
        self.decisions.append({"ts": time.time(), "level": level, "message": msg, **extra})
        self._log(level, f"BOT {msg}")
        self._dirty = True

    def paper_path(self) -> Path:
        return self.data_dir / f"bot-paper-{self.acc_id}.json"

    def load_paper(self) -> None:
        try:
            self.paper = json.loads(self.paper_path().read_text(encoding="utf-8"))
        except (OSError, ValueError):
            pass

    def save_paper(self) -> None:
        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            self.paper_path().write_text(json.dumps(self.paper, default=str), encoding="utf-8")
        except OSError:
            pass

    # ------------------------------------------------------------------ #
    def update_config(self, cfg: dict[str, Any]) -> None:
        was_running = self.running
        self.cfg = {**DEFAULT_CONFIG, **(cfg or {})}
        self.strategy = make_strategy(self.cfg["strategy"], self.cfg.get("params"))
        self.mode = self.cfg.get("mode", "paper")
        for sym in list(self.symbols):
            if sym not in self.cfg["symbols"]:
                self.symbols.pop(sym)
        self._specs.clear()
        self._dirty = True
        if was_running:
            self.note("INFO", f"configuration updated while running ({self.strategy.name}, {', '.join(self.cfg['symbols'])}, {self.cfg['timeframe']})")

    def start(self, mode: str | None = None) -> None:
        if mode:
            self.mode = mode
            self.cfg["mode"] = mode
        if self.mode not in ("paper", "live"):
            raise ValueError("mode must be paper or live")
        acc = self.adapter.account_info() or {}
        if self.mode == "paper":
            if not self.paper.get("equity") or self.paper.get("mode_reset"):
                eq = float(self.cfg.get("paper_equity") or acc.get("equity") or 10000.0)
                self.paper = {"equity": eq, "start_equity": eq, "trades": [], "positions": {}}
                self.save_paper()
        self.running = True
        self.started_at = time.time()
        self.halt_reason = None
        self._roll_day(force=True)
        self.note("INFO", f"started in {self.mode.upper()} mode: {self.strategy.name} on {', '.join(self.cfg['symbols'])} {self.cfg['timeframe']}, "
                          f"risk {self.cfg['risk_percent']}%/trade, max {self.cfg['max_positions']} positions, daily loss limit {self.cfg['max_daily_loss_percent']}%")

    def stop(self, reason: str = "stopped by user") -> None:
        if self.running:
            self.note("INFO", f"stopped ({reason}); open positions are left as they are")
        self.running = False
        self._dirty = True

    def reset_paper(self) -> None:
        acc = self.adapter.account_info() or {}
        eq = float(self.cfg.get("paper_equity") or acc.get("equity") or 10000.0)
        self.paper = {"equity": eq, "start_equity": eq, "trades": [], "positions": {}}
        self.save_paper()
        self.note("INFO", f"paper ledger reset to {eq:.2f}")

    # ------------------------------------------------------------------ #
    def spec(self, symbol: str) -> SymbolSpec:
        sp = self._specs.get(symbol)
        if sp is None:
            info = self.adapter.symbol_info(symbol)
            sp = SymbolSpec(point=float(info["point"]), tick_size=float(info.get("trade_tick_size") or info["point"]),
                            tick_value=float(info.get("trade_tick_value") or 0), volume_min=float(info.get("volume_min") or 0.01),
                            volume_max=float(info.get("volume_max") or 100), volume_step=float(info.get("volume_step") or 0.01),
                            spread_points=float(info.get("spread") or 0), contract_size=float(info.get("trade_contract_size") or 0))
            sp.stops_level = float(info.get("trade_stops_level") or 0)  # type: ignore[attr-defined]
            sp.digits = int(info.get("digits") or 5)  # type: ignore[attr-defined]
            self._specs[symbol] = sp
        return sp

    def _roll_day(self, force: bool = False) -> None:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if force or today != self.day:
            self.day = today
            if self.mode == "paper":
                self.day_start_equity = float(self.paper.get("equity") or 0)
            else:
                self.day_start_equity = float((self.adapter.account_info() or {}).get("equity") or 0)
            if self.halt_reason and self.halt_reason.startswith("daily loss"):
                self.halt_reason = None
                self.note("INFO", "new trading day - daily loss halt lifted")

    def daily_pl(self) -> float:
        if self.mode == "paper":
            day_start = datetime.strptime(self.day or "1970-01-01", "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
            realized = sum(t["net"] for t in self.paper["trades"] if t["exit_time"] >= day_start)
            floating = sum(p.get("floating", 0.0) for p in self.paper["positions"].values())
            return realized + floating
        day_start = datetime.strptime(self.day or "1970-01-01", "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp()
        realized = sum(d["profit"] + d["commission"] + d["swap"] + d["fee"] for d in self._deals()
                       if d.get("magic") == self.magic and d.get("type") in C.TRADING_DEAL_TYPES and float(d.get("time") or 0) >= day_start)
        floating = sum(float(p.get("profit") or 0) + float(p.get("swap") or 0) for p in self.adapter.positions() if p.get("magic") == self.magic)
        return realized + floating

    def _check_daily_loss(self) -> bool:
        limit = float(self.cfg.get("max_daily_loss_percent") or 0)
        if limit <= 0 or not self.day_start_equity:
            return True
        pl = self.daily_pl()
        if pl <= -self.day_start_equity * limit / 100.0:
            if not self.halt_reason:
                self.halt_reason = f"daily loss limit hit ({pl:.2f} = {pl / self.day_start_equity * 100:.2f}% of day-start equity); no new entries until tomorrow"
                self.note("WARNING", self.halt_reason)
            return False
        return True

    def open_count(self) -> int:
        if self.mode == "paper":
            return len(self.paper["positions"])
        return sum(1 for p in self.adapter.positions() if p.get("magic") == self.magic)

    def live_position(self, symbol: str) -> dict[str, Any] | None:
        for p in self.adapter.positions():
            if p.get("magic") == self.magic and p.get("symbol") == symbol:
                return p
        return None

    # ------------------------------------------------------------------ #
    def tick(self) -> None:
        if not self.running:
            return
        try:
            self._roll_day()
            now = time.time()
            tf_sec = C.TIMEFRAME_SECONDS[self.cfg["timeframe"].upper()]
            for symbol in self.cfg["symbols"]:
                st = self.symbols.setdefault(symbol, {"last_bar": 0, "last_check": 0.0, "last_signal": None, "stop": None, "target": None, "direction": 0, "entry": None, "bars_held": 0})
                # paper: intrabar stop/target checks on every tick
                if self.mode == "paper":
                    self._paper_mark(symbol, st)
                # only fetch bars when a new one can have closed (plus small grace)
                next_close = (st["last_bar"] + tf_sec + 3) if st["last_bar"] else 0
                if now < next_close or now - st["last_check"] < 5:
                    continue
                st["last_check"] = now
                need = self.strategy.warmup + 60
                raw = self.adapter.rates(symbol, self.cfg["timeframe"], need + 1)
                if len(raw) < self.strategy.warmup + 2:
                    continue
                closed = raw[:-1] if raw[-1]["time"] + tf_sec > now else raw
                last = closed[-1]
                if last["time"] == st["last_bar"]:
                    continue
                st["last_bar"] = last["time"]
                bars = [Bar(**b) for b in closed]
                series = self.strategy.prepare(bars)
                i = len(bars) - 1
                self._manage(symbol, st, series, i)
                self._maybe_enter(symbol, st, series, i)
            self._last_error = None
        except Exception as exc:
            if str(exc) != self._last_error:
                self._last_error = str(exc)
                self.note("ERROR", f"tick failed: {exc}")

    # ------------------------------------------------------------------ #
    def _manage(self, symbol: str, st: dict[str, Any], series: Any, i: int) -> None:
        bar = series.bars[i]
        if self.mode == "paper":
            pos = self.paper["positions"].get(symbol)
            if not pos:
                return
            pos["bars_held"] = pos.get("bars_held", 0) + 1
            new_stop, exit_now = self.strategy.manage(series, i, pos["direction"], pos["entry"], pos["stop"], pos["bars_held"])
            if new_stop != pos["stop"]:
                pos["stop"] = new_stop
                self.note("INFO", f"{symbol}: paper stop moved to {new_stop:.5g}")
            if exit_now or (self.cfg.get("max_bars_held") and pos["bars_held"] >= int(self.cfg["max_bars_held"])):
                self._paper_close(symbol, "signal exit" if exit_now else "time exit")
            self.save_paper()
            return
        pos = self.live_position(symbol)
        if not pos:
            if st.get("direction"):
                st.update(direction=0, entry=None, stop=None, target=None, bars_held=0)
                self.note("INFO", f"{symbol}: live position is no longer open (stop/target hit or closed manually)")
            return
        direction = 1 if pos.get("type") == C.POSITION_TYPE_BUY else -1
        st["bars_held"] = st.get("bars_held", 0) + 1
        cur_stop = float(pos.get("sl") or 0) or (st.get("stop") or 0)
        new_stop, exit_now = self.strategy.manage(series, i, direction, float(pos["price_open"]), cur_stop, st["bars_held"])
        if exit_now or (self.cfg.get("max_bars_held") and st["bars_held"] >= int(self.cfg["max_bars_held"])):
            res = self.live_close(int(pos["ticket"]))
            self.note("INFO" if res.get("ok") else "ERROR", f"{symbol}: live exit ({'signal' if exit_now else 'time'}) -> {res.get('result_text')}")
            st.update(direction=0, entry=None, stop=None, target=None, bars_held=0)
            return
        sp = self.spec(symbol)
        if cur_stop and abs(new_stop - cur_stop) >= sp.tick_size:
            moved_forward = (direction > 0 and new_stop > cur_stop) or (direction < 0 and new_stop < cur_stop)
            if moved_forward:
                res = self.live_modify(int(pos["ticket"]), round(new_stop, getattr(sp, "digits", 5)), float(pos.get("tp") or 0) or None)
                self.note("INFO" if res.get("ok") else "WARNING", f"{symbol}: trailing stop {cur_stop:.5g} -> {new_stop:.5g} ({res.get('result_text')})")
                st["stop"] = new_stop

    def _maybe_enter(self, symbol: str, st: dict[str, Any], series: Any, i: int) -> None:
        if self.mode == "paper" and symbol in self.paper["positions"]:
            return
        if self.mode == "live" and self.live_position(symbol):
            return
        e = self.strategy.entry(series, i)
        st["last_signal"] = {"time": series.bars[i].time, "entry": None if e is None else {"direction": e.direction, "stop": e.stop, "target": e.target, "reason": e.reason}}
        if e is None:
            return
        now = datetime.now(timezone.utc)
        if not _hours_ok(self.cfg.get("trading_hours_utc") or "00:00-24:00", now):
            self.note("INFO", f"{symbol}: signal {'LONG' if e.direction > 0 else 'SHORT'} ignored - outside trading hours"); return
        if self.halt_reason or not self._check_daily_loss():
            self.note("INFO", f"{symbol}: signal ignored - {self.halt_reason}"); return
        if self.open_count() >= int(self.cfg.get("max_positions") or 1):
            self.note("INFO", f"{symbol}: signal ignored - max positions ({self.cfg['max_positions']}) reached"); return
        tick = self.adapter.symbol_tick(symbol)
        sp = self.spec(symbol)
        spread_pts = (tick["ask"] - tick["bid"]) / sp.point if sp.point else 0
        max_spread = float(self.cfg.get("max_spread_points") or 0)
        if max_spread and spread_pts > max_spread:
            self.note("INFO", f"{symbol}: signal ignored - spread {spread_pts:.0f} > {max_spread:.0f} points"); return
        price = tick["ask"] if e.direction > 0 else tick["bid"]
        if (e.direction > 0 and e.stop >= price) or (e.direction < 0 and e.stop <= price):
            self.note("INFO", f"{symbol}: signal ignored - stop {e.stop:.5g} on the wrong side of price {price:.5g}"); return
        if self.mode == "paper":
            eq = float(self.paper["equity"])
            vol = size_for_risk(eq, float(self.cfg["risk_percent"]), abs(price - e.stop), sp, float(self.cfg.get("max_lots") or 0) or None)
            if vol <= 0:
                self.note("INFO", f"{symbol}: signal ignored - risk {self.cfg['risk_percent']}% gives less than the minimum lot"); return
            self.paper["positions"][symbol] = {"direction": e.direction, "entry": price, "stop": e.stop, "stop_initial": e.stop, "target": e.target,
                                               "volume": vol, "time": time.time(), "bars_held": 0, "reason": e.reason, "floating": 0.0,
                                               "commission": vol * sp.commission_per_lot}
            self.save_paper()
            self.note("INFO", f"{symbol}: PAPER {'BUY' if e.direction > 0 else 'SELL'} {vol:g} @ {price:.5g} stop {e.stop:.5g}" + (f" target {e.target:.5g}" if e.target else "") + f" - {e.reason}")
            return
        args = {"symbol": symbol, "side": "BUY" if e.direction > 0 else "SELL", "order_kind": "market", "sizing": "risk",
                "risk_percent": float(self.cfg["risk_percent"]), "risk_basis": "equity", "sl_mode": "price", "sl": e.stop,
                "tp_mode": "price" if e.target else "none", "tp": e.target, "comment": f"bot:{self.strategy.key}"[:31], "magic": self.magic,
                "max_lots": float(self.cfg.get("max_lots") or 0) or None}
        res = self.live_open(args)
        ok = res.get("ok")
        r = res.get("result") or {}
        self.note("INFO" if ok else "ERROR", f"{symbol}: LIVE {'BUY' if e.direction > 0 else 'SELL'} {(res.get('plan') or {}).get('volume', '?')} @ {r.get('price', price)} "
                                           f"stop {e.stop:.5g} -> {res.get('result_text') or res.get('error')} - {e.reason}")
        if ok:
            st.update(direction=e.direction, entry=r.get("price", price), stop=e.stop, target=e.target, bars_held=0)

    # ------------------------------------------------------------------ #
    def _paper_mark(self, symbol: str, st: dict[str, Any]) -> None:
        pos = self.paper["positions"].get(symbol)
        if not pos:
            return
        tick = self.adapter.symbol_tick(symbol)
        sp = self.spec(symbol)
        mpu = sp.money_per_price_unit()
        cur = tick["bid"] if pos["direction"] > 0 else tick["ask"]
        pos["floating"] = round((cur - pos["entry"]) * pos["direction"] * pos["volume"] * mpu - pos["commission"], 2)
        pos["current"] = cur
        if pos["direction"] > 0:
            if cur <= pos["stop"]:
                self._paper_close(symbol, "stop", cur)
            elif pos.get("target") and cur >= pos["target"]:
                self._paper_close(symbol, "target", cur)
        else:
            if cur >= pos["stop"]:
                self._paper_close(symbol, "stop", cur)
            elif pos.get("target") and cur <= pos["target"]:
                self._paper_close(symbol, "target", cur)

    def _paper_close(self, symbol: str, reason: str, price: float | None = None) -> None:
        pos = self.paper["positions"].pop(symbol, None)
        if not pos:
            return
        sp = self.spec(symbol)
        if price is None:
            tick = self.adapter.symbol_tick(symbol)
            price = tick["bid"] if pos["direction"] > 0 else tick["ask"]
        mpu = sp.money_per_price_unit()
        gross = (price - pos["entry"]) * pos["direction"] * pos["volume"] * mpu
        comm = pos["commission"] + pos["volume"] * sp.commission_per_lot
        net = round(gross - comm, 2)
        self.paper["equity"] = round(float(self.paper["equity"]) + net, 2)
        self.paper["trades"].append({"symbol": symbol, "direction": "BUY" if pos["direction"] > 0 else "SELL", "entry_time": pos["time"],
                                     "exit_time": time.time(), "entry": pos["entry"], "exit": price, "volume": pos["volume"],
                                     "gross": round(gross, 2), "commission": round(comm, 2), "net": net, "reason_in": pos["reason"], "reason_out": reason})
        self.paper["trades"] = self.paper["trades"][-500:]
        self.save_paper()
        self.note("INFO", f"{symbol}: PAPER close ({reason}) @ {price:.5g} net {net:+.2f}, paper equity {self.paper['equity']:.2f}")

    # ------------------------------------------------------------------ #
    def state(self) -> dict[str, Any]:
        self._dirty = False
        try:
            daily = round(self.daily_pl(), 2) if self.running else None
        except Exception:
            daily = None
        live_positions = []
        if self.mode == "live":
            try:
                live_positions = [{"symbol": p.get("symbol"), "direction": "BUY" if p.get("type") == C.POSITION_TYPE_BUY else "SELL",
                                   "volume": p.get("volume"), "entry": p.get("price_open"), "stop": p.get("sl"), "target": p.get("tp"),
                                   "floating": round(float(p.get("profit") or 0) + float(p.get("swap") or 0), 2), "ticket": p.get("ticket")}
                                  for p in self.adapter.positions() if p.get("magic") == self.magic]
            except Exception:
                pass
        return {
            "running": self.running, "mode": self.mode, "started_at": self.started_at, "halt_reason": self.halt_reason,
            "strategy": self.strategy.describe(), "config": self.cfg, "magic": self.magic, "day": self.day,
            "day_start_equity": self.day_start_equity, "daily_pl": daily,
            "symbols": {s: {"last_bar": v.get("last_bar"), "last_signal": v.get("last_signal")} for s, v in self.symbols.items()},
            "paper": {"equity": self.paper.get("equity"), "start_equity": self.paper.get("start_equity"),
                      "positions": [{"symbol": s, **{k: v for k, v in p.items() if k != "reason"}, "direction": "BUY" if p["direction"] > 0 else "SELL"} for s, p in self.paper.get("positions", {}).items()],
                      "trades": list(self.paper.get("trades", []))[-50:], "trade_count": len(self.paper.get("trades", []))},
            "live_positions": live_positions,
            "decisions": list(self.decisions)[-60:],
            "last_error": self._last_error,
        }
