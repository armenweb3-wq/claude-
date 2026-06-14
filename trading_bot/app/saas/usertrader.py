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


def manage_breakeven(exchange, symbol, pos) -> None:
    """Move the stop to break-even (+fee buffer) once price clears TP1."""
    pct = settings.breakeven_after_pct
    if pct <= 0 or pos.entry_price <= 0:
        return
    is_long = (pos.side or "").lower() in ("buy", "long")
    buf = 0.0012
    try:
        price = exchange.last_price(symbol)
    except Exception:
        return
    if is_long:
        if price < pos.entry_price * (1 + pct / 100):
            return
        be = round(pos.entry_price * (1 + buf), 6)
        if pos.stop_loss and pos.stop_loss >= be:
            return
    else:
        if price > pos.entry_price * (1 - pct / 100):
            return
        be = round(pos.entry_price * (1 - buf), 6)
        if pos.stop_loss and 0 < pos.stop_loss <= be:
            return
    try:
        exchange.set_stop_loss(symbol, be)
        pos.stop_loss = be
    except Exception as exc:  # pragma: no cover
        log.warning("breakeven move failed %s: %s", symbol, exc)


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

        # snapshot positions + manage break-even
        positions: dict = {}
        open_count = 0
        for s in self.symbols:
            try:
                p = self.ex.get_position(s)
                positions[s] = p
                if p.side is not None:
                    open_count += 1
                    manage_breakeven(self.ex, s, p)
            except Exception as exc:  # pragma: no cover
                log.warning("position read %s: %s", s, exc)
        out["positions"] = open_count

        for s in self.symbols:
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
