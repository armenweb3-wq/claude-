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
from ..strategy.market_filter import assess_market

log = logging.getLogger(__name__)


_TP_LADDER_PCTS = (6.0, 12.0, 20.0)


def _tp_hits_from_fills(closed, symbol, opened_at, tps, tol=0.004) -> int:
    """Count how many distinct TP *levels* have an actual closing fill at (≈) that
    price since the position opened. Matching the exit price to a TP level avoids
    counting stop-loss hits, manual closes, regime-flip closes, or earlier
    round-trips of the same symbol — the root cause of premature force-closes."""
    n = 0
    for tp in tps:
        for r in closed:
            if r.get("symbol") != symbol:
                continue
            ca = r.get("closed_at") or ""
            if opened_at and ca < opened_at:
                continue
            ep = r.get("exit_price") or 0
            if ep and tp and abs(ep - tp) / tp <= tol:
                n += 1
                break
    return n


def manage_breakeven(exchange, symbol, pos, closed=None, opened_at="",
                     tp_pcts=_TP_LADDER_PCTS) -> None:
    """Trail the stop up the TP ladder: TP1 -> break-even, TP2 -> TP1. Stop only
    moves forward, never back.

    When ``closed`` (the list of real closing fills) is given, the number of TPs
    hit is derived from fills whose price matches a TP level — and we do NOT
    market-close on the final TP, because the reduce-only TP ladder on the
    exchange closes the position itself. When ``closed`` is omitted we fall back
    to comparing the live price to the levels (and may close on the final TP)."""
    if pos.entry_price <= 0:
        return
    is_long = (pos.side or "").lower() in ("buy", "long")
    sign = 1.0 if is_long else -1.0
    entry = pos.entry_price
    tps = [entry * (1 + sign * p / 100) for p in tp_pcts]

    close_on_final = False
    if closed is not None:
        hit = _tp_hits_from_fills(closed, symbol, opened_at, tps)
    else:
        try:
            price = exchange.last_price(symbol)
        except Exception:
            return
        hit = 0
        for t in tps:
            if sign * (price - t) >= 0:
                hit += 1
            else:
                break
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
    buf = 0.0012
    target = entry * (1 + sign * buf) if hit == 1 else tps[hit - 2]
    cur = pos.stop_loss or 0.0
    forward = (target > cur) if is_long else (cur == 0 or target < cur)
    if not forward:
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
                btc = self.ex.get_klines(settings.btc_symbol, settings.timeframe, limit=250)
                bias = assess_market(btc, crash_pct=settings.btc_crash_pct)
                allow_long, allow_short = bias.allow_long, bias.allow_short
                out["market"] = bias.reason
            except Exception as exc:  # pragma: no cover
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
        today = dt.datetime.now(dt.timezone.utc).date().isoformat()
        realized_today = sum((r.get("pnl") or 0) for r in closed
                             if (r.get("closed_at") or "").startswith(today))
        daily_loss_breached = realized_today <= -(settings.daily_max_loss_pct / 100) * equity
        if daily_loss_breached:
            out["market"] = (out.get("market") or "") + " · daily loss limit hit — new trades paused"

        for s in symbols:
            try:
                df = self.ex.get_klines(s, settings.timeframe, limit=250)
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
                side = "Buy" if sig.action == "long" else "Sell"
                if self.dry:
                    out["opened"].append({"symbol": s, "side": side, "qty": plan.qty, "dry": True})
                    open_count += 1
                    continue
                res = self.ex.open_position(symbol=s, side=side, qty=plan.qty,
                                            leverage=plan.leverage, stop_loss=sig.stop_loss,
                                            take_profits=sig.take_profits)
                if getattr(res, "ok", False):
                    out["opened"].append({"symbol": s, "side": side, "qty": res.qty})
                    open_count += 1
                else:
                    out["signals"][s] = f"skipped: {getattr(res, 'skipped_reason', '')}"
            except Exception as exc:
                out["signals"][s] = f"error: {exc}"
        return out
