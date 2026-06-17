"""Persistence for the multi-user beta.

Uses **Postgres** when ``DATABASE_URL`` is set (survives Render redeploys and
scales), and falls back to a local **SQLite** file otherwise. The query layer
is written once with ``?`` placeholders and adapted per backend.
"""
from __future__ import annotations

import sqlite3
import threading
import time

from ..config import settings


def _default_symbols() -> str:
    return ",".join(settings.symbols) or "BTCUSDT"

# Column types differ slightly between the two backends.
_PK = {"pg": "SERIAL PRIMARY KEY", "sqlite": "INTEGER PRIMARY KEY AUTOINCREMENT"}
_TS = {"pg": "DOUBLE PRECISION", "sqlite": "REAL"}


def _schema(d: str) -> list[str]:
    return [
        f"""CREATE TABLE IF NOT EXISTS users (
          id {_PK[d]}, email TEXT UNIQUE NOT NULL, pw_salt TEXT NOT NULL,
          pw_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0,
          activated INTEGER NOT NULL DEFAULT 0, active_until TEXT,
          username TEXT, created_at {_TS[d]} NOT NULL)""",
        f"""CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at {_TS[d]} NOT NULL)""",
        f"""CREATE TABLE IF NOT EXISTS exchange_keys (
          user_id INTEGER PRIMARY KEY, enc_key TEXT NOT NULL, enc_secret TEXT NOT NULL,
          testnet INTEGER NOT NULL DEFAULT 0, created_at {_TS[d]} NOT NULL)""",
        """CREATE TABLE IF NOT EXISTS settings (
          user_id INTEGER PRIMARY KEY, risk_pct REAL NOT NULL DEFAULT 2.0,
          symbols TEXT NOT NULL DEFAULT 'BTCUSDT,ETHUSDT,SOLUSDT',
          enabled INTEGER NOT NULL DEFAULT 0)""",
        f"""CREATE TABLE IF NOT EXISTS payments (
          id {_PK[d]}, user_id INTEGER NOT NULL, tx_hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending', created_at {_TS[d]} NOT NULL)""",
    ]


class Store:
    def __init__(self, path: str | None = None) -> None:
        self._lock = threading.Lock()
        self._pg = bool(settings.database_url)
        if self._pg:
            import psycopg2

            self._conn = psycopg2.connect(settings.database_url)
            self._conn.autocommit = True
            for stmt in _schema("pg"):
                with self._conn.cursor() as cur:
                    cur.execute(stmt)
        else:
            self._conn = sqlite3.connect(path or settings.saas_db_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            for stmt in _schema("sqlite"):
                self._conn.execute(stmt)
            self._conn.commit()
        self._migrate()

    def _migrate(self) -> None:
        """Add columns introduced after a DB was first created (idempotent)."""
        for stmt in ("ALTER TABLE users ADD COLUMN username TEXT",):
            try:
                if self._pg:
                    with self._conn.cursor() as cur:
                        cur.execute(stmt)
                else:
                    self._conn.execute(stmt)
                    self._conn.commit()
            except Exception:
                pass  # column already exists

    def _q(self, sql: str, args: tuple = ()) -> list[dict]:
        with self._lock:
            if self._pg:
                from psycopg2.extras import RealDictCursor

                with self._conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(sql.replace("?", "%s"), args)
                    rows = cur.fetchall() if cur.description else []
                return [dict(r) for r in rows]
            cur = self._conn.execute(sql, args)
            self._conn.commit()
            return [dict(r) for r in cur.fetchall()]

    # ── users / seats ───────────────────────────────────────
    def user_count(self) -> int:
        return int(self._q("SELECT COUNT(*) AS c FROM users WHERE is_admin=0")[0]["c"])

    def seats_left(self) -> int:
        return max(0, settings.saas_seat_limit - self.user_count())

    def get_user_by_email(self, email: str) -> dict | None:
        rows = self._q("SELECT * FROM users WHERE email=?", (email.lower(),))
        return rows[0] if rows else None

    def get_user(self, uid: int) -> dict | None:
        rows = self._q("SELECT * FROM users WHERE id=?", (uid,))
        return rows[0] if rows else None

    def create_user(self, email: str, salt: str, pw_hash: str, is_admin: bool,
                    username: str | None = None) -> dict:
        self._q(
            "INSERT INTO users (email, pw_salt, pw_hash, is_admin, username, created_at)"
            " VALUES (?,?,?,?,?,?)",
            (email.lower(), salt, pw_hash, 1 if is_admin else 0, username, time.time()),
        )
        u = self.get_user_by_email(email)
        self._q("INSERT INTO settings (user_id, symbols) VALUES (?,?)"
                " ON CONFLICT(user_id) DO NOTHING", (u["id"], _default_symbols()))
        return u

    def set_activation(self, uid: int, activated: bool, active_until: str | None) -> None:
        self._q("UPDATE users SET activated=?, active_until=? WHERE id=?",
                (1 if activated else 0, active_until, uid))

    def set_password(self, uid: int, salt: str, pw_hash: str) -> None:
        self._q("UPDATE users SET pw_salt=?, pw_hash=? WHERE id=?", (salt, pw_hash, uid))

    def list_users(self, include_admins: bool = False) -> list[dict]:
        where = "" if include_admins else " WHERE is_admin=0"
        rows = self._q(f"SELECT * FROM users{where} ORDER BY created_at")
        for u in rows:
            u["has_keys"] = bool(self.get_keys(u["id"]))
            u["latest_payment"] = self.latest_payment(u["id"])
        return rows

    # ── sessions ────────────────────────────────────────────
    def create_session(self, token: str, uid: int) -> None:
        self._q("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
                (token, uid, time.time()))

    def user_for_session(self, token: str) -> dict | None:
        rows = self._q(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
            (token,),
        )
        return rows[0] if rows else None

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
        return rows[0] if rows else None

    def delete_keys(self, uid: int) -> None:
        self._q("DELETE FROM exchange_keys WHERE user_id=?", (uid,))

    # ── settings ────────────────────────────────────────────
    def get_settings(self, uid: int) -> dict:
        rows = self._q("SELECT * FROM settings WHERE user_id=?", (uid,))
        if not rows:
            self._q("INSERT INTO settings (user_id, symbols) VALUES (?,?)"
                    " ON CONFLICT(user_id) DO NOTHING", (uid, _default_symbols()))
            rows = self._q("SELECT * FROM settings WHERE user_id=?", (uid,))
        return rows[0]

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
        return rows[0] if rows else None

    def set_payment_status(self, pid: int, status: str) -> None:
        self._q("UPDATE payments SET status=? WHERE id=?", (status, pid))
