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
            return False  # malformed expiry → fail closed
    return True


class MultiUserRunner:
    def __init__(self, store: Store) -> None:
        self.store = store
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.results: dict[int, dict] = {}  # user_id -> last run summary
        # Persisted across restarts so a redeploy in the target hour doesn't
        # re-send (or skip) the daily messages.
        self._last_summary_day = store.get_meta("last_summary_day")
        self._last_channel_day = store.get_meta("last_channel_day")
        self._bcast_lock = threading.Lock()  # serialises the broadcast thread

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
                # Run the (blocking) Telegram broadcasts off the trading loop so a
                # slow/hung send can never delay position & stop management.
                threading.Thread(target=self._run_broadcasts, daemon=True).start()
            except Exception:  # pragma: no cover
                log.exception("runner cycle failed")
            self._stop.wait(max(30, settings.saas_loop_seconds))

    def _run_broadcasts(self) -> None:
        # Non-blocking lock: if the previous cycle's broadcast is still running,
        # skip this one. Prevents overlapping threads from double-sending the
        # daily summary/channel post and stops thread pile-up if Telegram is slow.
        if not self._bcast_lock.acquire(blocking=False):
            return
        try:
            self._maybe_daily_summary()
            self._maybe_channel_content()
            self._maybe_post_card()
        except Exception:  # pragma: no cover
            log.exception("runner broadcasts failed")
        finally:
            self._bcast_lock.release()

    def _maybe_post_card(self) -> None:
        """Automatically post a result card to the channel when a genuinely good
        REAL trade has closed — throttled so it's social proof, not spam:
        at most once every CARD_COOLDOWN hours, and never the same trade twice."""
        if not (settings.channel_auto_post and settings.channel_chat_id):
            return
        import datetime as _dt
        from . import alerts, card
        CARD_COOLDOWN_H = 8.0
        now = _dt.datetime.now(_dt.timezone.utc).timestamp()
        last_at = self.store.get_meta("last_card_at")
        if last_at and (now - float(last_at)) < CARD_COOLDOWN_H * 3600:
            return
        t = self.store.best_recent_trade(hours=48, min_pct=5.0)
        if not t:
            return
        tid = f"{t.get('symbol')}|{t.get('closed_at')}"
        if self.store.get_meta("last_card_id") == tid:
            return  # already posted this one
        img, caption = card.build_member_card(t)
        if alerts.send_photo(settings.channel_chat_id, img, caption,
                             alerts.community_button()).get("ok"):
            self.store.set_meta("last_card_at", str(now))
            self.store.set_meta("last_card_id", tid)

    def _maybe_daily_summary(self) -> None:
        """Once a day at SUMMARY_HOUR_UTC, DM each connected user their day."""
        import datetime as _dt
        now = _dt.datetime.now(_dt.timezone.utc)
        today = now.date().isoformat()
        # Fire once per day at/after the target hour (>= so a slow cycle that
        # skipped the exact hour still catches up the same day).
        if self._last_summary_day == today or now.hour < settings.summary_hour_utc:
            return
        self._last_summary_day = today
        self.store.set_meta("last_summary_day", today)
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
        # In dry-run no real position is opened, so a persistent signal would
        # re-announce "Opened" every cycle — suppress open alerts in dry mode.
        if not settings.saas_dry_run:
            for o in opened:
                alerts.notify(chat, f"🟢 Opened {o.get('side')} {o.get('symbol')} (qty {o.get('qty')})")
                if o.get("warning"):
                    from html import escape as _esc
                    alerts.notify(chat, f"⚠️ <b>{_esc(str(o.get('symbol')))}: "
                                        f"{_esc(str(o['warning']))}</b>. "
                                        f"Please check the position on Bybit.")
        # "Fresh close" window must comfortably exceed the loop interval, or a
        # close detected on the next (possibly late) cycle would be skipped.
        window_min = max(30, int(settings.saas_loop_seconds / 60 * 3) + 10)
        cutoff = (_dt.datetime.now(_dt.timezone.utc) - _dt.timedelta(minutes=window_min)).isoformat()
        for t in new_closed:
            if (t.get("closed_at") or "") < cutoff:
                continue  # skip historical backfill, only alert fresh closes
            pnl = t.get("pnl") or 0
            emoji = "✅" if pnl > 0 else "🔻"
            alerts.notify(chat, f"{emoji} Closed {t.get('symbol')} — PnL {pnl:+.4f} USDT")

    def _maybe_channel_content(self) -> None:
        """Once a day, auto-post an educational tip + live performance line to
        the channel — keeps it active with zero manual work."""
        if not (settings.channel_auto_post and settings.channel_chat_id):
            return
        import datetime as _dt
        now = _dt.datetime.now(_dt.timezone.utc)
        today = now.date().isoformat()
        if self._last_channel_day == today or now.hour < settings.channel_post_hour_utc:
            return
        self._last_channel_day = today
        self.store.set_meta("last_channel_day", today)
        from . import alerts, content
        s = self.store.platform_stats()
        perf = (f"📊 Live so far: <b>{s['trades']}</b> trades · <b>{s['win_rate']}%</b> win rate"
                f" across <b>{s['users']}</b> members." if s.get("trades") else "")
        community = alerts.community_button()
        broker = ({"text": f"Upgrade with {settings.broker_name} →", "url": settings.broker_link}
                  if settings.broker_link else None)
        # Rotate the daily post by day-of-year so the channel has variety, not
        # just tips — all automatic.
        slot = now.timetuple().tm_yday % 4
        if slot == 0:
            alerts.post_channel(content.daily_tip(now) + ("\n\n" + perf if perf else ""))
        elif slot == 1 and perf:
            alerts.post_channel("📈 <b>Performance update</b>\n\n" + perf +
                                "\n\nFully automated on each member's own account.", community)
        elif slot == 2:
            alerts.post_channel("🎁 <b>Refer a friend → 1 month free</b>\nPlus a giveaway "
                                "ticket per referral this month. Your link is in the app → Referral.",
                                community)
        elif slot == 3 and broker:
            alerts.post_channel("👤 <b>Want a dedicated account manager?</b>\nUpgrade with our "
                                "partner below.", broker)
        else:
            alerts.post_channel(content.daily_tip(now) + ("\n\n" + perf if perf else ""))

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
                # over time even if the user never opens the dashboard. Alerts are
                # gated purely by the freshness cutoff in _alert (only closes in
                # the last ~20 min), which already prevents replaying old history
                # on the first cycle — so we no longer suppress the first batch
                # (that was swallowing a user's first real close).
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
