"""Per-account worker subprocess.

One worker owns exactly one MT5 terminal connection. It is started by the
``Supervisor`` with ``multiprocessing`` (spawn context, so nothing is shared
accidentally) and talks to the main process only through two queues.

Messages worker -> main (``out_q``)::

    {"type": "status", "state": "connecting|connected|degraded|error|stopped", "message": str}
    {"type": "snapshot", "ts": float, "account": {...}, "terminal": {...}, "positions": [...]}
    {"type": "deals", "version": int, "deals": [...], "window": {"from": ts, "to": ts}, "incomplete_positions": [...]}
    {"type": "log", "level": "INFO|WARNING|ERROR", "message": str, "ts": float}
    {"type": "heartbeat", "ts": float}

Messages main -> worker (``cmd_q``)::

    {"cmd": "shutdown"} | {"cmd": "reconnect"} | {"cmd": "refresh_history"}
"""

from __future__ import annotations

import queue
import time
import traceback
from datetime import datetime, timedelta, timezone
from typing import Any

from . import mt5_constants as C
from . import trading as T


def _now() -> float:
    return time.time()


class _Worker:
    def __init__(self, cfg: dict[str, Any], settings: dict[str, Any], cmd_q, out_q):
        self.cfg = cfg
        self.settings = settings
        self.cmd_q = cmd_q
        self.out_q = out_q
        self.adapter = None
        self.deals: dict[int, dict[str, Any]] = {}
        self.deals_version = 0
        self.history_from: datetime | None = None
        self.last_history_fetch = 0.0
        self.last_positions_sig: Any = None
        self.running = True
        self.consecutive_failures = 0
        self.incomplete_positions: list[int] = []
        self._last_conn_error: str | None = None
        self.bot = None
        self._bot_state_sent = 0.0

    # ------------------------------------------------------------------ #
    def send(self, msg: dict[str, Any]) -> None:
        msg.setdefault("ts", _now())
        try:
            self.out_q.put(msg)
        except Exception:
            pass

    def log(self, level: str, message: str) -> None:
        self.send({"type": "log", "level": level, "message": message})

    def status(self, state: str, message: str = "") -> None:
        self.send({"type": "status", "state": state, "message": message})

    # ------------------------------------------------------------------ #
    def make_adapter(self):
        if self.cfg.get("mock"):
            from .mock_adapter import MockAdapter
            return MockAdapter(self.cfg)
        from .mt5_adapter import MT5Adapter
        return MT5Adapter(self.cfg)

    def connect(self) -> bool:
        self.status("connecting", "Initialising terminal connection")
        try:
            if self.adapter is None:
                self.adapter = self.make_adapter()
            info = self.adapter.connect()
        except Exception as exc:
            self.status("error", str(exc))
            if str(exc) != self._last_conn_error:
                self._last_conn_error = str(exc)
                self.log("ERROR", f"Connection failed: {exc}")
                if "initialize() failed" in str(exc):
                    self.log("INFO", "Check terminal_path in config/accounts.json, or set \"mock_mode\": true in config/settings.json to run the demo. Retrying quietly in the background.")
            return False
        self._last_conn_error = None
        mode = "DEMO/MOCK DATA" if self.cfg.get("mock") else "live terminal"
        self.log("INFO", f"Connected to account {info.get('login')} on {info.get('server')} ({mode})")
        self.status("connected", f"Connected to {info.get('server')}")
        self.consecutive_failures = 0
        self._ensure_bot()
        return True

    # ------------------------------------------------------------------ #
    # Trading bot
    # ------------------------------------------------------------------ #
    def _ensure_bot(self):
        from .bot.engine import BotEngine
        from .config import DATA_DIR
        cfg = dict(self.cfg.get("bot") or {})
        tcfg = self.cfg.get("trading") or {}
        magic = int(cfg.get("magic") or (int(tcfg.get("magic") or 710000) + 500))
        if self.bot is None:
            self.bot = BotEngine(self.cfg["id"], self.adapter, cfg, data_dir=DATA_DIR, log=self.log,
                                 live_open=self._bot_open, live_close=self._bot_close, live_modify=self._bot_modify,
                                 magic=magic, deals=lambda: list(self.deals.values()))
            if cfg.get("autostart") and cfg.get("mode") in ("paper", "live"):
                try:
                    self.bot.start(cfg.get("mode"))
                except Exception as exc:
                    self.log("ERROR", f"Bot autostart failed: {exc}")
        else:
            self.bot.adapter = self.adapter
        return self.bot

    def _bot_open(self, args: dict[str, Any]) -> dict[str, Any]:
        try:
            return self.call_trade_execute(args)
        except T.TradeRejected as exc:
            return {"ok": False, "error": str(exc), "result_text": str(exc)}
        except Exception as exc:
            return {"ok": False, "error": str(exc), "result_text": str(exc)}

    def _bot_close(self, ticket: int) -> dict[str, Any]:
        try:
            return self.call_close_position({"ticket": ticket})
        except Exception as exc:
            return {"ok": False, "error": str(exc), "result_text": str(exc)}

    def _bot_modify(self, ticket: int, sl: float, tp: float | None) -> dict[str, Any]:
        try:
            return self.call_modify_position({"ticket": ticket, "sl": sl, "tp": tp})
        except Exception as exc:
            return {"ok": False, "error": str(exc), "result_text": str(exc)}

    def _bot_tick(self) -> None:
        if self.bot is None:
            return
        self.bot.tick()
        now = _now()
        if self.bot._dirty or now - self._bot_state_sent > 3.0:
            self._bot_state_sent = now
            try:
                self.send({"type": "bot_state", "state": self.bot.state()})
            except Exception as exc:
                self.log("WARNING", f"bot state failed: {exc}")

    def call_bot(self, args: dict[str, Any]) -> dict[str, Any]:
        """Bot commands: op = state|config|start|stop|paper_reset|backtest."""
        op = str(args.get("op") or "state")
        if self.adapter is None or not getattr(self.adapter, "connected", False):
            raise T.TradeRejected("Not connected to the terminal.")
        bot = self._ensure_bot()
        if op == "config":
            bot.update_config(args.get("config") or {})
            self.cfg["bot"] = dict(args.get("config") or {})
        elif op == "start":
            mode = str(args.get("mode") or bot.mode)
            if mode == "live":
                self._trading_guard()
            bot.start(mode)
        elif op == "stop":
            bot.stop()
        elif op == "paper_reset":
            bot.reset_paper()
        elif op == "backtest":
            return self._bot_backtest(args)
        elif op != "state":
            raise T.TradeRejected(f"Unknown bot operation '{op}'")
        self._bot_state_sent = _now()
        st = bot.state()
        self.send({"type": "bot_state", "state": st})
        return st

    def _bot_backtest(self, args: dict[str, Any]) -> dict[str, Any]:
        from .bot.backtest import SymbolSpec, run_backtest
        from .bot.strategies import Bar, make_strategy
        symbol = str(args.get("symbol") or "").upper()
        timeframe = str(args.get("timeframe") or "H1").upper()
        bars_n = max(300, min(int(args.get("bars") or 3000), 20000))
        strategy = make_strategy(str(args.get("strategy") or "trend_breakout"), args.get("params") or {})
        info = self.adapter.symbol_info(symbol)
        raw = self.adapter.rates(symbol, timeframe, bars_n)
        if len(raw) < strategy.warmup + 50:
            raise T.TradeRejected(f"Only {len(raw)} bars of {symbol} {timeframe} available; need at least {strategy.warmup + 50}. Open that chart in the terminal once so it downloads history, then retry.")
        spec = SymbolSpec(point=float(info["point"]), tick_size=float(info.get("trade_tick_size") or info["point"]),
                          tick_value=float(info.get("trade_tick_value") or 0), volume_min=float(info.get("volume_min") or 0.01),
                          volume_max=float(info.get("volume_max") or 100), volume_step=float(info.get("volume_step") or 0.01),
                          spread_points=float(args.get("spread_points") or info.get("spread") or 0),
                          commission_per_lot=float(args.get("commission_per_lot") if args.get("commission_per_lot") not in (None, "") else 3.5),
                          contract_size=float(info.get("trade_contract_size") or 0))
        acc = self.adapter.account_info() or {}
        equity = float(args.get("equity") or acc.get("equity") or 10000.0)
        res = run_backtest([Bar(**b) for b in raw if b["time"] + (0) <= _now()], strategy, spec, equity=equity,
                           risk_pct=float(args.get("risk_percent") or 1.0), max_lots=float(args.get("max_lots") or 0) or None,
                           max_bars_held=int(args.get("max_bars_held") or 0) or None)
        res["symbol"] = symbol; res["timeframe"] = timeframe; res["strategy"] = strategy.describe()
        res["spec"] = {"spread_points": spec.spread_points, "commission_per_lot": spec.commission_per_lot, "currency": acc.get("currency")}
        res["from"] = raw[0]["time"]; res["to"] = raw[-1]["time"]; res["mock"] = bool(self.cfg.get("mock"))
        return res

    def disconnect(self) -> None:
        if self.adapter is not None:
            try:
                self.adapter.shutdown()
            except Exception:
                pass
        self.adapter = None

    # ------------------------------------------------------------------ #
    def poll_snapshot(self) -> bool:
        try:
            account = self.adapter.account_info()
            terminal = self.adapter.terminal_info()
            positions = self.adapter.positions()
        except Exception as exc:
            self.consecutive_failures += 1
            self.log("WARNING", f"Poll failed: {exc}")
            return False
        if not account:
            self.consecutive_failures += 1
            self.log("WARNING", f"account_info() returned nothing: {self.adapter.last_error()}")
            return False
        expected = self.cfg.get("login")
        if expected and int(account.get("login") or 0) != int(expected):
            self.status("error", f"Terminal switched to account {account.get('login')} - expected {expected}. Data refused.")
            self.log("ERROR", "Account mismatch detected; refusing to publish data for the wrong account.")
            self.disconnect()
            return False
        self.consecutive_failures = 0
        if terminal and terminal.get("connected") is False:
            self.status("degraded", "Terminal is running but not connected to the broker")
        else:
            self.status("connected", f"Connected to {account.get('server')}")
        self.send({"type": "snapshot", "account": account, "terminal": terminal, "positions": positions})
        sig = tuple(sorted((p.get("ticket"), p.get("volume")) for p in positions))
        if sig != self.last_positions_sig:
            self.last_positions_sig = sig
            self.last_history_fetch = 0.0  # positions changed -> refresh deals soon
        return True

    def fetch_history(self, full: bool = False) -> None:
        now = datetime.now(timezone.utc)
        lookback = int(self.settings.get("history_lookback_days") or 365)
        if full or self.history_from is None or not self.deals:
            date_from = now - timedelta(days=lookback)
            self.history_from = date_from
        else:
            last_ts = max((d["time"] for d in self.deals.values()), default=0)
            date_from = datetime.fromtimestamp(last_ts, tz=timezone.utc) - timedelta(days=2)
        date_to = now + timedelta(days=2)
        try:
            fetched = self.adapter.deals(date_from, date_to)
        except Exception as exc:
            self.log("WARNING", f"History fetch failed: {exc}")
            return
        if fetched is None:
            self.log("WARNING", f"history_deals_get() failed: {self.adapter.last_error()}")
            return
        changed = False
        for d in fetched:
            t = d.get("ticket")
            if t is None:
                continue
            if self.deals.get(t) != d:
                self.deals[t] = d
                changed = True
        if changed or full:
            self._complete_positions()
            self.deals_version += 1
            deals = sorted(self.deals.values(), key=lambda d: (d.get("time_msc") or 0, d.get("ticket") or 0))
            self.send({
                "type": "deals",
                "version": self.deals_version,
                "deals": deals,
                "window": {"from": self.history_from.timestamp(), "to": now.timestamp()},
                "incomplete_positions": list(self.incomplete_positions),
            })
            self.log("INFO", f"History updated: {len(deals)} deals since {self.history_from:%Y-%m-%d}")
        self.last_history_fetch = _now()

    def _complete_positions(self) -> None:
        """For positions whose exit is in the window but entry is not, pull the
        missing deals by position id so partial closes / old entries resolve."""
        entries: set[int] = set()
        exits: set[int] = set()
        for d in self.deals.values():
            if d.get("type") not in C.TRADING_DEAL_TYPES:
                continue
            pid = d.get("position_id") or 0
            if d.get("entry") in (C.DEAL_ENTRY_IN, C.DEAL_ENTRY_INOUT):
                entries.add(pid)
            if d.get("entry") in (C.DEAL_ENTRY_OUT, C.DEAL_ENTRY_OUT_BY, C.DEAL_ENTRY_INOUT):
                exits.add(pid)
        missing = sorted(pid for pid in exits - entries if pid)
        still_missing: list[int] = []
        for pid in missing[:200]:
            try:
                extra = self.adapter.deals_for_position(pid)
            except Exception:
                extra = []
            found_entry = False
            for d in extra:
                if d.get("entry") in (C.DEAL_ENTRY_IN, C.DEAL_ENTRY_INOUT):
                    found_entry = True
                self.deals.setdefault(d["ticket"], d)
            if not found_entry:
                still_missing.append(pid)
        self.incomplete_positions = still_missing
        if still_missing:
            self.log("WARNING", f"{len(still_missing)} position(s) have exits but no entry deals in terminal history; they are flagged as incomplete.")

    # ------------------------------------------------------------------ #
    def handle_commands(self) -> None:
        while True:
            try:
                cmd = self.cmd_q.get_nowait()
            except queue.Empty:
                return
            name = cmd.get("cmd") if isinstance(cmd, dict) else cmd
            if name == "shutdown":
                self.running = False
            elif name == "reconnect":
                self.log("INFO", "Reconnect requested")
                self.disconnect()
                self.deals.clear()
                self.history_from = None
            elif name == "refresh_history":
                self.last_history_fetch = 0.0
                self.history_from = None
            elif name == "call":
                self.handle_call(cmd)

    # ------------------------------------------------------------------ #
    # Request/response calls (symbol lookups and trading)
    # ------------------------------------------------------------------ #
    def handle_call(self, cmd: dict[str, Any]) -> None:
        req_id = cmd.get("req_id")
        fn_name = str(cmd.get("name") or "")
        args = cmd.get("args") or {}
        try:
            if self.adapter is None or not getattr(self.adapter, "connected", False):
                raise T.TradeRejected("Not connected to the terminal.")
            handler = {
                "symbol_info": self.call_symbol_info,
                "trade_preview": self.call_trade_preview,
                "trade_execute": self.call_trade_execute,
                "close_position": self.call_close_position,
                "modify_position": self.call_modify_position,
                "bot": self.call_bot,
            }.get(fn_name)
            if handler is None:
                raise T.TradeRejected(f"Unknown call '{fn_name}'")
            data = handler(args)
            self.send({"type": "result", "req_id": req_id, "ok": True, "data": data})
        except T.TradeRejected as exc:
            self.send({"type": "result", "req_id": req_id, "ok": False, "error": str(exc), "rejected": True})
        except Exception as exc:
            self.log("ERROR", f"Call {fn_name} failed: {exc}")
            self.send({"type": "result", "req_id": req_id, "ok": False, "error": str(exc)})

    def _trading_guard(self) -> dict[str, Any]:
        """Everything that must be true before any order leaves this worker."""
        tcfg = self.cfg.get("trading") or {}
        if not self.settings.get("trading_enabled"):
            raise T.TradeRejected("Trading is switched off globally (settings.json: trading_enabled).")
        if not tcfg.get("enabled"):
            raise T.TradeRejected("Trading is switched off for this account (accounts.json: trading.enabled).")
        account = self.adapter.account_info()
        expected = self.cfg.get("login")
        if expected and int(account.get("login") or 0) != int(expected):
            raise T.TradeRejected("Terminal account does not match the configured login; refusing to trade.")
        if account.get("trade_allowed") is False:
            raise T.TradeRejected("The broker reports trading is not allowed on this account (investor password or disabled account).")
        term = self.adapter.terminal_info()
        if term and term.get("trade_allowed") is False:
            raise T.TradeRejected("Algorithmic trading is disabled in the terminal (Tools > Options > Expert Advisors).")
        if term and term.get("connected") is False:
            raise T.TradeRejected("The terminal is not connected to the broker.")
        return account

    def call_symbol_info(self, args: dict[str, Any]) -> dict[str, Any]:
        symbol = str(args.get("symbol") or "").strip().upper()
        if not symbol:
            raise T.TradeRejected("Symbol is required.")
        info = self.adapter.symbol_info(symbol)
        tick = self.adapter.symbol_tick(symbol)
        return {"info": info, "tick": tick}

    def _plan(self, args: dict[str, Any]) -> tuple[T.OrderPlan, dict, dict, dict]:
        account = self._trading_guard()
        tcfg = dict(self.cfg.get("trading") or {})
        if args.get("max_lots"):
            tcfg["max_lots"] = min(float(tcfg.get("max_lots") or args["max_lots"]), float(args["max_lots"]))
        symbol = str(args.get("symbol") or "").strip().upper()
        info = self.adapter.symbol_info(symbol)
        tick = self.adapter.symbol_tick(symbol)
        plan = T.build_plan(args, info, tick, account, tcfg)
        positions = self.adapter.positions()
        max_pos = int(tcfg.get("max_open_positions") or 0)
        if max_pos and len(positions) >= max_pos:
            raise T.TradeRejected(f"This account already has {len(positions)} open positions (max_open_positions = {max_pos}).")
        request = T.build_order_request(plan, info, int(args.get("magic") or tcfg.get("magic") or 0), int(tcfg.get("deviation_points") or 20),
                                        str(args.get("comment") or "mt5cc"))
        return plan, request, info, account

    def call_trade_preview(self, args: dict[str, Any]) -> dict[str, Any]:
        plan, request, info, account = self._plan(args)
        check = self.adapter.order_check(request)
        rc = check.get("retcode")
        return {"plan": plan.to_dict(), "request": request, "check": check,
                "check_ok": rc in C.TRADE_RETCODE_OK, "check_text": T.retcode_name(rc),
                "account": {"equity": account.get("equity"), "balance": account.get("balance"), "margin_free": account.get("margin_free"), "currency": account.get("currency")},
                "symbol": {k: info.get(k) for k in ("digits", "point", "volume_min", "volume_max", "volume_step", "trade_stops_level",
                                                    "trade_contract_size", "trade_tick_value", "trade_tick_size", "spread", "currency_profit")}}

    def call_trade_execute(self, args: dict[str, Any]) -> dict[str, Any]:
        plan, request, info, account = self._plan(args)
        expected = args.get("expected")
        if expected:
            # the user confirmed a specific plan; refuse if the market moved it materially
            if abs(float(expected.get("volume") or 0) - plan.volume) > 1e-9:
                raise T.TradeRejected(f"Volume changed since preview ({expected.get('volume')} -> {plan.volume}). Preview again.")
            if expected.get("symbol") != plan.symbol or int(expected.get("order_type", -1)) != plan.order_type:
                raise T.TradeRejected("Order details changed since preview. Preview again.")
        check = self.adapter.order_check(request)
        if check.get("retcode") not in C.TRADE_RETCODE_OK:
            raise T.TradeRejected(f"Broker pre-check failed: {T.retcode_name(check.get('retcode'))} ({check.get('comment')})")
        self.log("INFO", f"ORDER SEND {plan.symbol} {C.ORDER_TYPE_NAMES.get(plan.order_type)} {plan.volume} lots @ {plan.entry} sl={plan.sl} tp={plan.tp}")
        result = self.adapter.order_send(request)
        ok = result.get("retcode") in C.TRADE_RETCODE_OK
        self.log("INFO" if ok else "ERROR", f"ORDER RESULT {T.retcode_name(result.get('retcode'))}: {result.get('comment')} deal={result.get('deal')} order={result.get('order')} price={result.get('price')}")
        self.last_history_fetch = 0.0
        return {"ok": ok, "plan": plan.to_dict(), "request": request, "result": result, "result_text": T.retcode_name(result.get("retcode"))}

    def _find_position(self, ticket: int) -> dict[str, Any]:
        for p in self.adapter.positions():
            if int(p.get("ticket") or 0) == int(ticket):
                return p
        raise T.TradeRejected(f"Position {ticket} is not open on this account.")

    def call_close_position(self, args: dict[str, Any]) -> dict[str, Any]:
        self._trading_guard()
        tcfg = self.cfg.get("trading") or {}
        pos = self._find_position(int(args.get("ticket") or 0))
        info = self.adapter.symbol_info(pos["symbol"])
        tick = self.adapter.symbol_tick(pos["symbol"])
        vol = args.get("volume")
        request = T.build_close_request(pos, info, tick, float(vol) if vol not in (None, "", 0) else None,
                                        int(tcfg.get("magic") or 0), int(tcfg.get("deviation_points") or 20))
        self.log("INFO", f"CLOSE position {pos['ticket']} {pos['symbol']} volume {request['volume']}")
        result = self.adapter.order_send(request)
        ok = result.get("retcode") in C.TRADE_RETCODE_OK
        self.log("INFO" if ok else "ERROR", f"CLOSE RESULT {T.retcode_name(result.get('retcode'))}: {result.get('comment')} price={result.get('price')}")
        self.last_history_fetch = 0.0
        return {"ok": ok, "request": request, "result": result, "result_text": T.retcode_name(result.get("retcode"))}

    def call_modify_position(self, args: dict[str, Any]) -> dict[str, Any]:
        self._trading_guard()
        pos = self._find_position(int(args.get("ticket") or 0))
        info = self.adapter.symbol_info(pos["symbol"])
        sl = args.get("sl"); tp = args.get("tp")
        request = T.build_modify_request(pos, info, float(sl) if sl not in (None, "") else None, float(tp) if tp not in (None, "") else None)
        self.log("INFO", f"MODIFY position {pos['ticket']} sl={request['sl']} tp={request['tp']}")
        result = self.adapter.order_send(request)
        ok = result.get("retcode") in C.TRADE_RETCODE_OK
        self.log("INFO" if ok else "ERROR", f"MODIFY RESULT {T.retcode_name(result.get('retcode'))}: {result.get('comment')}")
        return {"ok": ok, "request": request, "result": result, "result_text": T.retcode_name(result.get("retcode"))}

    def run(self) -> None:
        refresh = float(self.settings.get("refresh_seconds") or 2.0)
        hist_every = float(self.settings.get("history_refresh_seconds") or 15.0)
        backoff = 2.0
        while self.running:
            self.handle_commands()
            if not self.running:
                break
            if self.adapter is None or not getattr(self.adapter, "connected", False):
                if not self.connect():
                    self.send({"type": "heartbeat"})
                    deadline = _now() + backoff
                    while _now() < deadline and self.running:
                        self.handle_commands()
                        time.sleep(0.25)
                    backoff = min(backoff * 2, 60.0)
                    continue
                backoff = 2.0
                self.fetch_history(full=True)
            ok = self.poll_snapshot()
            if ok and _now() - self.last_history_fetch >= hist_every:
                self.fetch_history()
            if ok:
                try:
                    self._bot_tick()
                except Exception as exc:
                    self.log("ERROR", f"Bot tick crashed: {exc}")
            if self.consecutive_failures >= 5:
                self.status("error", "Lost connection to terminal - reconnecting")
                self.disconnect()
            self.send({"type": "heartbeat"})
            deadline = _now() + refresh
            while self.running and _now() < deadline:
                self.handle_commands()
                time.sleep(0.1)
        self.disconnect()
        self.status("stopped", "Worker stopped")


def worker_main(cfg: dict[str, Any], settings: dict[str, Any], cmd_q, out_q) -> None:
    """Entry point executed in the child process."""
    w = _Worker(cfg, settings, cmd_q, out_q)
    try:
        w.run()
    except Exception as exc:  # pragma: no cover
        w.status("error", f"Worker crashed: {exc}")
        w.log("ERROR", traceback.format_exc())
