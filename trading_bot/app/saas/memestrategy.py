"""Memecoin auto-trading strategy — the decision core.

This is the "brain": pure, deterministic, fully unit-tested. It does NOT touch
the network or place orders — it turns token data into decisions:

1. SafetyScreen — reject scams (honeypot / unrenounced mint / live freeze /
   unlocked LP / concentrated holders / low liquidity / poor rug score).
2. classify   — score a surviving candidate and decide buy vs skip, flip vs
   hold, and position size.
3. PositionManager — manage an open position to the exit plan you described:
     • flip:  take profit fast at a target, stop out, or time out.
     • hold:  when up enough (or volume spikes), SELL ENOUGH TO RECOVER THE
              INITIAL COST (de-risk) and keep the rest as a free "moonbag",
              then ladder out and trail the runner.

The live data feeds (GMGN, on-chain insiders, X/TG/website, new-mint discovery)
are external and injected via ``memeproviders`` — this module never assumes how
the numbers were obtained, which keeps the alpha logic testable and swappable.
"""
from __future__ import annotations

from dataclasses import dataclass, field


# ── inputs ──────────────────────────────────────────────────
@dataclass
class TokenSafety:
    can_sell: bool = False            # honeypot simulation: a sell actually fills
    mint_renounced: bool = False      # no mint authority (can't print more)
    freeze_revoked: bool = False      # no freeze authority (can't freeze your wallet)
    lp_locked_or_burned: bool = False  # liquidity can't be pulled
    top_holder_pct: float = 100.0     # largest non-LP holder %
    dev_holder_pct: float = 100.0     # creator's %
    rug_score: float = 0.0            # 0..100, higher = safer (RugCheck/GMGN)


@dataclass
class TokenMetrics:
    age_minutes: float = 0.0
    liquidity_sol: float = 0.0
    volume_5m_sol: float = 0.0
    buys_5m: int = 0
    sells_5m: int = 0
    holders: int = 0
    holder_growth_5m: int = 0
    smart_money_buys: int = 0         # tracked insider/profitable wallets buying now
    social_score: float = 0.0         # 0..1 blended X / Telegram / website signal
    migrated: bool = False            # graduated pump.fun -> Raydium/DEX


# ── 1) safety screen ────────────────────────────────────────
class SafetyScreen:
    """Hard, non-negotiable rejections. Capital preservation first — when in
    doubt, skip. A missed coin costs nothing; a rug costs the position."""

    def __init__(self, *, min_liquidity_sol: float = 3.0, max_top_holder_pct: float = 20.0,
                 max_dev_pct: float = 8.0, min_rug_score: float = 65.0) -> None:
        self.min_liquidity_sol = min_liquidity_sol
        self.max_top_holder_pct = max_top_holder_pct
        self.max_dev_pct = max_dev_pct
        self.min_rug_score = min_rug_score

    def check(self, s: TokenSafety, m: TokenMetrics) -> tuple[bool, str]:
        if not s.can_sell:
            return False, "honeypot — sell did not fill"
        if not s.mint_renounced:
            return False, "mint authority not renounced"
        if not s.freeze_revoked:
            return False, "freeze authority still active"
        if not s.lp_locked_or_burned:
            return False, "LP not locked/burned (rug risk)"
        if s.top_holder_pct > self.max_top_holder_pct:
            return False, f"top holder {s.top_holder_pct:.0f}% > {self.max_top_holder_pct:.0f}%"
        if s.dev_holder_pct > self.max_dev_pct:
            return False, f"dev holds {s.dev_holder_pct:.0f}%"
        if s.rug_score < self.min_rug_score:
            return False, f"rug score {s.rug_score:.0f} < {self.min_rug_score:.0f}"
        if m.liquidity_sol < self.min_liquidity_sol:
            return False, f"liquidity {m.liquidity_sol:.1f} SOL too low"
        return True, "ok"


# ── 2) scoring / classification ─────────────────────────────
@dataclass
class Plan:
    action: str            # 'buy' | 'skip'
    mode: str = "flip"     # 'flip' (quick) | 'hold' (high potential)
    size_sol: float = 0.0
    score: float = 0.0
    reason: str = ""


def score_candidate(m: TokenMetrics) -> float:
    """Blended 0..~100 conviction score. Smart money and social are weighted
    highest — they're the signals that precede the moves you want to catch."""
    bs_ratio = m.buys_5m / max(1, m.sells_5m)
    score = 0.0
    score += min(2.5, bs_ratio) * 8           # buy pressure (cap so it can't dominate)
    score += min(m.volume_5m_sol, 60) * 0.4   # real volume
    score += min(m.smart_money_buys, 5) * 12   # insiders buying = strongest tell
    score += m.social_score * 22               # trend across X/TG/website
    score += min(m.holder_growth_5m, 150) * 0.15
    if m.migrated:
        score += 8                             # survived to a DEX
    return round(score, 1)


def classify(m: TokenMetrics, *, base_size_sol: float, max_size_sol: float,
             min_score: float = 45.0) -> Plan:
    score = score_candidate(m)
    if score < min_score:
        return Plan("skip", score=score, reason="score below threshold")
    # High potential = real insider + social conviction, or a strong post-migration
    # setup → buy-and-hold with a moonbag. Otherwise a quick flip.
    high_potential = (m.smart_money_buys >= 2 and m.social_score >= 0.5) \
        or (m.migrated and score >= 65)
    mode = "hold" if high_potential else "flip"
    # Size scales with conviction, hard-capped.
    size = min(max_size_sol, base_size_sol * (1.0 + score / 120.0))
    return Plan("buy", mode=mode, size_sol=round(size, 4), score=score, reason="ok")


# ── 3) position management (the exit engine) ────────────────
@dataclass
class Position:
    mode: str                 # 'flip' | 'hold'
    entry_price: float        # SOL per token at entry
    tokens: float             # token amount currently held
    cost_sol: float           # SOL still to recover (initial buy cost)
    peak_price: float = 0.0   # highest price seen (for trailing); set to entry if 0
    recovered: bool = False   # have we sold enough to get our money back?
    rungs_hit: int = 0        # moonbag ladder rungs already taken
    age_minutes: float = 0.0


@dataclass
class ExitAction:
    kind: str                 # 'hold' | 'sell_fraction' | 'sell_all'
    fraction: float = 0.0     # for sell_fraction (0..1 of remaining tokens)
    reason: str = ""


class PositionManager:
    def __init__(self, *, flip_target_x: float = 1.8, flip_stop_x: float = 0.6,
                 flip_timeout_min: float = 30.0, hold_derisk_x: float = 2.0,
                 hold_stop_x: float = 0.5, trail_drop_pct: float = 55.0,
                 ladder: tuple[tuple[float, float], ...] = ((5.0, 0.34), (10.0, 0.5))) -> None:
        self.flip_target_x = flip_target_x
        self.flip_stop_x = flip_stop_x
        self.flip_timeout_min = flip_timeout_min
        self.hold_derisk_x = hold_derisk_x
        self.hold_stop_x = hold_stop_x
        self.trail_drop_pct = trail_drop_pct
        self.ladder = ladder

    def decide(self, p: Position, price: float) -> ExitAction:
        entry = p.entry_price
        if entry <= 0 or price <= 0:
            return ExitAction("hold", reason="no price")
        mult = price / entry

        if p.mode == "flip":
            if mult <= self.flip_stop_x:
                return ExitAction("sell_all", reason=f"stop loss ({mult:.2f}x)")
            if mult >= self.flip_target_x:
                return ExitAction("sell_all", reason=f"flip target hit ({mult:.2f}x)")
            if p.age_minutes >= self.flip_timeout_min:
                return ExitAction("sell_all", reason="timed out — no move")
            return ExitAction("hold", reason="waiting for target")

        # hold mode ---------------------------------------------------------
        if not p.recovered:
            if mult <= self.hold_stop_x:
                return ExitAction("sell_all", reason=f"stop loss before de-risk ({mult:.2f}x)")
            if mult >= self.hold_derisk_x:
                value = p.tokens * price
                frac = min(1.0, p.cost_sol / value) if value > 0 else 1.0
                return ExitAction("sell_fraction", fraction=round(frac, 6),
                                  reason="de-risk: recover initial, keep moonbag")
            return ExitAction("hold", reason="building toward de-risk")

        # moonbag (cost already recovered — this is house money) ------------
        peak = p.peak_price or entry
        if price <= peak * (1 - self.trail_drop_pct / 100.0):
            return ExitAction("sell_all", reason="trailing stop on moonbag")
        if p.rungs_hit < len(self.ladder):
            rung_x, rung_frac = self.ladder[p.rungs_hit]
            if mult >= rung_x:
                return ExitAction("sell_fraction", fraction=rung_frac,
                                  reason=f"ladder take-profit at {rung_x:.0f}x")
        return ExitAction("hold", reason="riding the moonbag")
