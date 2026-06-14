"""Confluence strategy.

Combines RSI(14), 50/200 EMA structure, an EMA crossover trigger, and
supply/demand-zone proximity into a single confidence score in [0, 1].
The score doubles as the "win-probability" gate: trades below
``confidence_threshold`` are skipped.

Direction (BUY long vs SELL short) is whichever side scores higher. The
market regime biases the scores and tightens leverage in bear conditions.

A "liquidation heatmap" hook is included as an optional, neutral-by-default
signal source — wired to a Bybit-derived proxy in live mode (see
exchange/liq_proxy), and left neutral in backtests where that data is absent.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .base import Signal, Strategy, TakeProfit
from .indicators import ema, nearest_zone, proximity_pct, rsi, swing_zones
from .regime import detect_regime


@dataclass
class StrategyConfig:
    rsi_period: int = 14
    ema_fast: int = 50
    ema_slow: int = 200
    stop_pct: float = 3.0
    tp_ladder: list[tuple[float, float]] = field(
        default_factory=lambda: [(6.0, 0.30), (12.0, 0.40), (20.0, 0.30)]
    )
    confidence_threshold: float = 0.70
    leverage_cap: float = 10.0
    zone_proximity_pct: float = 1.5   # "near" a zone if within this %
    crossover_lookback: int = 3       # bars to look back for an EMA cross
    use_regime: bool = True

    # Condition weights (per side); should sum to ~1.0.
    w_structure: float = 0.25   # ema_fast vs ema_slow
    w_trend: float = 0.15       # price vs ema_slow
    w_rsi: float = 0.20         # rsi confluence
    w_crossover: float = 0.20   # recent ema crossover / price-cross trigger
    w_zone: float = 0.20        # supply/demand proximity


class ConfluenceStrategy(Strategy):
    name = "confluence"

    def __init__(self, config: StrategyConfig | None = None) -> None:
        self.cfg = config or StrategyConfig()

    def generate(self, df: pd.DataFrame) -> Signal:
        cfg = self.cfg
        if df.empty or len(df) < cfg.ema_slow + cfg.crossover_lookback + 2:
            return Signal("hold", reason="insufficient data")

        close = df["close"]
        r = rsi(close, cfg.rsi_period)
        ema_f = ema(close, cfg.ema_fast)
        ema_s = ema(close, cfg.ema_slow)
        zones = swing_zones(df)

        price = float(close.iloc[-1])
        rsi_now, rsi_prev = float(r.iloc[-1]), float(r.iloc[-2])
        ef, es = float(ema_f.iloc[-1]), float(ema_s.iloc[-1])

        long_score = self._score("long", price, rsi_now, rsi_prev, ema_f, ema_s, ef, es, zones)
        short_score = self._score("short", price, rsi_now, rsi_prev, ema_f, ema_s, ef, es, zones)

        if cfg.use_regime:
            view = detect_regime(df)
            long_score = min(1.0, long_score * view.long_bias)
            short_score = min(1.0, short_score * view.short_bias)
            lev_cap = cfg.leverage_cap * view.leverage_factor
        else:
            lev_cap = cfg.leverage_cap

        if long_score >= short_score:
            action, confidence = "long", long_score
        else:
            action, confidence = "short", short_score

        if confidence < cfg.confidence_threshold:
            return Signal(
                "hold",
                reason=f"confidence {confidence:.2f} < {cfg.confidence_threshold:.2f}",
                confidence=confidence,
            )

        return self._build_plan(action, price, confidence, lev_cap)

    # ── scoring ─────────────────────────────────────────────
    def _score(self, side, price, rsi_now, rsi_prev, ema_f, ema_s, ef, es, zones) -> float:
        cfg = self.cfg
        score = 0.0
        if side == "long":
            if ef > es:
                score += cfg.w_structure
            if price > es:
                score += cfg.w_trend
            if rsi_now > 50 and rsi_now > rsi_prev:
                score += cfg.w_rsi
            if self._crossed_up(ema_f, ema_s):
                score += cfg.w_crossover
            zone = nearest_zone(zones, "demand", price)
            if zone and proximity_pct(price, zone) <= cfg.zone_proximity_pct:
                score += cfg.w_zone
        else:  # short
            if ef < es:
                score += cfg.w_structure
            if price < es:
                score += cfg.w_trend
            if rsi_now < 50 and rsi_now < rsi_prev:
                score += cfg.w_rsi
            if self._crossed_down(ema_f, ema_s):
                score += cfg.w_crossover
            zone = nearest_zone(zones, "supply", price)
            if zone and proximity_pct(price, zone) <= cfg.zone_proximity_pct:
                score += cfg.w_zone
        return round(score, 4)

    def _crossed_up(self, ema_f: pd.Series, ema_s: pd.Series) -> bool:
        lb = self.cfg.crossover_lookback
        for i in range(1, lb + 1):
            if ema_f.iloc[-i - 1] <= ema_s.iloc[-i - 1] and ema_f.iloc[-i] > ema_s.iloc[-i]:
                return True
        return False

    def _crossed_down(self, ema_f: pd.Series, ema_s: pd.Series) -> bool:
        lb = self.cfg.crossover_lookback
        for i in range(1, lb + 1):
            if ema_f.iloc[-i - 1] >= ema_s.iloc[-i - 1] and ema_f.iloc[-i] < ema_s.iloc[-i]:
                return True
        return False

    # ── plan construction ───────────────────────────────────
    def _build_plan(self, action, price, confidence, lev_cap) -> Signal:
        cfg = self.cfg
        sign = 1.0 if action == "long" else -1.0
        stop = price * (1 - sign * cfg.stop_pct / 100)
        tps = [
            TakeProfit(pct=p, close_fraction=f, price=price * (1 + sign * p / 100))
            for p, f in cfg.tp_ladder
        ]
        # Blended reward:risk = weighted-avg TP distance / stop distance.
        weighted_reward = sum(p * f for p, f in cfg.tp_ladder)
        rr = round(weighted_reward / cfg.stop_pct, 2)
        leverage = max(1.0, min(lev_cap, round(lev_cap)))
        return Signal(
            action=action,
            reason=f"confluence {confidence:.2f}",
            confidence=confidence,
            entry=price,
            stop_loss=round(stop, 6),
            take_profits=tps,
            leverage=leverage,
            risk_reward=rr,
        )
