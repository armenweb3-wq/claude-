"""Confluence strategy.

Scores several *agreeing* signals into a confidence in [0, 1], which also
serves as the win-probability gate (skip trades below
``confidence_threshold``). Direction (BUY long vs SELL short) is whichever
side scores higher; a dynamic market regime biases the scores.

Signal components (weights sum to ~1.0):
  - structure   : 50/200 EMA order
  - trend       : price vs 200 EMA
  - rsi         : RSI(14) confluence
  - crossover   : recent EMA crossover trigger
  - zone        : supply/demand proximity
  - htf         : HIGHER-timeframe trend agreement (multi-timeframe)
  - volume      : above-average volume confirmation
  - adx         : trend strength (avoid chop)
  - flag        : bull/bear flag continuation pattern
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .base import Signal, Strategy, TakeProfit
from .indicators import (
    adx,
    detect_flag,
    ema,
    nearest_zone,
    proximity_pct,
    rsi,
    swing_zones,
    to_higher_tf,
    volume_ratio,
)
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
    zone_proximity_pct: float = 1.5
    crossover_lookback: int = 3
    use_regime: bool = True

    # Multi-timeframe / extra filters
    htf_factor: int = 4          # bars per higher-timeframe candle (1h->4h)
    htf_ema_fast: int = 20
    htf_ema_slow: int = 50
    vol_window: int = 20
    vol_confirm: float = 1.2     # volume must exceed this x its average
    adx_min: float = 20.0        # below this = chop, no trend

    # Component weights (≈ sum to 1.0)
    w_structure: float = 0.15
    w_trend: float = 0.10
    w_rsi: float = 0.10
    w_crossover: float = 0.10
    w_zone: float = 0.10
    w_htf: float = 0.20
    w_volume: float = 0.10
    w_adx: float = 0.05
    w_flag: float = 0.10


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

        # Higher-timeframe trend (multi-timeframe alignment).
        htf = to_higher_tf(df, cfg.htf_factor)
        htf_bull = htf_bear = False
        if len(htf) >= cfg.htf_ema_slow + 1:
            hf = ema(htf["close"], cfg.htf_ema_fast)
            hs = ema(htf["close"], cfg.htf_ema_slow)
            hp = float(htf["close"].iloc[-1])
            htf_bull = hp > hs.iloc[-1] and hf.iloc[-1] > hs.iloc[-1]
            htf_bear = hp < hs.iloc[-1] and hf.iloc[-1] < hs.iloc[-1]

        vol_ok = volume_ratio(df, cfg.vol_window) >= cfg.vol_confirm
        adx_ok = float(adx(df).iloc[-1]) >= cfg.adx_min
        flag = detect_flag(df)

        ctx = dict(
            price=float(close.iloc[-1]),
            rsi_now=float(r.iloc[-1]), rsi_prev=float(r.iloc[-2]),
            ema_f=ema_f, ema_s=ema_s, ef=float(ema_f.iloc[-1]), es=float(ema_s.iloc[-1]),
            zones=zones, htf_bull=htf_bull, htf_bear=htf_bear,
            vol_ok=vol_ok, adx_ok=adx_ok, flag=flag,
        )

        long_score = self._score("long", ctx)
        short_score = self._score("short", ctx)

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
        return self._build_plan(action, ctx["price"], confidence, lev_cap)

    # ── scoring ─────────────────────────────────────────────
    def _score(self, side: str, c: dict) -> float:
        cfg = self.cfg
        score = 0.0
        long = side == "long"

        if (c["ef"] > c["es"]) if long else (c["ef"] < c["es"]):
            score += cfg.w_structure
        if (c["price"] > c["es"]) if long else (c["price"] < c["es"]):
            score += cfg.w_trend
        if long:
            if c["rsi_now"] > 50 and c["rsi_now"] > c["rsi_prev"]:
                score += cfg.w_rsi
            if self._crossed("up", c["ema_f"], c["ema_s"]):
                score += cfg.w_crossover
        else:
            if c["rsi_now"] < 50 and c["rsi_now"] < c["rsi_prev"]:
                score += cfg.w_rsi
            if self._crossed("down", c["ema_f"], c["ema_s"]):
                score += cfg.w_crossover

        zone = nearest_zone(c["zones"], "demand" if long else "supply", c["price"])
        if zone and proximity_pct(c["price"], zone) <= cfg.zone_proximity_pct:
            score += cfg.w_zone

        if (c["htf_bull"]) if long else (c["htf_bear"]):
            score += cfg.w_htf
        if c["vol_ok"]:
            score += cfg.w_volume
        if c["adx_ok"]:
            score += cfg.w_adx
        if c["flag"] == ("bull" if long else "bear"):
            score += cfg.w_flag

        return round(score, 4)

    def _crossed(self, direction: str, ema_f: pd.Series, ema_s: pd.Series) -> bool:
        lb = self.cfg.crossover_lookback
        for i in range(1, lb + 1):
            pf, ps = ema_f.iloc[-i - 1], ema_s.iloc[-i - 1]
            nf, ns = ema_f.iloc[-i], ema_s.iloc[-i]
            if direction == "up" and pf <= ps and nf > ns:
                return True
            if direction == "down" and pf >= ps and nf < ns:
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
