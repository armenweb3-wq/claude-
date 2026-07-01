#!/usr/bin/env python3
"""Initialise the PostgreSQL schema against DATABASE_URL.

Idempotent — safe to run repeatedly (schema uses CREATE ... IF NOT EXISTS).
Useful for managed/remote Postgres where the docker-compose init hook does
not run.

    python scripts/init_db.py
"""
from __future__ import annotations

import pathlib
import sys

# Allow running from the trading_bot/ directory.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402

SCHEMA = pathlib.Path(__file__).resolve().parents[1] / "app" / "storage" / "schema.sql"


def main() -> int:
    if not settings.database_url:
        print("DATABASE_URL is not set (check your .env). Aborting.", file=sys.stderr)
        return 1

    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed. Run: pip install -r requirements.txt", file=sys.stderr)
        return 1

    print(f"Connecting to {settings.database_url.rsplit('@', 1)[-1]} ...")
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(SCHEMA.read_text())
    conn.close()
    print("Schema applied: trades, signals, equity_snapshots ✅")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
