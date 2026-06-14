"""SQLite persistence for the multi-user beta.

SQLite is intentionally chosen for the closed 25-seat beta: zero extra
infrastructure, a single file, and plenty fast at this scale. Migrate to
Postgres when the user base grows.
"""
from __future__ import annotations

import sqlite3
import threading
import time
from typing import Any

from ..config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  pw_salt TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  activated INTEGER NOT NULL DEFAULT 0,
  active_until TEXT,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS exchange_keys (
  user_id INTEGER PRIMARY KEY,
  enc_key TEXT NOT NULL,
  enc_secret TEXT NOT NULL,
  testnet INTEGER NOT NULL DEFAULT 0,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY,
  risk_pct REAL NOT NULL DEFAULT 2.0,
  symbols TEXT NOT NULL DEFAULT 'BTCUSDT,ETHUSDT,SOLUSDT',
  enabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at REAL NOT NULL
);
"""


class Store:
    def __init__(self, path: str | None = None) -> None:
        self._path = path or settings.saas_db_path
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self._path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    def _q(self, sql: str, args: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            cur = self._conn.execute(sql, args)
            self._conn.commit()
            return cur.fetchall()

    # ── users / seats ───────────────────────────────────────
    def user_count(self) -> int:
        return self._q("SELECT COUNT(*) c FROM users WHERE is_admin=0")[0]["c"]

    def seats_left(self) -> int:
        return max(0, settings.saas_seat_limit - self.user_count())

    def get_user_by_email(self, email: str) -> dict | None:
        rows = self._q("SELECT * FROM users WHERE email=?", (email.lower(),))
        return dict(rows[0]) if rows else None

    def get_user(self, uid: int) -> dict | None:
        rows = self._q("SELECT * FROM users WHERE id=?", (uid,))
        return dict(rows[0]) if rows else None

    def create_user(self, email: str, salt: str, pw_hash: str, is_admin: bool) -> dict:
        self._q(
            "INSERT INTO users (email, pw_salt, pw_hash, is_admin, created_at)"
            " VALUES (?,?,?,?,?)",
            (email.lower(), salt, pw_hash, 1 if is_admin else 0, time.time()),
        )
        u = self.get_user_by_email(email)
        self._q("INSERT OR IGNORE INTO settings (user_id) VALUES (?)", (u["id"],))
        return u

    def set_activation(self, uid: int, activated: bool, active_until: str | None) -> None:
        self._q("UPDATE users SET activated=?, active_until=? WHERE id=?",
                (1 if activated else 0, active_until, uid))

    def list_users(self) -> list[dict]:
        rows = self._q("SELECT * FROM users WHERE is_admin=0 ORDER BY created_at")
        out = []
        for r in rows:
            u = dict(r)
            u["has_keys"] = bool(self.get_keys(u["id"]))
            u["latest_payment"] = self.latest_payment(u["id"])
            out.append(u)
        return out

    # ── sessions ────────────────────────────────────────────
    def create_session(self, token: str, uid: int) -> None:
        self._q("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
                (token, uid, time.time()))

    def user_for_session(self, token: str) -> dict | None:
        rows = self._q(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
            (token,),
        )
        return dict(rows[0]) if rows else None

    def delete_session(self, token: str) -> None:
        self._q("DELETE FROM sessions WHERE token=?", (token,))

    # ── exchange keys ───────────────────────────────────────
    def save_keys(self, uid: int, enc_key: str, enc_secret: str, testnet: bool) -> None:
        self._q(
            "INSERT INTO exchange_keys (user_id, enc_key, enc_secret, testnet, created_at)"
            " VALUES (?,?,?,?,?)"
            " ON CONFLICT(user_id) DO UPDATE SET enc_key=excluded.enc_key,"
            " enc_secret=excluded.enc_secret, testnet=excluded.testnet,"
            " created_at=excluded.created_at",
            (uid, enc_key, enc_secret, 1 if testnet else 0, time.time()),
        )

    def get_keys(self, uid: int) -> dict | None:
        rows = self._q("SELECT * FROM exchange_keys WHERE user_id=?", (uid,))
        return dict(rows[0]) if rows else None

    def delete_keys(self, uid: int) -> None:
        self._q("DELETE FROM exchange_keys WHERE user_id=?", (uid,))

    # ── settings ────────────────────────────────────────────
    def get_settings(self, uid: int) -> dict:
        rows = self._q("SELECT * FROM settings WHERE user_id=?", (uid,))
        if not rows:
            self._q("INSERT INTO settings (user_id) VALUES (?)", (uid,))
            rows = self._q("SELECT * FROM settings WHERE user_id=?", (uid,))
        return dict(rows[0])

    def save_settings(self, uid: int, risk_pct: float, symbols: str, enabled: bool) -> None:
        self.get_settings(uid)
        self._q("UPDATE settings SET risk_pct=?, symbols=?, enabled=? WHERE user_id=?",
                (risk_pct, symbols, 1 if enabled else 0, uid))

    # ── payments ────────────────────────────────────────────
    def add_payment(self, uid: int, tx_hash: str) -> None:
        self._q("INSERT INTO payments (user_id, tx_hash, created_at) VALUES (?,?,?)",
                (uid, tx_hash, time.time()))

    def latest_payment(self, uid: int) -> dict | None:
        rows = self._q("SELECT * FROM payments WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
                       (uid,))
        return dict(rows[0]) if rows else None

    def set_payment_status(self, pid: int, status: str) -> None:
        self._q("UPDATE payments SET status=? WHERE id=?", (status, pid))
