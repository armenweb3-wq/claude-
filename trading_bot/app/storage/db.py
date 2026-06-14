"""PostgreSQL persistence (psycopg2).

Degrades gracefully: if DATABASE_URL is unset or the connection fails, the
bot keeps running and logs a warning instead of crashing — useful for
local dry-run experiments.
"""
from __future__ import annotations

import logging
import pathlib

from ..config import settings

log = logging.getLogger(__name__)
_SCHEMA = pathlib.Path(__file__).with_name("schema.sql")


class Storage:
    def __init__(self, dsn: str) -> None:
        import psycopg2  # imported lazily

        self._conn = psycopg2.connect(dsn)
        self._conn.autocommit = True
        self._init_schema()

    def _init_schema(self) -> None:
        with self._conn.cursor() as cur:
            cur.execute(_SCHEMA.read_text())

    def record_trade(
        self, *, symbol: str, side: str, qty: float, price: float | None,
        order_id: str | None, mode: str, strategy: str, reason: str,
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO trades (symbol, side, qty, price, order_id, mode, strategy, reason)"
                " VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (symbol, side, qty, price, order_id, mode, strategy, reason),
            )

    def record_signal(self, *, symbol: str, action: str, reason: str, price: float) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO signals (symbol, action, reason, price) VALUES (%s,%s,%s,%s)",
                (symbol, action, reason, price),
            )

    def record_equity(self, equity: float) -> None:
        with self._conn.cursor() as cur:
            cur.execute("INSERT INTO equity_snapshots (equity) VALUES (%s)", (equity,))

    def record_error(self, *, source: str, message: str, traceback: str | None = None) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO error_log (source, message, traceback) VALUES (%s,%s,%s)",
                (source, message, traceback),
            )

    def recent_errors(self, limit: int = 50) -> list[dict]:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT ts, source, message, traceback FROM error_log"
                " ORDER BY ts DESC LIMIT %s",
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {"ts": r[0].isoformat(), "source": r[1], "message": r[2], "traceback": r[3]}
            for r in rows
        ]


class _NullStorage(Storage):
    """No-op storage used when no DB is configured."""

    def __init__(self) -> None:  # noqa: D107 — intentionally skips super().__init__
        log.warning("No DATABASE_URL configured — persistence disabled.")

    def record_trade(self, **_: object) -> None: ...
    def record_signal(self, **_: object) -> None: ...
    def record_equity(self, *_: object) -> None: ...
    def record_error(self, **_: object) -> None: ...
    def recent_errors(self, limit: int = 50) -> list[dict]:
        return []


def get_storage() -> Storage:
    if not settings.database_url:
        return _NullStorage()
    try:
        return Storage(settings.database_url)
    except Exception as exc:  # pragma: no cover - connection issues
        log.warning("DB connection failed (%s) — persistence disabled.", exc)
        return _NullStorage()
