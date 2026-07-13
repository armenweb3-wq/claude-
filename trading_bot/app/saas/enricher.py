"""Token safety enrichment for the sniper.

Turns a pump.fun mint into a verified ``TokenSafety`` (+ a few metrics) so the
``SafetyScreen`` can APPROVE coins instead of rejecting everything. Primary
source: RugCheck (rugcheck.xyz) — it reports mint/freeze authority, LP
lock/burn, top-holder distribution and named risk flags, which map directly
onto the fields the screen gates on. No API key required for the public report.

SAFETY-CRITICAL, REJECT-ON-DOUBT. Every field defaults to the UNSAFE value and
is only set safe when the response POSITIVELY proves it. Any network error,
non-200, missing key or unparseable body returns an all-failing ``TokenSafety``
so the coin is rejected. Missing data must never look safe — a missed coin
costs nothing, a rug costs the position. Because unknown == unsafe, a wrong or
renamed field can only make the screen stricter (reject more), never looser.

Field shapes follow RugCheck's documented report; confirm against live
responses on first deploy (the whole point of the shadow phase).
"""
from __future__ import annotations

import logging

import requests

from .memestrategy import TokenSafety

log = logging.getLogger(__name__)

# Named risks (case-insensitive substring) that mean "you may not be able to
# sell" — any of them forces can_sell = False.
_HONEYPOT_HINTS = ("honeypot", "transfer fee", "cannot sell", "can't sell",
                   "non-transferable", "freeze")


def _num(x, default: float = 0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


class RugcheckEnricher:
    """Callable ``(mint, state) -> (TokenSafety, extra)`` for ``SniperProvider``."""

    def __init__(self, base_url: str = "https://api.rugcheck.xyz",
                 timeout: float = 6.0, sol_price_usd: float = 150.0,
                 min_lp_locked_pct: float = 90.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.sol_price_usd = sol_price_usd
        self.min_lp_locked_pct = min_lp_locked_pct

    def __call__(self, mint: str, state) -> tuple[TokenSafety, dict]:
        try:
            r = requests.get(f"{self.base_url}/v1/tokens/{mint}/report",
                             timeout=self.timeout,
                             headers={"accept": "application/json"})
            if r.status_code != 200:
                return TokenSafety(), {}
            data = r.json()
        except Exception:  # network / timeout / bad JSON -> unknown -> reject
            log.debug("rugcheck fetch failed for %s", mint, exc_info=True)
            return TokenSafety(), {}
        try:
            return self._parse(state, data)
        except Exception:  # any parse surprise -> reject, never approve
            log.debug("rugcheck parse failed for %s", mint, exc_info=True)
            return TokenSafety(), {}

    def _parse(self, state, d: dict) -> tuple[TokenSafety, dict]:
        token = d.get("token") or {}
        # Authorities: null == renounced/revoked. The key must be PRESENT and
        # explicitly None — a missing key is treated as "still active" (unsafe).
        mint_renounced = ("mintAuthority" in token) and token.get("mintAuthority") is None
        freeze_revoked = ("freezeAuthority" in token) and token.get("freezeAuthority") is None

        risks = [x for x in (d.get("risks") or []) if isinstance(x, dict)]
        risk_names = [str(x.get("name") or "").lower() for x in risks]
        can_sell = freeze_revoked and not any(
            hint in name for name in risk_names for hint in _HONEYPOT_HINTS)

        # LP lock/burn — need explicit evidence from at least one market.
        lp_pct = 0.0
        for m in (d.get("markets") or []):
            lp = (m or {}).get("lp") or {}
            lp_pct = max(lp_pct, _num(lp.get("lpLockedPct")))
        lp_locked = lp_pct >= self.min_lp_locked_pct

        # Holder concentration — exclude the AMM/LP pool (not a real "holder").
        creator = getattr(state, "creator", "") or ""
        top_pct = 0.0
        dev_pct = 0.0
        holders = d.get("topHolders") or []
        for h in holders:
            if not isinstance(h, dict):
                continue
            if h.get("liquidityPool") or h.get("isLp") or h.get("pool"):
                continue
            pct = _num(h.get("pct"))
            top_pct = max(top_pct, pct)
            if creator and h.get("address") == creator:
                dev_pct = max(dev_pct, pct)
        if not holders:            # no holder data -> cannot verify -> reject
            return TokenSafety(), {}

        # Rug score from risk SEVERITY rather than RugCheck's numeric score
        # (whose sign/scale differs across API versions — too risky to trust).
        score = 100.0
        for x in risks:
            lvl = str(x.get("level") or "").lower()
            if lvl in ("danger", "high"):
                score -= 50
            elif lvl in ("warn", "warning", "medium"):
                score -= 12
        score = max(0.0, score)

        liq_usd = _num(d.get("totalMarketLiquidity"))
        liquidity_sol = (liq_usd / self.sol_price_usd) if self.sol_price_usd > 0 else 0.0

        safety = TokenSafety(
            can_sell=can_sell, mint_renounced=mint_renounced,
            freeze_revoked=freeze_revoked, lp_locked_or_burned=lp_locked,
            top_holder_pct=top_pct or 100.0, dev_holder_pct=dev_pct,
            rug_score=score)
        return safety, {"liquidity_sol": liquidity_sol}


def make_enricher(settings):
    """Pick the enricher from config. Unknown/empty -> None (the SniperProvider
    then uses reject-by-default). Kept tiny so adding sources later is trivial."""
    name = (getattr(settings, "meme_enricher", "") or "").strip().lower()
    if name == "rugcheck":
        return RugcheckEnricher(sol_price_usd=getattr(settings, "sol_price_usd", 150.0))
    return None
