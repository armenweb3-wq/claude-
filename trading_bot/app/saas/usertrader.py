"""Run the strategy on a single user's account.

Mirrors the single-user bot's per-symbol logic (market filter → signal →
gating → sized entry with stop + TP ladder → break-even management) but is
fully parameterised by the user's exchange, strategy, and settings.
"""
from __future__ import annotations

import datetime as dt
import logging

from ..config import settings
from ..risk.sizing import plan_position
from ..strategy import trailing
from ..strategy.market_filter import assess_market

log = logging.getLogger(__name__)


_TP_LADDER_PCTS = trailing.TP_LADDER_PCTS
_tp_hits_from_fills = trailing.tp_hits_from_fills  # kept for tests/back-compat


def manage_breakeven(exchange, symbol, pos, closed=None, opened_at="",
                     tp_pcts=_TP_LADDER_PCTS) -> None:
    """Trail the stop up the TP ladder (shared logic in strategy.trailing).

    When ``closed`` (real closing fills) is given, TP hits come from fills whose
    price matches a level — and we do NOT market-close on the final TP (the
    reduce-only ladder closes it on the exchange). Without ``closed`` we fall
    back to the live price (and may close on the final TP)."""
    if pos.entry_price <= 0:
        return
    is_long = (pos.side or "").lower() in ("buy", "long")
    entry = pos.entry_price
    tps = trailing.ladder_prices(entry, is_long, tp_pcts)

    close_on_final = False
    if closed is not None:
        hit = trailing.tp_hits_from_fills(closed, symbol, opened_at, tps)
    else:
        try:
            price = exchange.last_price(symbol)
        except Exception:
            return
        hit = trailing.tp_hits_from_price(price, tps, is_long)
        close_on_final = True

    if hit <= 0:
        return
    if hit >= len(tps):
        if close_on_final:  # price genuinely reached the final TP
            try:
                exchange.close_position(symbol)
                pos.side = None
            except Exception as exc:  # pragma: no cover
                log.warning("final close failed %s: %s", symbol, exc)
            return
        hit = len(tps) - 1  # fills path: just trail, the exchange closes TP3
        if hit <= 0:
            return
    target = trailing.trail_target(entry, is_long, tps, hit)
    if not trailing.is_forward(target, pos.stop_loss or 0.0, is_long):
        return
    try:
        exchange.set_stop_loss(symbol, target)
        pos.stop_loss = target
    except Exception as exc:  # pragma: no cover
        log.warning("stop update failed %s: %s", symbol, exc)


class UserTrader:
    def __init__(self, exchange, strategy, *, risk_pct: float, symbols: list[str],
                 max_open: int | None = None, dry: bool = False) -> None:
        self.ex = exchange
        self.strategy = strategy
        self.risk_pct = risk_pct
        self.symbols = symbols
        self.max_open = max_open if max_open is not None else settings.max_open_positions
        self.dry = dry

    def run_once(self) -> dict:
        out: dict = {"signals": {}, "opened": [], "positions": 0, "error": None}
        try:
            equity = self.ex.get_equity()
        except Exception as exc:
            out["error"] = f"equity read failed: {exc}"
            return out
        if equity <= 0:
            out["error"] = "no tradable equity"
            return out
        out["equity"] = round(equity, 2)

        # Drop symbols Bybit doesn't list (e.g. PEPEUSDT — really 1000PEPEUSDT),
        # so they don't spam errors or waste API calls.
        try:
            avail = self.ex.available_symbols()
        except Exception:
            avail = set()
        symbols = [s for s in self.symbols if (not avail or s in avail)]

        # BTC market filter (same gate as the single-user bot)
        allow_long = allow_short = True
        if settings.btc_filter_enabled:
            try:
                btc = self.ex.get_klines(settings.btc_symbol, settings.timeframe, limit=251)
                btc = btc.iloc[:-1]  # drop the still-forming candle (no repaint)
                bias = assess_market(btc, crash_pct=settings.btc_crash_pct)
                allow_long, allow_short = bias.allow_long, bias.allow_short
                out["market"] = bias.reason
            except Exception as exc:  # pragma: no cover
                # Fail CLOSED: if we can't read BTC we don't know the regime, so
                # block NEW entries rather than trade unguarded.
                allow_long = allow_short = False
                out["market"] = "BTC filter unavailable — new trades paused"
                log.warning("market filter failed: %s", exc)

        # closing orders per symbol — to trail the stop on real fills
        try:
            closed = self.ex.closed_pnl(limit=100)
        except Exception:
            closed = []
        out["closed"] = closed  # surfaced so the runner can persist it
        # snapshot positions + manage break-even
        positions: dict = {}
        open_count = 0
        for s in symbols:
            try:
                p = self.ex.get_position(s)
                positions[s] = p
                if p.side is not None:
                    open_count += 1
                    ot = getattr(p, "created_at", "") or ""
                    manage_breakeven(self.ex, s, p, closed=closed, opened_at=ot)
            except Exception as exc:  # pragma: no cover
                log.warning("position read %s: %s", s, exc)

        # Regime flip: bank in-profit positions whose side is now blocked.
        if settings.close_on_regime_flip:
            for s, p in positions.items():
                if p.side is None:
                    continue
                is_long = (p.side or "").lower() in ("buy", "long")
                blocked = (is_long and not allow_long) or (not is_long and not allow_short)
                if blocked and p.unrealised_pnl > 0:
                    try:
                        self.ex.close_position(s)
                        p.side = None
                        open_count -= 1
                    except Exception as exc:  # pragma: no cover
                        log.warning("regime-flip close %s: %s", s, exc)
        out["positions"] = open_count

        # Daily-loss circuit breaker: once today's realised loss exceeds the
        # configured % of equity, stop opening NEW positions for the rest of the
        # day (existing positions keep their stops). Same safety rail the
        # single-user bot has.
        now = dt.datetime.now(dt.timezone.utc)
        today = now.date().isoformat()
        # Fetch TODAY's closes explicitly (start-of-day filter) so the loss total
        # isn't truncated by the 100-row window on a busy day.
        midnight_ms = int(dt.datetime(now.year, now.month, now.day,
                                      tzinfo=dt.timezone.utc).timestamp() * 1000)
        try:
            today_rows = self.ex.closed_pnl(limit=100, start_ms=midnight_ms)
        except Exception:
            today_rows = [r for r in closed if (r.get("closed_at") or "").startswith(today)]
        realized_today = sum((r.get("pnl") or 0) for r in today_rows)
        daily_loss_breached = realized_today <= -(settings.daily_max_loss_pct / 100) * equity
        if daily_loss_breached:
            out["market"] = (out.get("market") or "") + " · daily loss limit hit — new trades paused"

        for s in symbols:
            try:
                df = self.ex.get_klines(s, settings.timeframe, limit=251)
                df = df.iloc[:-1]  # act on the last CLOSED candle (no repaint)
                sig = self.strategy.generate(df)
                out["signals"][s] = f"{sig.action}: {sig.reason}"
                if sig.action not in {"long", "short"}:
                    continue
                if daily_loss_breached:
                    out["signals"][s] = "paused — daily loss limit reached"
                    continue
                if sig.action == "long" and not allow_long:
                    out["signals"][s] = "long blocked — market filter"
                    continue
                if sig.action == "short" and not allow_short:
                    out["signals"][s] = "short blocked — market filter"
                    continue
                if open_count >= self.max_open:
                    continue
                p = positions.get(s)
                if p is not None and p.side is not None:
                    continue  # already in a position
                lev_cap = min(settings.max_leverage, sig.leverage)
                plan = plan_position(equity=equity, risk_pct=self.risk_pct,
                                     entry=sig.entry, stop=sig.stop_loss,
                                     side=sig.action, leverage_cap=max(1.0, lev_cap))
                if plan.qty <= 0:
                    continue
                if not plan.safe:  # liquidation would sit inside the stop — never trade it
                    out["signals"][s] = "skipped: unsafe (liquidation inside stop)"
                    continue
                side = "Buy" if sig.action == "long" else "Sell"
                # Full trade detail so copy-trading can mirror this open onto
                # followers (entry/stop/TP ladder + the leverage and risk used).
                detail = {
                    "entry": sig.entry, "stop_loss": sig.stop_loss,
                    "leverage": plan.leverage, "risk_pct": self.risk_pct,
                    "take_profits": [
                        {"pct": tp.pct, "close_fraction": tp.close_fraction, "price": tp.price}
                        for tp in (sig.take_profits or [])
                    ],
                }
                if self.dry:
                    out["opened"].append({"symbol": s, "side": side, "qty": plan.qty,
                                          "dry": True, **detail})
                    open_count += 1
                    continue
                res = self.ex.open_position(symbol=s, side=side, qty=plan.qty,
                                            leverage=plan.leverage, stop_loss=sig.stop_loss,
                                            take_profits=sig.take_profits)
                if getattr(res, "ok", False):
                    out["opened"].append({"symbol": s, "side": side, "qty": res.qty,
                                          "warning": getattr(res, "warning", ""), **detail})
                    open_count += 1
                else:
                    out["signals"][s] = f"skipped: {getattr(res, 'skipped_reason', '')}"
            except Exception as exc:
                out["signals"][s] = f"error: {exc}"
        return out
