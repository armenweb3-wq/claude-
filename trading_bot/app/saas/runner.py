"""Background scheduler that runs each activated user's bot on their account.

Off unless SAAS_EXEC_ENABLED=true. Defaults to SAAS_DRY_RUN=true (computes
signals and logs intended trades without placing real orders) so it can be
switched on safely and watched before going live.
"""
from __future__ import annotations

import datetime as dt
import logging
import threading
import time

from ..config import settings
from ..exchange.bybit import BybitExchange
from ..strategy.confluence import ConfluenceStrategy
from . import security
from .store import Store
from .usertrader import UserTrader

log = logging.getLogger(__name__)


def _is_active(user: dict) -> bool:
    # The operator (admin) is always active — they don't pay/activate themselves.
    admin = settings.saas_admin_email
    if user.get("is_admin") or (admin and (user.get("email") or "").strip().lower() == admin):
        return True
    if not user.get("activated"):
        return False
    until = user.get("active_until")
    if until:
        try:
            return dt.date.fromisoformat(until) >= dt.date.today()
        except ValueError:
            return True
    return True


class MultiUserRunner:
    def __init__(self, store: Store) -> None:
        self.store = store
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.results: dict[int, dict] = {}  # user_id -> last run summary
        self._last_summary_day: str | None = None  # daily-summary dedupe

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        log.warning("MultiUserRunner started (dry_run=%s, every %ss)",
                    settings.saas_dry_run, settings.saas_loop_seconds)

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.run_cycle()
                self._maybe_daily_summary()
            except Exception:  # pragma: no cover
                log.exception("runner cycle failed")
            self._stop.wait(max(30, settings.saas_loop_seconds))

    def _maybe_daily_summary(self) -> None:
        """Once a day at SUMMARY_HOUR_UTC, DM each connected user their day."""
        import datetime as _dt
        now = _dt.datetime.now(_dt.timezone.utc)
        if now.hour != settings.summary_hour_utc:
            return
        today = now.date().isoformat()
        if self._last_summary_day == today:
            return
        self._last_summary_day = today
        from . import alerts
        for u in self.store.list_users(include_admins=True):
            chat = u.get("telegram_chat_id")
            if not chat:
                continue
            trades = [t for t in self.store.logical_trades(u["id"])
                      if (t.get("closed_at") or "").startswith(today)]
            if not trades:
                alerts.notify(chat, "📊 <b>Daily summary</b>\nNo trades closed today — bot is watching for setups.",
                              alerts.community_button())
                continue
            wins = sum(1 for t in trades if t["pnl"] > 0)
            losses = sum(1 for t in trades if t["pnl"] < 0)
            net = sum(t["pnl"] for t in trades)
            alerts.notify(chat,
                f"📊 <b>Daily summary</b>\nTrades closed: <b>{len(trades)}</b>\n"
                f"Wins: <b>{wins}</b> · Losses: <b>{losses}</b>\nNet: <b>{net:+.2f} USDT</b>",
                alerts.community_button())

    def _alert(self, user: dict, opened: list, new_closed: list) -> None:
        """Telegram alerts for this user's opens and recent closes."""
        chat = user.get("telegram_chat_id")
        if not chat:
            return
        from . import alerts
        import datetime as _dt
        for o in opened:
            alerts.notify(chat, f"🟢 Opened {o.get('side')} {o.get('symbol')} (qty {o.get('qty')})")
        cutoff = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(minutes=20)).isoformat()
        for t in new_closed:
            if (t.get("closed_at") or "") < cutoff:
                continue  # skip historical backfill, only alert fresh closes
            pnl = t.get("pnl") or 0
            emoji = "✅" if pnl > 0 else "🔻"
            alerts.notify(chat, f"{emoji} Closed {t.get('symbol')} — PnL {pnl:+.4f} USDT")

    def run_cycle(self) -> None:
        for user in self.store.list_users(include_admins=True):
            uid = user["id"]
            if not _is_active(user):
                continue
            cfg = self.store.get_settings(uid)
            if not cfg["enabled"]:
                continue
            keys = self.store.get_keys(uid)
            if not keys:
                continue
            try:
                api_key = security.decrypt(keys["enc_key"])
                api_secret = security.decrypt(keys["enc_secret"])
                exchange = BybitExchange(api_key=api_key, api_secret=api_secret,
                                         testnet=bool(keys["testnet"]))
                trader = UserTrader(
                    exchange, ConfluenceStrategy(),
                    risk_pct=cfg["risk_pct"],
                    symbols=[s.strip() for s in cfg["symbols"].split(",") if s.strip()],
                    dry=settings.saas_dry_run,
                )
                res = trader.run_once()
                # Persist closed trades every cycle so performance data accrues
                # over time even if the user never opens the dashboard.
                try:
                    new_closed = self.store.add_closed_trades(uid, res.get("closed", []))
                    self._alert(user, res.get("opened", []), new_closed)
                except Exception:  # pragma: no cover
                    pass
            except Exception as exc:  # one user must not break the rest
                res = {"error": str(exc)}
                log.warning("user %s run failed: %s", uid, exc)
            res.pop("closed", None)
            res["ts"] = time.time()
            self.results[uid] = res
