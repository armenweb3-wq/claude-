"""Event-driven backtester.

Simulates the live strategy bar-by-bar for one symbol/timeframe, matching the
LIVE exit engine (not an idealised one):

- entries sized by the risk model (risk/sizing.plan_position), refused when the
  plan is liquidation-unsafe (same as live)
- 3% stop, reduce-only TP ladder (TP1/TP2/TP3 partial closes)
- stop RATCHETS like live: to break-even+buffer at TP1, to TP1 at TP2 (no
  continuous distance-trail)
- taker fees + slippage on EVERY fill (entry and exit) + perpetual FUNDING on
  held notional

Fills are conservative: signals computed on a *closed* bar are entered at the
next bar's open; intrabar SL/TP use the bar's high/low. When both the stop and a
TP fall inside the same bar, the stop is assumed to hit first (worst case).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from ..risk.sizing import plan_position
from ..strategy.base import Strategy
from ..strategy.confluence import ConfluenceStrategy


@dataclass
class BacktestConfig:
    initial_equity: float = 10_000.0
    risk_pct: float = 5.0
    leverage_cap: float = 10.0
    max_trades_per_day: int = 20
    taker_fee: float = 0.00055     # 0.055% Bybit perp taker
    slippage: float = 0.0005       # 0.05% per fill (entry AND exit)
    funding_rate_8h: float = 0.0001  # ~0.01% / 8h funding on held notional
    breakeven_buffer: float = 0.0012  # stop moves to entry+0.12% at TP1 (matches live)
    warmup: int = 220              # bars before trading (EMA200 + buffer)
    signal_lookback: int = 400     # bars passed to the strategy per step (keeps it O(n))


@dataclass
class Trade:
    symbol: str
    side: str
    entry_time: pd.Timestamp
    entry: float
    qty: float
    stop: float
    tps: list  # list[(price, close_fraction)]
    leverage: float
    confidence: float
    # filled during/after the trade
    exit_time: pd.Timestamp | None = None
    realized_pnl: float = 0.0
    fees: float = 0.0
    closed_fraction: float = 0.0
    reason: str = ""
    tp_hits: int = 0


@dataclass
class BacktestResult:
    symbol: str
    timeframe: str
    config: BacktestConfig
    trades: list[Trade] = field(default_factory=list)
    equity_curve: list[tuple[str, float]] = field(default_factory=list)
    final_equity: float = 0.0


class _OpenPosition:
    def __init__(self, trade: Trade):
        self.t = trade
        self.remaining = trade.qty
        self.tp_idx = 0
        self.trailing = False
        self.extreme = trade.entry  # best price reached (for trailing)


class Backtester:
    def __init__(self, strategy: Strategy | None = None, config: BacktestConfig | None = None):
        self.strategy = strategy or ConfluenceStrategy()
        self.cfg = config or BacktestConfig()

    def run(self, df: pd.DataFrame, symbol: str, timeframe: str) -> BacktestResult:
        cfg = self.cfg
        res = BacktestResult(symbol=symbol, timeframe=timeframe, config=cfg)
        equity = cfg.initial_equity
        pos: _OpenPosition | None = None
        trades_today = 0
        current_day = None

        # Bar duration in hours (for funding accrual); default 1h if unknown.
        try:
            self._bar_hours = float(pd.Series(df.index).diff().dropna().median()
                                    / pd.Timedelta(hours=1)) or 1.0
        except Exception:
            self._bar_hours = 1.0

        n = len(df)
        for i in range(cfg.warmup, n - 1):
            bar = df.iloc[i]
            nxt = df.iloc[i + 1]
            day = df.index[i].date()
            if day != current_day:
                current_day, trades_today = day, 0

            # 1) Manage an open position against the *next* bar's range.
            if pos is not None:
                equity = self._manage(pos, nxt, df.index[i + 1], res, equity)
                if pos.remaining <= 1e-12:
                    pos = None

            # 2) Look for a new entry only when flat and under the daily cap.
            if pos is None and trades_today < cfg.max_trades_per_day:
                window = df.iloc[max(0, i + 1 - cfg.signal_lookback) : i + 1]
                sig = self.strategy.generate(window)
                if sig.action in ("long", "short") and sig.entry and sig.stop_loss:
                    entry_px = nxt["open"] * (1 + self._slip(sig.action))
                    plan = plan_position(
                        equity=equity, risk_pct=cfg.risk_pct, entry=entry_px,
                        stop=sig.stop_loss, side=sig.action, leverage_cap=cfg.leverage_cap,
                    )
                    if plan.qty > 0 and plan.safe:  # refuse unsafe plans, like live
                        trade = Trade(
                            symbol=symbol, side=sig.action, entry_time=df.index[i + 1],
                            entry=entry_px, qty=plan.qty, stop=sig.stop_loss,
                            tps=[(tp.price, tp.close_fraction) for tp in sig.take_profits],
                            leverage=plan.leverage, confidence=sig.confidence,
                        )
                        fee = entry_px * plan.qty * cfg.taker_fee
                        trade.fees += fee
                        equity -= fee
                        pos = _OpenPosition(trade)
                        res.trades.append(trade)
                        trades_today += 1

            res.equity_curve.append((df.index[i + 1].isoformat(), round(equity, 2)))

        # Close any residual position at the last close.
        if pos is not None:
            equity = self._close_remainder(pos, df.iloc[-1], df.index[-1], res, equity, "eod")

        res.final_equity = round(equity, 2)
        return res

    # ── position management ─────────────────────────────────
    def _manage(self, pos, bar, ts, res, equity) -> float:
        t = pos.t
        long = t.side == "long"
        high, low = bar["high"], bar["low"]

        # Perpetual funding on the held notional for this bar (a real cost on
        # multi-bar holds, ignored before).
        funding = (self.cfg.funding_rate_8h * (self._bar_hours / 8.0)
                   * pos.remaining * float(bar["close"]))
        t.fees += funding
        equity -= funding

        # Stop assumed to trigger before TP within the same bar (worst case).
        stop_hit = low <= t.stop if long else high >= t.stop
        if stop_hit:
            return self._close_remainder(pos, {"close": t.stop}, ts, res, equity,
                                         "trail-stop" if pos.trailing else "stop")

        # Walk the TP ladder, RATCHETING the stop the same way live does.
        while pos.tp_idx < len(t.tps):
            tp_price, frac = t.tps[pos.tp_idx]
            hit = high >= tp_price if long else low <= tp_price
            if not hit:
                break
            qty = min(t.qty * frac, pos.remaining)
            equity += self._realize(pos, tp_price, qty, res)
            t.tp_hits += 1
            pos.tp_idx += 1
            sign = 1 if long else -1
            if pos.tp_idx == 1:
                pos.trailing = True
                t.stop = t.entry * (1 + sign * self.cfg.breakeven_buffer)  # TP1 -> break-even
            elif pos.tp_idx >= 2:
                t.stop = t.tps[pos.tp_idx - 2][0]  # TP2 -> TP1, etc.
            if pos.remaining <= 1e-12:
                t.exit_time = ts
                t.reason = "tp-ladder"
                break
        return equity

    def _realize(self, pos, price, qty, res) -> float:
        t = pos.t
        long = t.side == "long"
        sign = 1 if long else -1
        # Exit slippage is adverse: a long sells lower, a short buys back higher.
        fill = price * (1 - self.cfg.slippage) if long else price * (1 + self.cfg.slippage)
        gross = sign * (fill - t.entry) * qty
        fee = fill * qty * self.cfg.taker_fee
        pos.remaining -= qty
        t.realized_pnl += gross - fee
        t.fees += fee
        t.closed_fraction = round(1 - pos.remaining / t.qty, 4)
        return gross - fee

    def _close_remainder(self, pos, bar, ts, res, equity, reason) -> float:
        price = bar["close"]
        equity += self._realize(pos, price, pos.remaining, res)
        pos.t.exit_time = ts
        pos.t.reason = reason
        return equity

    # ── helpers ─────────────────────────────────────────────
    def _stop_frac(self, t: Trade) -> float:
        return abs(t.entry - t.stop) / t.entry

    def _slip(self, side: str) -> float:
        return self.cfg.slippage if side == "long" else -self.cfg.slippage
