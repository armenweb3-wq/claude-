"""Indices market — run the strategy on a user's MT5 (Equiti via MetaApi) account.

Mirrors ``UserTrader`` for crypto, but for an MT5 broker: lots instead of
notional+leverage (``risk.mt5_sizing``), the MetaApi adapter's order surface, and
no BTC market filter (indices don't follow BTC). Same risk-%-per-trade model and
the same confluence strategy on the instrument's candles.

Dry-run computes intended trades without placing them. Nothing runs until
``INDICES_ENABLED`` is on and the user has connected an MT5 account.
"""
from __future__ import annotations

import logging

from ..config import settings
from ..risk.mt5_sizing import plan_mt5_position

log = logging.getLogger(__name__)


class IndicesTrader:
    def __init__(self, broker, strategy, *, risk_pct: float, symbols: list[str],
                 timeframe: str = "1h", max_open: int | None = None, dry: bool = False) -> None:
        self.bk = broker
        self.strategy = strategy
        self.risk_pct = risk_pct
        self.symbols = symbols
        self.timeframe = timeframe
        self.max_open = max_open if max_open is not None else settings.max_open_positions
        self.dry = dry

    def run_once(self) -> dict:
        out: dict = {"signals": {}, "opened": [], "positions": 0, "error": None}
        try:
            equity = self.bk.get_equity()
        except Exception as exc:
            out["error"] = f"equity read failed: {exc}"
            return out
        if equity <= 0:
            out["error"] = "no tradable equity"
            return out
        out["equity"] = round(equity, 2)

        try:
            avail = self.bk.list_symbols()
        except Exception:
            avail = set()
        symbols = [s for s in self.symbols if (not avail or s in avail)]

        # Snapshot open positions once.
        try:
            open_syms = {p["symbol"] for p in self.bk.open_positions() if p.get("side")}
        except Exception as exc:
            out["error"] = f"positions read failed: {exc}"
            return out
        open_count = len(open_syms)
        out["positions"] = open_count

        for s in symbols:
            try:
                df = self.bk.candles(s, self.timeframe, limit=251)
                if df is None or len(df) < 60:
                    out["signals"][s] = "not enough data"
                    continue
                df = df.iloc[:-1]  # act on the last CLOSED candle (no repaint)
                sig = self.strategy.generate(df)
                out["signals"][s] = f"{sig.action}: {sig.reason}"
                if sig.action not in {"long", "short"}:
                    continue
                if s in open_syms:
                    continue  # already in a position
                if open_count >= self.max_open:
                    out["signals"][s] = "skipped: max open positions"
                    continue
                spec = self.bk.symbol_spec(s)
                plan = plan_mt5_position(
                    equity=equity, risk_pct=self.risk_pct,
                    entry=float(sig.entry), stop=float(sig.stop_loss),
                    tick_size=spec["tick_size"], tick_value=spec["tick_value"],
                    min_volume=spec["min_volume"], max_volume=spec["max_volume"],
                    volume_step=spec["volume_step"])
                if plan.volume <= 0:
                    out["signals"][s] = f"skipped: {plan.reason}"
                    continue
                side = "Buy" if sig.action == "long" else "Sell"
                tp = sig.take_profits[0].price if sig.take_profits else 0.0
                detail = {"symbol": s, "side": side, "volume": plan.volume,
                          "entry": sig.entry, "stop_loss": sig.stop_loss,
                          "risk": plan.est_loss_at_stop}
                if self.dry:
                    out["opened"].append({**detail, "dry": True})
                    open_count += 1
                    continue
                res = self.bk.market_order(s, side, plan.volume,
                                           stop_loss=float(sig.stop_loss), take_profit=float(tp or 0))
                ok = bool(res.get("orderId") or res.get("positionId") or res.get("ok"))
                if ok:
                    out["opened"].append(detail)
                    open_count += 1
                else:
                    out["signals"][s] = f"skipped: order rejected ({res})"[:120]
            except Exception as exc:
                out["signals"][s] = f"error: {exc}"
        return out
