"""Pure-Python technical indicators on lists of floats. Each returns a list
aligned with the input (None where not yet defined)."""

from __future__ import annotations

from typing import Sequence


def ema(values: Sequence[float], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if period <= 0 or len(values) < period:
        return out
    k = 2.0 / (period + 1)
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    prev = seed
    for i in range(period, len(values)):
        prev = values[i] * k + prev * (1 - k)
        out[i] = prev
    return out


def sma(values: Sequence[float], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if period <= 0 or len(values) < period:
        return out
    s = sum(values[:period])
    out[period - 1] = s / period
    for i in range(period, len(values)):
        s += values[i] - values[i - period]
        out[i] = s / period
    return out


def true_range(high: Sequence[float], low: Sequence[float], close: Sequence[float]) -> list[float]:
    tr = [high[0] - low[0]] if high else []
    for i in range(1, len(high)):
        tr.append(max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1])))
    return tr


def atr(high: Sequence[float], low: Sequence[float], close: Sequence[float], period: int = 14) -> list[float | None]:
    """Wilder's ATR."""
    tr = true_range(high, low, close)
    out: list[float | None] = [None] * len(tr)
    if len(tr) < period or period <= 0:
        return out
    prev = sum(tr[:period]) / period
    out[period - 1] = prev
    for i in range(period, len(tr)):
        prev = (prev * (period - 1) + tr[i]) / period
        out[i] = prev
    return out


def adx(high: Sequence[float], low: Sequence[float], close: Sequence[float], period: int = 14) -> list[float | None]:
    """Wilder's ADX (trend strength, 0-100)."""
    n = len(high)
    out: list[float | None] = [None] * n
    if n < period * 2 + 1 or period <= 0:
        return out
    tr = true_range(high, low, close)
    plus_dm = [0.0] * n
    minus_dm = [0.0] * n
    for i in range(1, n):
        up = high[i] - high[i - 1]
        down = low[i - 1] - low[i]
        plus_dm[i] = up if (up > down and up > 0) else 0.0
        minus_dm[i] = down if (down > up and down > 0) else 0.0
    # Wilder smoothing
    s_tr = sum(tr[1:period + 1]); s_p = sum(plus_dm[1:period + 1]); s_m = sum(minus_dm[1:period + 1])
    dx: list[float | None] = [None] * n
    for i in range(period + 1, n):
        s_tr = s_tr - s_tr / period + tr[i]
        s_p = s_p - s_p / period + plus_dm[i]
        s_m = s_m - s_m / period + minus_dm[i]
        if s_tr <= 0:
            dx[i] = 0.0
            continue
        pdi = 100.0 * s_p / s_tr
        mdi = 100.0 * s_m / s_tr
        denom = pdi + mdi
        dx[i] = 100.0 * abs(pdi - mdi) / denom if denom else 0.0
    first = period * 2
    vals = [v for v in dx[period + 1:first + 1] if v is not None]
    if len(vals) < period:
        return out
    prev = sum(vals) / len(vals)
    out[first] = prev
    for i in range(first + 1, n):
        prev = (prev * (period - 1) + (dx[i] or 0.0)) / period
        out[i] = prev
    return out


def rsi(values: Sequence[float], period: int = 14) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if len(values) <= period or period <= 0:
        return out
    gains = losses = 0.0
    for i in range(1, period + 1):
        d = values[i] - values[i - 1]
        gains += max(d, 0); losses += max(-d, 0)
    ag, al = gains / period, losses / period
    out[period] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(period + 1, len(values)):
        d = values[i] - values[i - 1]
        ag = (ag * (period - 1) + max(d, 0)) / period
        al = (al * (period - 1) + max(-d, 0)) / period
        out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out


def donchian(high: Sequence[float], low: Sequence[float], period: int) -> tuple[list[float | None], list[float | None]]:
    """Highest high / lowest low of the *previous* ``period`` bars (excluding the current bar)."""
    n = len(high)
    hi: list[float | None] = [None] * n
    lo: list[float | None] = [None] * n
    for i in range(period, n):
        window_h = high[i - period:i]
        window_l = low[i - period:i]
        hi[i] = max(window_h)
        lo[i] = min(window_l)
    return hi, lo


def rolling_std(values: Sequence[float], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if len(values) < period or period <= 1:
        return out
    for i in range(period - 1, len(values)):
        w = values[i - period + 1:i + 1]
        m = sum(w) / period
        out[i] = (sum((x - m) ** 2 for x in w) / period) ** 0.5
    return out
