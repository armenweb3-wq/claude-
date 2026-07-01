"""Risk management: position sizing and guard rails.

Sizing uses the classic fixed-fractional model: risk a fixed % of equity
per trade, with the stop distance determining quantity. All limits come
from config so they can be tuned without code changes.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..config import settings


@dataclass
class RiskDecision:
    allowed: bool
    qty: float = 0.0
    stop_loss: float | None = None
    take_profit: float | None = None
    reason: str = ""


class RiskManager:
    def __init__(self) -> None:
        self._day_start_equity: float | None = None
        self._halted = False

    def register_equity(self, equity: float) -> None:
        """Call once per day boundary to anchor the daily drawdown guard."""
        if (self._day_start_equity is None or self._day_start_equity <= 0) and equity > 0:
            self._day_start_equity = equity

    def daily_drawdown_breached(self, equity: float) -> bool:
        # No positive anchor yet (e.g. funds not in the trading account):
        # nothing to measure a drawdown against, so never "breached".
        if not self._day_start_equity or self._day_start_equity <= 0:
            if equity > 0:
                self._day_start_equity = equity
            return False
        loss_pct = (self._day_start_equity - equity) / self._day_start_equity * 100
        if loss_pct >= settings.daily_max_loss_pct:
            self._halted = True
        return self._halted

    def evaluate(
        self,
        *,
        side: str,
        equity: float,
        price: float,
        open_positions: int,
    ) -> RiskDecision:
        if self._halted or self.daily_drawdown_breached(equity):
            return RiskDecision(False, reason="daily max loss reached — trading halted")

        if open_positions >= settings.max_open_positions:
            return RiskDecision(False, reason="max open positions reached")

        if price <= 0 or equity <= 0:
            return RiskDecision(False, reason="invalid price/equity")

        # Stop/target derived from configured percentages.
        if side == "long":
            stop = price * (1 - settings.stop_loss_pct / 100)
            target = price * (1 + settings.take_profit_pct / 100)
        else:  # short
            stop = price * (1 + settings.stop_loss_pct / 100)
            target = price * (1 - settings.take_profit_pct / 100)

        risk_amount = equity * (settings.risk_per_trade_pct / 100)
        stop_distance = abs(price - stop)
        if stop_distance <= 0:
            return RiskDecision(False, reason="zero stop distance")

        qty = risk_amount / stop_distance

        # Cap notional by leverage.
        max_notional = equity * settings.max_leverage
        if qty * price > max_notional:
            qty = max_notional / price

        qty = round(qty, 6)
        if qty <= 0:
            return RiskDecision(False, reason="computed qty <= 0")

        return RiskDecision(
            allowed=True,
            qty=qty,
            stop_loss=round(stop, 2),
            take_profit=round(target, 2),
            reason="ok",
        )
