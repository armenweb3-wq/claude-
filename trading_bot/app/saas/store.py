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
        f"""CREATE TABLE IF NOT EXISTS closed_trades (
          id {_PK[d]}, user_id INTEGER NOT NULL, ext_id TEXT NOT NULL,
          symbol TEXT, side TEXT, pnl {_TS[d]}, pnl_pct {_TS[d]}, fee {_TS[d]},
          entry_price {_TS[d]}, exit_price {_TS[d]}, qty {_TS[d]},
          closed_at TEXT, UNIQUE(user_id, ext_id))""",
        """CREATE TABLE IF NOT EXISTS meta (
          k TEXT PRIMARY KEY, v TEXT)""",
    ]


def group_closed(trades: list[dict], gap_seconds: float = 345600.0) -> list[dict]:
    """Merge the partial closes of ONE position (TP-ladder fills) into a single
    logical trade.

    Fills merge only when they share the same symbol, side AND entry price *and*
    close within ``gap_seconds`` (default 4 days — generous enough for a daily
    strategy's TP ladder to fill, tight enough that two genuinely separate
    positions reopened at the same price days/weeks apart stay separate). This
    guarantees a loss can never hide inside an unrelated win.

    P&L ($) and fees are summed. The position ROI% is the qty-weighted average of
    the fills' ROI% (NOT their sum — summing percentages overstates returns)."""
    import datetime as _dt

    def _ts(s):
        try:
            return _dt.datetime.fromisoformat(s).timestamp()
        except Exception:
            return 0.0

    rows = sorted(trades, key=lambda t: _ts(t.get("closed_at") or ""))
    open_g: dict = {}
    out: list[dict] = []
    for t in rows:
        ep = t.get("entry_price")
        epk = round(float(ep), 8) if ep else None
        # When the entry price is unknown we CANNOT prove two fills belong to the
        # same position, so give each its own key (never merge) — otherwise a
        # loss could net into an unrelated win.
        ident = epk if epk is not None else ("noentry", t.get("closed_at"))
        key = (t.get("symbol"), (t.get("side") or "").lower(), ident)
        tt = _ts(t.get("closed_at") or "")
        qty = float(t.get("qty") or 0)
        pct = float(t.get("pnl_pct") or 0)
        g = open_g.get(key)
        # Merge only if it's the same position key AND within the time window —
        # the window applies even when the entry price matches, so two separate
        # trades reopened at the same price are never netted together.
        mergeable = g is not None and (tt - g["_last"]) <= gap_seconds
        if mergeable:
            g["pnl"] += float(t.get("pnl") or 0)
            g["fee"] += float(t.get("fee") or 0)
            g["_pct_wsum"] += pct * (qty or 1)
            g["_w"] += (qty or 1)
            g["qty"] += qty
            g["exit_price"] = t.get("exit_price")
            g["closed_at"] = t.get("closed_at")
            g["parts"] += 1
            g["_last"] = tt
        else:
            g = {"symbol": t.get("symbol"), "side": t.get("side"),
                 "pnl": float(t.get("pnl") or 0), "fee": float(t.get("fee") or 0),
                 "entry_price": t.get("entry_price"), "exit_price": t.get("exit_price"),
                 "qty": qty, "closed_at": t.get("closed_at"), "parts": 1,
                 "_pct_wsum": pct * (qty or 1), "_w": (qty or 1), "_last": tt}
            open_g[key] = g
            out.append(g)
    for g in out:
        g.pop("_last", None)
        w = g.pop("_w", 0) or 1
        g["pnl"] = round(g["pnl"], 4)
        g["pnl_pct"] = round(g.pop("_pct_wsum", 0) / w, 2)
        g["fee"] = round(g["fee"], 4)
        g["qty"] = round(g["qty"], 8)
    return out


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
        # Match the float type used in the fresh-deploy schema so a MIGRATED
        # Postgres DB gets full double precision (not single-precision REAL,
        # which would lose precision on large crypto prices).
        _flt = "DOUBLE PRECISION" if self._pg else "REAL"
        for stmt in (
            "ALTER TABLE users ADD COLUMN username TEXT",
            "ALTER TABLE users ADD COLUMN avatar TEXT",
            "ALTER TABLE users ADD COLUMN referred_by TEXT",
            "ALTER TABLE users ADD COLUMN telegram_chat_id TEXT",
            f"ALTER TABLE closed_trades ADD COLUMN entry_price {_flt}",
            f"ALTER TABLE closed_trades ADD COLUMN exit_price {_flt}",
            f"ALTER TABLE closed_trades ADD COLUMN qty {_flt}",
        ):
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
                    username: str | None = None, referred_by: str | None = None) -> dict:
        self._q(
            "INSERT INTO users (email, pw_salt, pw_hash, is_admin, username, referred_by, created_at)"
            " VALUES (?,?,?,?,?,?,?)",
            (email.lower(), salt, pw_hash, 1 if is_admin else 0, username, referred_by, time.time()),
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

    def set_username(self, uid: int, username: str) -> None:
        self._q("UPDATE users SET username=? WHERE id=?", (username, uid))

    def set_avatar(self, uid: int, avatar: str | None) -> None:
        self._q("UPDATE users SET avatar=? WHERE id=?", (avatar, uid))

    def set_telegram(self, uid: int, chat_id: str | None) -> None:
        self._q("UPDATE users SET telegram_chat_id=? WHERE id=?", (chat_id, uid))

    # ── closed-trade history (for monthly performance) ──────
    def add_closed_trades(self, uid: int, trades: list[dict]) -> list[dict]:
        """Insert new closed trades; return the ones that were newly added
        (so callers can fire alerts only for genuinely new closes)."""
        new: list[dict] = []
        for t in trades:
            ca = t.get("closed_at")
            if not ca:
                continue
            ext = str(t.get("id") or (str(t.get("symbol")) + "|" + str(ca)))
            if self._q("SELECT 1 FROM closed_trades WHERE user_id=? AND ext_id=?", (uid, ext)):
                continue
            # Store prices as NULL when missing (never 0) so grouping by entry
            # price isn't corrupted by a fabricated 0.0.
            def _num(v):
                return float(v) if v not in (None, "", 0, 0.0) else None
            self._q(
                "INSERT INTO closed_trades (user_id, ext_id, symbol, side, pnl, pnl_pct, fee,"
                " entry_price, exit_price, qty, closed_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id, ext_id) DO NOTHING",
                (uid, ext, t.get("symbol"), t.get("side"), float(t.get("pnl") or 0),
                 float(t.get("pnl_pct") or 0), float(t.get("fee") or 0),
                 _num(t.get("entry_price")), _num(t.get("exit_price")),
                 _num(t.get("qty")), ca),
            )
            new.append(t)
        return new

    # ── small key/value store (scheduler state, etc.) ───────
    def get_meta(self, key: str) -> str | None:
        rows = self._q("SELECT v FROM meta WHERE k=?", (key,))
        return rows[0]["v"] if rows else None

    def set_meta(self, key: str, value: str) -> None:
        self._q("INSERT INTO meta (k, v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v",
                (key, value))

    def count_closed(self, uid: int) -> int:
        return int(self._q("SELECT COUNT(*) AS c FROM closed_trades WHERE user_id=?", (uid,))[0]["c"])

    def logical_trades(self, uid: int) -> list[dict]:
        """Closed trades grouped into positions (partial TP fills merged)."""
        rows = self._q(
            "SELECT symbol, side, pnl, pnl_pct, fee, entry_price, exit_price, qty, closed_at"
            " FROM closed_trades WHERE user_id=? ORDER BY closed_at ASC", (uid,))
        return group_closed(rows)

    def monthly_summary(self, uid: int) -> list[dict]:
        buckets: dict[str, dict] = {}
        for g in self.logical_trades(uid):
            mo = (g.get("closed_at") or "")[:7]
            if not mo:
                continue
            b = buckets.setdefault(mo, {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0, "roi": 0.0})
            b["trades"] += 1
            if g["pnl"] > 0:
                b["wins"] += 1
            elif g["pnl"] < 0:
                b["losses"] += 1
            b["pnl"] += g["pnl"]
            b["roi"] += g["pnl_pct"]
        out = []
        for mo in sorted(buckets, reverse=True):
            b = buckets[mo]
            decided = b["wins"] + b["losses"]
            out.append({
                "month": mo, "trades": b["trades"], "wins": b["wins"], "losses": b["losses"],
                "win_rate": round(b["wins"] / decided * 100, 1) if decided else 0.0,
                "pnl": round(b["pnl"], 4),
                # Average ROI per trade (NOT a sum of percentages, which inflates).
                "roi_pct": round(b["roi"] / b["trades"], 2) if b["trades"] else 0.0,
            })
        return out

    def closed_by_month(self, uid: int, month: str) -> list[dict]:
        return [g for g in self.logical_trades(uid) if (g.get("closed_at") or "")[:7] == month]

    def top_trade(self) -> dict | None:
        """Best REAL closed trade across all users (by ROI%), for social proof.
        Returns None if there are no closed trades yet — never fabricate."""
        best = None
        for r in self._q("SELECT id FROM users"):
            for t in self.logical_trades(r["id"]):
                if t.get("pnl", 0) > 0 and (best is None or t.get("pnl_pct", 0) > best.get("pnl_pct", 0)):
                    best = t
        return best

    def platform_stats(self) -> dict:
        """Aggregate performance across all users — for proof/marketing. Groups
        each user's partial fills into positions, then totals them."""
        uids = [r["id"] for r in self._q("SELECT id FROM users WHERE is_admin=0")]
        trades = []
        for uid in uids:
            trades.extend(self.logical_trades(uid))
        wins = sum(1 for t in trades if (t.get("pnl") or 0) > 0)
        losses = sum(1 for t in trades if (t.get("pnl") or 0) < 0)
        decided = wins + losses
        months: dict[str, dict] = {}
        for t in trades:
            mo = (t.get("closed_at") or "")[:7]
            if not mo:
                continue
            b = months.setdefault(mo, {"trades": 0, "wins": 0, "losses": 0, "pnl": 0.0, "roi": 0.0})
            b["trades"] += 1
            if t["pnl"] > 0:
                b["wins"] += 1
            elif t["pnl"] < 0:
                b["losses"] += 1
            b["pnl"] += t["pnl"]
            b["roi"] += t["pnl_pct"]
        monthly = []
        for mo in sorted(months, reverse=True):
            b = months[mo]
            d = b["wins"] + b["losses"]
            monthly.append({"month": mo, "trades": b["trades"], "wins": b["wins"],
                            "losses": b["losses"],
                            "win_rate": round(b["wins"] / d * 100, 1) if d else 0.0,
                            "pnl": round(b["pnl"], 2),
                            # average ROI per trade, not a sum of percentages
                            "roi_pct": round(b["roi"] / b["trades"], 1) if b["trades"] else 0.0})
        times = [t.get("closed_at") for t in trades if t.get("closed_at")]
        return {
            "users": len(uids),
            "trades": len(trades),
            "wins": wins, "losses": losses,
            "win_rate": round(wins / decided * 100, 1) if decided else 0.0,
            "realized_pnl": round(sum(t.get("pnl") or 0 for t in trades), 2),
            "since": min(times)[:10] if times else None,
            "monthly": monthly,
        }

    def referral_count(self, username: str) -> int:
        if not username:
            return 0
        return int(self._q(
            "SELECT COUNT(*) AS c FROM users WHERE referred_by=?", (username,))[0]["c"])

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

    _SESSION_TTL = 60 * 60 * 24 * 30  # 30 days

    def user_for_session(self, token: str) -> dict | None:
        rows = self._q(
            "SELECT u.*, s.created_at AS _sess_created FROM sessions s"
            " JOIN users u ON u.id=s.user_id WHERE s.token=?",
            (token,),
        )
        if not rows:
            return None
        u = rows[0]
        created = u.pop("_sess_created", None)
        if created is not None and (time.time() - float(created)) > self._SESSION_TTL:
            self.delete_session(token)  # expired server-side
            return None
        return u

    def delete_session(self, token: str) -> None:
        self._q("DELETE FROM sessions WHERE token=?", (token,))

    def delete_user_sessions(self, uid: int) -> None:
        """Invalidate ALL of a user's sessions (e.g. after a password change)."""
        self._q("DELETE FROM sessions WHERE user_id=?", (uid,))

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
