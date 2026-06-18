"""Run the strategy on a single user's account.

Mirrors the single-user bot's per-symbol logic (market filter → signal →
gating → sized entry with stop + TP ladder → break-even management) but is
fully parameterised by the user's exchange, strategy, and settings.
"""
from __future__ import annotations

import logging

from ..config import settings
from ..risk.sizing import plan_position
from ..strategy.market_filter import assess_market

log = logging.getLogger(__name__)


_TP_LADDER_PCTS = (6.0, 12.0, 20.0)


def manage_breakeven(exchange, symbol, pos, hit=None, tp_pcts=_TP_LADDER_PCTS) -> None:
    """Trail the stop up the TP ladder: TP1 -> break-even, TP2 -> TP1, and once
    the final TP is reached close the remainder. Stop only moves forward.

    ``hit`` is the authoritative number of TPs filled (from closed orders); if
    not given, fall back to comparing the current price to the levels."""
    if pos.entry_price <= 0:
        return
    is_long = (pos.side or "").lower() in ("buy", "long")
    sign = 1.0 if is_long else -1.0
    entry = pos.entry_price
    tps = [entry * (1 + sign * p / 100) for p in tp_pcts]
    if hit is None:
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
    if hit <= 0:
        return
    if hit >= len(tps):  # final TP reached — close the remainder
        try:
            exchange.close_position(symbol)
            pos.side = None
        except Exception as exc:  # pragma: no cover
            log.warning("final close failed %s: %s", symbol, exc)
        return
    buf = 0.0012
    target = round(entry * (1 + sign * buf), 6) if hit == 1 else round(tps[hit - 2], 6)
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
                    hit = (sum(1 for r in closed if r.get("symbol") == s
                               and (r.get("closed_at") or "") >= ot) if ot else None)
                    manage_breakeven(self.ex, s, p, hit)
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

        for s in symbols:
            try:
                df = self.ex.get_klines(s, settings.timeframe, limit=250)
                sig = self.strategy.generate(df)
                out["signals"][s] = f"{sig.action}: {sig.reason}"
                if sig.action not in {"long", "short"}:
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
