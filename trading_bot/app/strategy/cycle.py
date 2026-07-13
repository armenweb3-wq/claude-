"""Bitcoin cycle-phase awareness.

The crypto market moves in ~4-year cycles anchored to BTC halvings. Knowing
roughly where we are lets the bot lean long in markup phases and turn
defensive (favour shorts, cut leverage) in distribution/markdown phases —
on top of the live regime + BTC filters.

This is a *time-based heuristic* (halving dates are known), not a prediction.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone

# Known and estimated BTC halving dates (UTC).
HALVINGS = [
    date(2012, 11, 28),
    date(2016, 7, 9),
    date(2020, 5, 11),
    date(2024, 4, 20),
    date(2028, 4, 17),  # estimate
]


@dataclass
class CycleView:
    phase: str
    months_since_halving: float
    months_to_next_halving: float
    long_bias: float
    short_bias: float
    leverage_factor: float
    note: str


def _months(d0: date, d1: date) -> float:
    return (d1 - d0).days / 30.44


def assess_cycle(now: datetime | None = None) -> CycleView:
    today = (now or datetime.now(timezone.utc)).date()
    last = max((h for h in HALVINGS if h <= today), default=HALVINGS[0])
    nxt = min((h for h in HALVINGS if h > today), default=HALVINGS[-1])
    since = _months(last, today)
    to_next = _months(today, nxt)

    # Historical rhythm (months after halving):
    if since < 6:
        return CycleView("Accumulation (post-halving)", since, to_next,
                         1.0, 0.9, 0.85,
                         "Early cycle — building positions, moderate risk.")
    if since < 18:
        return CycleView("Bull market (markup)", since, to_next,
                         1.15, 0.70, 1.0,
                         "Markup phase — favour longs, full leverage band.")
    if since < 24:
        return CycleView("Distribution (cycle top risk)", since, to_next,
                         0.80, 1.0, 0.7,
                         "Late cycle — take profit, trim risk, watch for the top.")
    if since < 40:
        return CycleView("Bear market (markdown)", since, to_next,
                         0.60, 1.15, 0.6,
                         "Markdown phase — favour shorts, low leverage, be selective.")
    return CycleView("Recovery / pre-halving accumulation", since, to_next,
                     1.0, 0.85, 0.8,
                     "Approaching next halving — accumulation, building longs.")
