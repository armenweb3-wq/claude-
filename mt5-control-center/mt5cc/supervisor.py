"""Starts, watches and restarts one worker subprocess per account, and keeps
the latest state received from each worker in memory for the web layer."""

from __future__ import annotations

import logging
import multiprocessing as mp
import queue
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from .config import AccountConfig, Settings
from .worker import worker_main

log = logging.getLogger("mt5cc.supervisor")


@dataclass
class AccountState:
    cfg: AccountConfig
    state: str = "starting"           # starting|connecting|connected|degraded|error|stopped|stale
    message: str = ""
    account: dict[str, Any] = field(default_factory=dict)
    terminal: dict[str, Any] = field(default_factory=dict)
    positions: list[dict[str, Any]] = field(default_factory=list)
    deals: list[dict[str, Any]] = field(default_factory=list)
    deals_version: int = 0
    history_window: dict[str, float] = field(default_factory=dict)
    incomplete_positions: list[int] = field(default_factory=list)
    last_snapshot_ts: float | None = None
    last_heartbeat_ts: float | None = None
    last_deals_ts: float | None = None
    restarts: int = 0
    bot: dict[str, Any] = field(default_factory=dict)
    logs: deque = field(default_factory=lambda: deque(maxlen=200))
    started_ts: float = field(default_factory=time.time)

    def effective_state(self, now: float, refresh_seconds: float) -> str:
        if self.state in ("stopped", "error", "connecting", "starting"):
            return self.state
        if self.last_heartbeat_ts is None:
            return "connecting"
        if now - self.last_heartbeat_ts > max(10.0, refresh_seconds * 5):
            return "stale"
        return self.state


class Supervisor:
    def __init__(self, accounts: list[AccountConfig], settings: Settings):
        self.settings = settings
        self.ctx = mp.get_context("spawn")
        self.states: dict[str, AccountState] = {a.id: AccountState(cfg=a) for a in accounts}
        self._procs: dict[str, Any] = {}
        self._cmd_qs: dict[str, Any] = {}
        self._out_qs: dict[str, Any] = {}
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.listeners: list[Any] = []   # callables(account_id, state) called on snapshot
        self._pending: dict[str, dict[str, Any]] = {}   # req_id -> {"event": Event, "result": msg}

    # ------------------------------------------------------------------ #
    def start(self) -> None:
        for acc_id in self.states:
            self._spawn(acc_id)
        self._thread = threading.Thread(target=self._pump, name="mt5cc-pump", daemon=True)
        self._thread.start()

    def _spawn(self, acc_id: str) -> None:
        st = self.states[acc_id]
        cmd_q = self.ctx.Queue()
        out_q = self.ctx.Queue()
        proc = self.ctx.Process(
            target=worker_main,
            args=(st.cfg.worker_dict(), self.settings.to_dict(), cmd_q, out_q),
            name=f"mt5cc-worker-{acc_id}",
            daemon=True,
        )
        proc.start()
        with self._lock:
            self._procs[acc_id] = proc
            self._cmd_qs[acc_id] = cmd_q
            self._out_qs[acc_id] = out_q
            st.state = "starting"
            st.message = "Worker process started"
            st.last_heartbeat_ts = time.time()
            st.started_ts = time.time()
        log.info("Started worker for %s (pid %s)", acc_id, proc.pid)

    def stop(self) -> None:
        self._stop.set()
        for acc_id, q in list(self._cmd_qs.items()):
            try:
                q.put({"cmd": "shutdown"})
            except Exception:
                pass
        deadline = time.time() + 5
        for acc_id, proc in list(self._procs.items()):
            proc.join(timeout=max(0.1, deadline - time.time()))
            if proc.is_alive():
                log.warning("Worker %s did not exit in time; terminating", acc_id)
                proc.terminate()
                proc.join(timeout=2)
        if self._thread:
            self._thread.join(timeout=2)

    # ------------------------------------------------------------------ #
    # Live add / remove / restart (used by the Accounts page)
    # ------------------------------------------------------------------ #
    def add_account(self, cfg: AccountConfig) -> None:
        with self._lock:
            self.states[cfg.id] = AccountState(cfg=cfg)
        self._spawn(cfg.id)

    def _kill(self, acc_id: str) -> None:
        q = self._cmd_qs.pop(acc_id, None)
        proc = self._procs.pop(acc_id, None)
        self._out_qs.pop(acc_id, None)
        if q is not None:
            try:
                q.put({"cmd": "shutdown"})
            except Exception:
                pass
        if proc is not None:
            proc.join(timeout=4)
            if proc.is_alive():
                proc.terminate()
                proc.join(timeout=2)

    def remove_account(self, acc_id: str) -> None:
        with self._lock:
            self.states.pop(acc_id, None)
        self._kill(acc_id)

    def restart_account(self, cfg: AccountConfig) -> None:
        self._kill(cfg.id)
        with self._lock:
            old = self.states.get(cfg.id)
            st = AccountState(cfg=cfg)
            if old is not None:
                st.restarts = old.restarts + 1
                st.logs = old.logs
            self.states[cfg.id] = st
        self._spawn(cfg.id)

    def apply_settings(self, settings: Settings) -> None:
        """Replace settings and restart every worker so they pick them up."""
        self.settings = settings
        for acc_id in list(self.states):
            self.restart_account(self.states[acc_id].cfg)

    # ------------------------------------------------------------------ #
    def send_command(self, acc_id: str, cmd: str) -> bool:
        q = self._cmd_qs.get(acc_id)
        if q is None:
            return False
        try:
            q.put({"cmd": cmd})
            return True
        except Exception:
            return False

    def call(self, acc_id: str, name: str, args: dict[str, Any] | None = None, timeout: float = 20.0) -> dict[str, Any]:
        """Send a request to a worker and wait for its reply."""
        q = self._cmd_qs.get(acc_id)
        if q is None:
            return {"ok": False, "error": "Worker is not running."}
        req_id = uuid.uuid4().hex
        slot = {"event": threading.Event(), "result": None}
        with self._lock:
            self._pending[req_id] = slot
        try:
            q.put({"cmd": "call", "req_id": req_id, "name": name, "args": args or {}})
            if not slot["event"].wait(timeout):
                return {"ok": False, "error": f"Worker did not answer within {timeout:.0f}s."}
            return slot["result"] or {"ok": False, "error": "Empty reply."}
        finally:
            with self._lock:
                self._pending.pop(req_id, None)

    def _pump(self) -> None:
        while not self._stop.is_set():
            got_any = False
            now = time.time()
            for acc_id, q in list(self._out_qs.items()):
                st = self.states.get(acc_id)
                if st is None or self._procs.get(acc_id) is None:
                    continue
                for _ in range(500):
                    try:
                        msg = q.get_nowait()
                    except queue.Empty:
                        break
                    except Exception:
                        break
                    got_any = True
                    self._apply(st, msg)
                proc = self._procs.get(acc_id)
                if proc is not None and self._procs.get(acc_id) is not proc:
                    continue
                if proc is not None and not proc.is_alive() and not self._stop.is_set():
                    with self._lock:
                        st.state = "error"
                        st.message = f"Worker process exited (code {proc.exitcode}); restarting"
                        st.restarts += 1
                        st.logs.append({"ts": now, "level": "ERROR", "message": st.message})
                    time.sleep(min(30, 2 * st.restarts))
                    self._spawn(acc_id)
                elif st.last_heartbeat_ts and now - st.last_heartbeat_ts > 120 and proc is not None:
                    log.warning("Worker %s unresponsive for 120s; restarting", acc_id)
                    proc.terminate()
                    proc.join(timeout=2)
                    with self._lock:
                        st.restarts += 1
                        st.logs.append({"ts": now, "level": "ERROR", "message": "Worker unresponsive; restarted"})
                    self._spawn(acc_id)
            if not got_any:
                time.sleep(0.1)

    def _apply(self, st: AccountState, msg: dict[str, Any]) -> None:
        kind = msg.get("type")
        ts = float(msg.get("ts") or time.time())
        with self._lock:
            if kind == "heartbeat":
                st.last_heartbeat_ts = ts
            elif kind == "status":
                st.state = msg.get("state", st.state)
                st.message = msg.get("message", "")
                st.last_heartbeat_ts = ts
            elif kind == "snapshot":
                st.account = msg.get("account") or {}
                st.terminal = msg.get("terminal") or {}
                st.positions = msg.get("positions") or []
                st.last_snapshot_ts = ts
                st.last_heartbeat_ts = ts
                for cb in self.listeners:
                    try:
                        cb(st.cfg.id, st)
                    except Exception:
                        log.exception("listener failed")
            elif kind == "deals":
                st.deals = msg.get("deals") or []
                st.deals_version = int(msg.get("version") or 0)
                st.history_window = msg.get("window") or {}
                st.incomplete_positions = msg.get("incomplete_positions") or []
                st.last_deals_ts = ts
            elif kind == "bot_state":
                st.bot = msg.get("state") or {}
            elif kind == "result":
                slot = self._pending.get(str(msg.get("req_id")))
                if slot is not None:
                    slot["result"] = msg
                    slot["event"].set()
            elif kind == "log":
                st.logs.append({"ts": ts, "level": msg.get("level", "INFO"), "message": msg.get("message", "")})
                getattr(log, str(msg.get("level", "info")).lower(), log.info)("[%s] %s", st.cfg.id, msg.get("message"))

    # ------------------------------------------------------------------ #
    def snapshot(self, acc_id: str) -> AccountState:
        return self.states[acc_id]
