"""Trading strategies, each distilled from a classic idea in the books.

Every strategy implements ``decide(history) -> target_weight`` where:

* ``history`` is the OHLC frame up to and including the current bar (NO future
  data — this is what prevents lookahead bias), and
* ``target_weight`` is the fraction of equity to hold in the asset for the NEXT
  bar, in ``[0, 1]`` (0 = all cash, 1 = fully invested; no leverage, no shorts).

The engine executes that target at the next bar's open, so a strategy can only
act on information it could actually have known at decision time.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


class Strategy:
    name: str = "base"

    def reset(self) -> None:
        """Clear any internal state before a run (stateful strategies override)."""

    def decide(self, history: pd.DataFrame) -> float:
        raise NotImplementedError


# --------------------------------------------------------------------------- #
# Baseline
# --------------------------------------------------------------------------- #
class BuyAndHold(Strategy):
    """The benchmark every strategy must beat to justify its complexity."""

    name = "Buy & Hold"

    def decide(self, history: pd.DataFrame) -> float:
        return 1.0


# --------------------------------------------------------------------------- #
# The video strategy: sell into strength, buy into weakness (grid / averaging)
# --------------------------------------------------------------------------- #
@dataclass
class Grid(Strategy):
    """Sell a slice every ``+sell_pct``; buy a slice every ``-buy_pct``.

    This is the "+5% sell / -10% buy" rule from the clip, generalized. It is a
    mean-reversion bet: it trims after rallies and accumulates into dips. It
    tends to win in choppy/sideways regimes and bleed in strong trends (sells a
    runaway winner too early; keeps buying a falling knife).
    """

    name: str = "Grid (+5%/-10%)"
    sell_pct: float = 0.05
    buy_pct: float = 0.10
    step: float = 0.25            # fraction of equity shifted per trigger
    start_weight: float = 0.5     # begin half-in so there's room both ways
    _ref: float = field(default=np.nan, init=False, repr=False)
    _w: float = field(default=0.0, init=False, repr=False)

    def reset(self) -> None:
        self._ref = np.nan
        self._w = self.start_weight

    def decide(self, history: pd.DataFrame) -> float:
        price = float(history["close"].iloc[-1])
        if np.isnan(self._ref):
            self._ref = price
            return self._w
        if price >= self._ref * (1 + self.sell_pct):
            self._w = max(0.0, self._w - self.step)   # take profit into strength
            self._ref = price
        elif price <= self._ref * (1 - self.buy_pct):
            self._w = min(1.0, self._w + self.step)    # accumulate into weakness
            self._ref = price
        return self._w


# --------------------------------------------------------------------------- #
# Mean reversion via RSI (Elder, "Trading for a Living")
# --------------------------------------------------------------------------- #
def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    rs = gain / loss.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50)


@dataclass
class RSIReversion(Strategy):
    """Buy oversold, sell overbought, hold in between."""

    name: str = "RSI Reversion"
    period: int = 14
    low: float = 30.0
    high: float = 70.0
    _w: float = field(default=0.0, init=False, repr=False)

    def reset(self) -> None:
        self._w = 0.0

    def decide(self, history: pd.DataFrame) -> float:
        if len(history) <= self.period:
            return self._w
        r = rsi(history["close"], self.period).iloc[-1]
        if r < self.low:
            self._w = 1.0
        elif r > self.high:
            self._w = 0.0
        return self._w


# --------------------------------------------------------------------------- #
# Trend following via moving-average crossover (Murphy)
# --------------------------------------------------------------------------- #
@dataclass
class MACrossover(Strategy):
    """Fully invested while the fast MA is above the slow MA, else flat.

    The trend-following counterpart to Grid — designed to ride winners and cut
    losers, the opposite temperament. Comparing the two on the same data is the
    whole point.
    """

    name: str = "MA Crossover"
    fast: int = 20
    slow: int = 50

    def decide(self, history: pd.DataFrame) -> float:
        if len(history) < self.slow:
            return 0.0
        close = history["close"]
        fast = close.rolling(self.fast).mean().iloc[-1]
        slow = close.rolling(self.slow).mean().iloc[-1]
        return 1.0 if fast > slow else 0.0


# --------------------------------------------------------------------------- #
# Price action via candlestick engulfing patterns (Nison)
# --------------------------------------------------------------------------- #
@dataclass
class Engulfing(Strategy):
    """Go long on a bullish engulfing bar; go flat on a bearish engulfing bar."""

    name: str = "Candlestick Engulfing"
    _w: float = field(default=0.0, init=False, repr=False)

    def reset(self) -> None:
        self._w = 0.0

    def decide(self, history: pd.DataFrame) -> float:
        if len(history) < 2:
            return self._w
        prev, cur = history.iloc[-2], history.iloc[-1]
        prev_down = prev["close"] < prev["open"]
        cur_up = cur["close"] > cur["open"]
        bull_engulf = (
            prev_down and cur_up
            and cur["close"] >= prev["open"]
            and cur["open"] <= prev["close"]
        )
        bear_engulf = (
            (not prev_down) and (not cur_up)
            and cur["open"] >= prev["close"]
            and cur["close"] <= prev["open"]
        )
        if bull_engulf:
            self._w = 1.0
        elif bear_engulf:
            self._w = 0.0
        return self._w


# --------------------------------------------------------------------------- #
# Trend filter — the classic that genuinely improves index risk-adjusted return
# (Meb Faber, "A Quantitative Approach to Tactical Asset Allocation")
# --------------------------------------------------------------------------- #
@dataclass
class TrendFilter(Strategy):
    """Hold the index while it's above its long-term average; step aside below.

    The point isn't to boost return — it's to *dodge the deep bear markets*
    (2008, 2022). Sitting out the worst drawdowns lifts risk-adjusted return
    (Sharpe) and slashes max drawdown versus Buy & Hold, while capturing most of
    the upside. The best-documented long-only timing rule there is.
    """

    name: str = "Trend Filter (SMA200)"
    sma: int = 200

    def decide(self, history: pd.DataFrame) -> float:
        if len(history) < self.sma:
            return 1.0  # not enough history yet: default invested
        close = history["close"]
        avg = close.rolling(self.sma).mean().iloc[-1]
        return 1.0 if close.iloc[-1] > avg else 0.0


@dataclass
class TrendDipBuyer(Strategy):
    """Trend filter + buy-the-dip: only act long while above the SMA, and lean in
    harder after a short-term pullback. Combines "don't fight the trend" with
    "buy weakness" — the synthesis of the two book camps."""

    name: str = "Trend + Dip Buyer"
    sma: int = 200
    dip_period: int = 14
    dip_rsi: float = 40.0
    base_weight: float = 0.6

    def decide(self, history: pd.DataFrame) -> float:
        if len(history) < self.sma:
            return 1.0
        close = history["close"]
        if close.iloc[-1] <= close.rolling(self.sma).mean().iloc[-1]:
            return 0.0  # below trend: stay out of trouble
        r = rsi(close, self.dip_period).iloc[-1]
        return 1.0 if r < self.dip_rsi else self.base_weight


def default_suite() -> list[Strategy]:
    """The standard line-up compared in the demo backtest."""
    return [
        BuyAndHold(), Grid(), RSIReversion(), MACrossover(),
        Engulfing(), TrendFilter(), TrendDipBuyer(),
    ]
