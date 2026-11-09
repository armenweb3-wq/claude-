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
            self.log("ERROR", f"Connection failed: {exc}")
            return False
        mode = "DEMO/MOCK DATA" if self.cfg.get("mock") else "live terminal"
        self.log("INFO", f"Connected to account {info.get('login')} on {info.get('server')} ({mode})")
        self.status("connected", f"Connected to {info.get('server')}")
        self.consecutive_failures = 0
        return True

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
            if self.consecutive_failures >= 5:
                self.status("error", "Lost connection to terminal - reconnecting")
                self.disconnect()
            self.send({"type": "heartbeat"})
            time.sleep(refresh)
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
