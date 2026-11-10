"""Strategy definitions.

A strategy sees closed bars only (never the forming bar) and answers two
questions: *should I enter now, and where is the initial stop?* and *for an
open position, where should the stop be now / should I exit?*. Position
sizing, cost modelling and risk limits are handled outside the strategy so
every strategy gets the same safety rails.

Both strategies here are classic, widely documented systematic approaches:

* ``trend_breakout`` - Donchian channel breakout in the direction of a long
  EMA trend, filtered by ADX (trend strength) and a volatility floor, with an
  ATR initial stop and an ATR trailing stop ("chandelier"). Turtle-style.
* ``ema_pullback`` - trend continuation: in an established EMA trend, buy a
  pullback to the fast EMA when RSI has reset, stop below the recent swing
  with ATR padding, target a multiple of the risk, trail after 1R.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from . import indicators as I


@dataclass
class Bar:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    spread: int = 0


@dataclass
class Entry:
    direction: int            # +1 long, -1 short
    stop: float
    target: float | None
    reason: str


@dataclass
class Series:
    """Indicator arrays computed once for a list of bars."""
    bars: list[Bar]
    ind: dict[str, list] = field(default_factory=dict)

    @property
    def close(self) -> list[float]:
        return [b.close for b in self.bars]


class Strategy:
    key = "base"
    name = "Base"
    description = ""
    defaults: dict[str, Any] = {}
    warmup = 50

    def __init__(self, params: dict[str, Any] | None = None):
        p = dict(self.defaults)
        for k, v in (params or {}).items():
            if k in p and v is not None and v != "":
                try:
                    p[k] = type(p[k])(v)
                except (TypeError, ValueError):
                    pass
        self.p = p

    # --- to implement
    def prepare(self, bars: list[Bar]) -> Series:
        raise NotImplementedError

    def entry(self, s: Series, i: int) -> Entry | None:
        raise NotImplementedError

    def manage(self, s: Series, i: int, direction: int, entry_price: float, stop: float, bars_held: int) -> tuple[float, bool]:
        """Return (new_stop, exit_now)."""
        return stop, False

    def describe(self) -> dict[str, Any]:
        return {"key": self.key, "name": self.name, "description": self.description, "params": self.p, "warmup": self.warmup}


class TrendBreakout(Strategy):
    key = "trend_breakout"
    name = "Trend breakout (Donchian + EMA + ADX)"
    description = ("Enters when price closes beyond the highest high / lowest low of the last N bars, only in the direction of "
                   "the long EMA and only when ADX shows a trend. Initial stop = k × ATR; the stop then trails the best price "
                   "by k × ATR (chandelier) and never moves backwards. Exits on the trailing stop or an opposite channel break.")
    defaults = {"channel": 20, "exit_channel": 10, "ema": 100, "adx_period": 14, "adx_min": 20.0, "atr_period": 14,
                "atr_stop": 2.5, "atr_trail": 3.0, "min_atr_points": 0.0}
    warmup = 220

    def prepare(self, bars: list[Bar]) -> Series:
        h = [b.high for b in bars]; l = [b.low for b in bars]; c = [b.close for b in bars]
        hi, lo = I.donchian(h, l, int(self.p["channel"]))
        xhi, xlo = I.donchian(h, l, int(self.p["exit_channel"]))
        return Series(bars, {"hi": hi, "lo": lo, "xhi": xhi, "xlo": xlo, "ema": I.ema(c, int(self.p["ema"])),
                             "adx": I.adx(h, l, c, int(self.p["adx_period"])), "atr": I.atr(h, l, c, int(self.p["atr_period"]))})

    def entry(self, s: Series, i: int) -> Entry | None:
        b = s.bars[i]; d = s.ind
        hi, lo, e, a, atr = d["hi"][i], d["lo"][i], d["ema"][i], d["adx"][i], d["atr"][i]
        if None in (hi, lo, e, a, atr) or atr <= 0:
            return None
        if a < float(self.p["adx_min"]):
            return None
        if b.close > hi and b.close > e:
            return Entry(+1, b.close - float(self.p["atr_stop"]) * atr, None, f"close {b.close:.5g} > {int(self.p['channel'])}-bar high, EMA{int(self.p['ema'])} up, ADX {a:.0f}")
        if b.close < lo and b.close < e:
            return Entry(-1, b.close + float(self.p["atr_stop"]) * atr, None, f"close {b.close:.5g} < {int(self.p['channel'])}-bar low, EMA{int(self.p['ema'])} down, ADX {a:.0f}")
        return None

    def manage(self, s: Series, i: int, direction: int, entry_price: float, stop: float, bars_held: int) -> tuple[float, bool]:
        b = s.bars[i]; d = s.ind
        atr = d["atr"][i]
        if atr is None:
            return stop, False
        trail = float(self.p["atr_trail"]) * atr
        # chandelier: trail from the extreme since entry (approximated by current bar extreme)
        if direction > 0:
            new_stop = max(stop, b.high - trail)
            exit_now = d["xlo"][i] is not None and b.close < d["xlo"][i]
        else:
            new_stop = min(stop, b.low + trail)
            exit_now = d["xhi"][i] is not None and b.close > d["xhi"][i]
        return new_stop, bool(exit_now)


class EmaPullback(Strategy):
    key = "ema_pullback"
    name = "EMA pullback (trend continuation)"
    description = ("In an established trend (fast EMA above/below slow EMA, price on the right side of the slow EMA), waits for "
                   "a pullback that touches the fast EMA with RSI reset, then enters on a close back in the trend direction. "
                   "Stop beyond the pullback extreme plus ATR padding, target = R multiple, stop moves to break-even after 1R "
                   "and then trails by ATR.")
    defaults = {"ema_fast": 20, "ema_slow": 50, "rsi_period": 14, "rsi_pullback": 45.0, "atr_period": 14, "atr_pad": 1.0,
                "target_r": 2.0, "lookback": 5, "atr_trail": 2.0}
    warmup = 120

    def prepare(self, bars: list[Bar]) -> Series:
        h = [b.high for b in bars]; l = [b.low for b in bars]; c = [b.close for b in bars]
        return Series(bars, {"ef": I.ema(c, int(self.p["ema_fast"])), "es": I.ema(c, int(self.p["ema_slow"])),
                             "rsi": I.rsi(c, int(self.p["rsi_period"])), "atr": I.atr(h, l, c, int(self.p["atr_period"]))})

    def entry(self, s: Series, i: int) -> Entry | None:
        d = s.ind; b = s.bars[i]
        ef, es, atr = d["ef"][i], d["es"][i], d["atr"][i]
        if None in (ef, es, atr) or atr <= 0:
            return None
        lb = int(self.p["lookback"])
        if i < lb + 1:
            return None
        window = s.bars[i - lb:i + 1]
        rsis = [d["rsi"][j] for j in range(i - lb, i + 1) if d["rsi"][j] is not None]
        if not rsis:
            return None
        thr = float(self.p["rsi_pullback"])
        if ef > es and b.close > es:
            touched = any(w.low <= d["ef"][j] for j, w in zip(range(i - lb, i + 1), window) if d["ef"][j] is not None)
            if touched and min(rsis) <= thr and b.close > ef and b.close > b.open:
                stop = min(w.low for w in window) - float(self.p["atr_pad"]) * atr
                risk = b.close - stop
                return Entry(+1, stop, b.close + float(self.p["target_r"]) * risk, f"pullback to EMA{int(self.p['ema_fast'])} in uptrend, RSI low {min(rsis):.0f}")
        if ef < es and b.close < es:
            touched = any(w.high >= d["ef"][j] for j, w in zip(range(i - lb, i + 1), window) if d["ef"][j] is not None)
            if touched and max(rsis) >= 100 - thr and b.close < ef and b.close < b.open:
                stop = max(w.high for w in window) + float(self.p["atr_pad"]) * atr
                risk = stop - b.close
                return Entry(-1, stop, b.close - float(self.p["target_r"]) * risk, f"pullback to EMA{int(self.p['ema_fast'])} in downtrend, RSI high {max(rsis):.0f}")
        return None

    def manage(self, s: Series, i: int, direction: int, entry_price: float, stop: float, bars_held: int) -> tuple[float, bool]:
        b = s.bars[i]; atr = s.ind["atr"][i]
        if atr is None:
            return stop, False
        risk = abs(entry_price - stop) if bars_held == 0 else None
        if direction > 0:
            # break-even after 1R, then ATR trail
            if b.close - entry_price >= abs(entry_price - stop) and stop < entry_price:
                stop = entry_price
            if stop >= entry_price:
                stop = max(stop, b.high - float(self.p["atr_trail"]) * atr)
        else:
            if entry_price - b.close >= abs(entry_price - stop) and stop > entry_price:
                stop = entry_price
            if stop <= entry_price:
                stop = min(stop, b.low + float(self.p["atr_trail"]) * atr)
        return stop, False


STRATEGIES: dict[str, type[Strategy]] = {TrendBreakout.key: TrendBreakout, EmaPullback.key: EmaPullback}


def make_strategy(key: str, params: dict[str, Any] | None = None) -> Strategy:
    cls = STRATEGIES.get(key)
    if cls is None:
        raise ValueError(f"Unknown strategy '{key}'. Available: {', '.join(STRATEGIES)}")
    return cls(params)


def catalogue() -> list[dict[str, Any]]:
    return [cls().describe() for cls in STRATEGIES.values()]
