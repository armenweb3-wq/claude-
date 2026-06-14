"""BTC cycle-phase tests."""
from __future__ import annotations

import pathlib
import sys
from datetime import datetime, timezone

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.strategy.cycle import assess_cycle  # noqa: E402


def _at(y, m, d):
    return datetime(y, m, d, tzinfo=timezone.utc)


def test_markup_phase_after_halving():
    c = assess_cycle(_at(2025, 1, 1))  # ~8.5 months after Apr-2024 halving
    assert "Bull" in c.phase
    assert c.long_bias > c.short_bias


def test_bear_phase_two_years_after():
    c = assess_cycle(_at(2026, 6, 14))  # ~26 months after halving
    assert "Bear" in c.phase
    assert c.short_bias > c.long_bias
    assert c.leverage_factor < 1.0


def test_early_accumulation_right_after_halving():
    c = assess_cycle(_at(2024, 5, 1))
    assert "Accumulation" in c.phase


def test_months_fields_are_sane():
    c = assess_cycle(_at(2026, 6, 14))
    assert c.months_since_halving > 20
    assert c.months_to_next_halving > 0
