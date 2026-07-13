"""PLACEHOLDER strategy: simple SMA crossover.

This exists so the pipeline runs end-to-end. It is NOT a profitable edge.
Replace `generate()` with your actual entry/exit logic (the rules you
have not yet given me), or add a new Strategy alongside it.
"""
from __future__ import annotations

import pandas as pd

from .base import Signal, Strategy

FAST = 9
SLOW = 21


class SmaCrossover(Strategy):
    name = "sma_crossover"

    def generate(self, df: pd.DataFrame) -> Signal:
        if df.empty or len(df) < SLOW + 2:
            return Signal("hold", reason="insufficient data")

        close = df["close"]
        fast = close.rolling(FAST).mean()
        slow = close.rolling(SLOW).mean()

        fast_now, fast_prev = fast.iloc[-1], fast.iloc[-2]
        slow_now, slow_prev = slow.iloc[-1], slow.iloc[-2]

        crossed_up = fast_prev <= slow_prev and fast_now > slow_now
        crossed_down = fast_prev >= slow_prev and fast_now < slow_now

        if crossed_up:
            return Signal("long", reason=f"SMA{FAST} crossed above SMA{SLOW}")
        if crossed_down:
            return Signal("short", reason=f"SMA{FAST} crossed below SMA{SLOW}")
        return Signal("hold", reason="no crossover")
