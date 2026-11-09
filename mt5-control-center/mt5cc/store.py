"""Tiny SQLite store for live equity samples, so the dashboard can show a
real intraday equity curve built from values actually observed while the
application was running (never back-filled or estimated)."""

from __future__ import annotations

import sqlite3
import threading
import time
from pathlib import Path
from typing import Any


class EquityStore:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(
            """CREATE TABLE IF NOT EXISTS equity_samples (
                   account_id TEXT NOT NULL,
                   ts REAL NOT NULL,
                   balance REAL, equity REAL, margin REAL, floating REAL,
                   PRIMARY KEY (account_id, ts)
               )"""
        )
        self._conn.commit()
        self._last_sample: dict[str, float] = {}

    def maybe_sample(self, account_id: str, account: dict[str, Any], every_seconds: int) -> None:
        now = time.time()
        if now - self._last_sample.get(account_id, 0) < every_seconds:
            return
        if not account or account.get("equity") is None:
            return
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO equity_samples VALUES (?,?,?,?,?,?)",
                (account_id, now, account.get("balance"), account.get("equity"),
                 account.get("margin"), account.get("profit")),
            )
            self._conn.commit()
        self._last_sample[account_id] = now

    def samples(self, account_id: str, since: float, limit: int = 5000) -> list[dict[str, float]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT ts, balance, equity, margin, floating FROM equity_samples "
                "WHERE account_id=? AND ts>=? ORDER BY ts ASC LIMIT ?",
                (account_id, since, limit),
            ).fetchall()
        return [{"t": r[0], "balance": r[1], "equity": r[2], "margin": r[3], "floating": r[4]} for r in rows]

    def prune(self, keep_days: int = 90) -> None:
        cutoff = time.time() - keep_days * 86400
        with self._lock:
            self._conn.execute("DELETE FROM equity_samples WHERE ts < ?", (cutoff,))
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()
