"""Event-driven backtester with realistic frictions, plus performance metrics.

Design choices that keep the results honest:

* **No lookahead.** A strategy decides on bar ``t`` using data through bar ``t``;
  the trade fills at the *open* of bar ``t+1``. You can never trade on a price
  you couldn't have seen.
* **Costs.** Every rebalance pays commission + slippage on the traded notional,
  so churn is penalized the way it is in real life.
* **Single asset, long-only, no leverage.** Weights are clamped to ``[0, 1]``.

The same engine drives both the historical backtest and the live paper bot.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from strategies import Strategy

TRADING_DAYS = 365  # crypto trades every day; use 252 for stock-only data


@dataclass
class BacktestResult:
    equity: pd.Series          # mark-to-market equity per bar
    weights: pd.Series         # realized exposure (×equity) per bar
    trades: int                # number of non-trivial rebalances
    price: pd.Series           # underlying close, for plotting/benchmark
    name: str
    liquidations: int = 0      # margin-call wipeouts (leverage only)

    @property
    def returns(self) -> pd.Series:
        return self.equity.pct_change().fillna(0.0)


def run_backtest(
    df: pd.DataFrame,
    strategy: Strategy,
    starting_cash: float = 10_000.0,
    commission: float = 0.0005,        # 5 bps per side
    slippage: float = 0.0005,          # 5 bps modeled market impact
    leverage: float = 1.0,             # exposure multiplier (1 = no leverage)
    borrow_rate: float = 0.06,         # annual interest on the margin loan
    maintenance_margin: float = 0.25,  # broker liquidates below this equity/exposure
    periods_per_year: int = TRADING_DAYS,
) -> BacktestResult:
    """Backtest a strategy, optionally with leverage.

    With ``leverage > 1`` the strategy's signal in ``[0, 1]`` is scaled to
    ``[0, leverage]`` exposure. The shortfall is a margin loan: it accrues
    ``borrow_rate`` interest daily, and if an intraday move drives
    equity/exposure below ``maintenance_margin`` the position is **liquidated**
    at that low (a margin call) — the leveraged-account wipeout that long-only
    backtests pretend can't happen.
    """
    strategy.reset()
    opens = df["open"].to_numpy()
    highs = df["high"].to_numpy()
    lows = df["low"].to_numpy()
    closes = df["close"].to_numpy()
    n = len(df)

    cash = starting_cash               # negative cash = margin loan
    units = 0.0
    pending_w = 0.0                    # target *base* weight to fill at next open
    cost_rate = commission + slippage
    daily_borrow = borrow_rate / periods_per_year

    equity = np.empty(n)
    realized_w = np.empty(n)
    trades = 0
    liquidations = 0
    dead = False                       # account blown — stays in cash at 0

    for i in range(n):
        price = opens[i]

        # 1) accrue interest on any margin loan (negative cash) overnight
        if cash < 0:
            cash += cash * daily_borrow  # cash more negative

        # 2) fill yesterday's decision at today's open (scaled by leverage)
        if not dead:
            equity_now = cash + units * price
            target_units = (pending_w * leverage * equity_now) / price
            delta = target_units - units
            if abs(delta) * price > 1e-9:
                cash -= delta * price + abs(delta) * price * cost_rate
                units = target_units
                if i > 0:
                    trades += 1

        # 3) margin call? check the worst intraday point (the bar's low)
        if units > 0 and leverage > 1.0:
            exposure_low = units * lows[i]
            equity_low = cash + exposure_low
            if equity_low <= maintenance_margin * exposure_low:
                # forced liquidation at the low, pay costs, blow the account
                cash = max(0.0, equity_low - units * lows[i] * cost_rate)
                units = 0.0
                liquidations += 1
                dead = True

        # 4) mark to market at today's close
        mkt = cash + units * closes[i]
        if mkt <= 0:
            mkt = 0.0
            units = 0.0
            cash = 0.0
            dead = True
        equity[i] = mkt
        realized_w[i] = (units * closes[i]) / mkt if mkt > 0 else 0.0

        # 5) decide next target from data through today's close (no lookahead)
        pending_w = float(np.clip(strategy.decide(df.iloc[: i + 1]), 0.0, 1.0))

    idx = df.index
    return BacktestResult(
        equity=pd.Series(equity, index=idx),
        weights=pd.Series(realized_w, index=idx),
        trades=trades,
        price=df["close"],
        name=strategy.name,
        liquidations=liquidations,
    )


def metrics(res: BacktestResult, periods_per_year: int = TRADING_DAYS) -> dict:
    """Headline stats. CAGR/Sharpe/MaxDD are what actually separate strategies."""
    eq = res.equity
    rets = res.returns
    total_return = eq.iloc[-1] / eq.iloc[0] - 1
    years = len(eq) / periods_per_year
    cagr = (eq.iloc[-1] / eq.iloc[0]) ** (1 / years) - 1 if years > 0 else np.nan

    vol = rets.std() * np.sqrt(periods_per_year)
    sharpe = (rets.mean() * periods_per_year) / vol if vol > 0 else 0.0

    running_max = eq.cummax()
    drawdown = eq / running_max - 1
    max_dd = drawdown.min()

    # per-bar hit rate while exposed to the market
    exposed = res.weights.shift(1).fillna(0) > 1e-6
    win_rate = (rets[exposed] > 0).mean() if exposed.any() else np.nan

    return {
        "Strategy": res.name,
        "Total Return": total_return,
        "CAGR": cagr,
        "Sharpe": sharpe,
        "Max Drawdown": max_dd,
        "Volatility": vol,
        "Win Rate": win_rate,
        "Trades": res.trades,
        "Liquidations": res.liquidations,
        "Final Equity": eq.iloc[-1],
    }


def metrics_table(results: list[BacktestResult], periods_per_year: int = TRADING_DAYS) -> pd.DataFrame:
    rows = [metrics(r, periods_per_year) for r in results]
    df = pd.DataFrame(rows).set_index("Strategy")
    return df.sort_values("Sharpe", ascending=False)
