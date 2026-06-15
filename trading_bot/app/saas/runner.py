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
            except Exception:  # pragma: no cover
                log.exception("runner cycle failed")
            self._stop.wait(max(30, settings.saas_loop_seconds))

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
            except Exception as exc:  # one user must not break the rest
                res = {"error": str(exc)}
                log.warning("user %s run failed: %s", uid, exc)
            res["ts"] = time.time()
            self.results[uid] = res
