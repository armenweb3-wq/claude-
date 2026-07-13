"""Shadow-mode pump.fun sniper — the real-time "senses" for the memecoin brain.

Three parts, all synchronous and fully testable (the async websocket shell
lives in ``sniper_worker.py``, which runs as a SEPARATE Render background
worker — sniping is event-driven and must never share the web app's loop):

- ``PumpFeed``      — tolerant parser for PumpPortal events: registers new
                      mints, tracks per-mint price/flow, counts buys from the
                      operator-curated smart-money wallet list.
- ``SniperProvider``— turns feed state into ``Candidate``s for the existing
                      ``MemeEngine``. REJECT-BY-DEFAULT: without an enricher
                      supplying verified safety data (RugCheck/Helius), every
                      token carries all-failing ``TokenSafety`` and the screen
                      refuses it. Missing data must never look safe.
- ``SniperService`` — one engine cycle over ONE global virtual portfolio
                      (paper decisions are identical for every user, so
                      per-user rows would add volume, not information); every
                      decision lands in the durable ``sniper_paper`` ledger and
                      open positions survive restarts via the ``meta`` table.

No live-trading path exists in this module at all. The point of this phase is
weeks of paper evidence — hit rate, EV after the safety screen — before a
single lamport moves.
"""
from __future__ import annotations

import dataclasses
import json
import logging
import time
from dataclasses import dataclass, field

from ..config import settings
from .memeengine import MemeEngine
from .memeproviders import Candidate, MemeDataProvider
from .memestrategy import Position, SafetyScreen, TokenMetrics, TokenSafety

log = logging.getLogger(__name__)

_POSITIONS_KEY = "sniper_positions"
_STATS_KEY = "sniper_stats"
_PNL_KEY = "sniper_pnl"
_STALE_POSITION_MIN = 24 * 60   # drop a paper position with no exit after 24h


@dataclass
class MintState:
    symbol: str = ""
    creator: str = ""
    first_seen: float = 0.0      # time.time() when the create event arrived
    last_price: float = 0.0      # SOL per token (from bonding-curve reserves)
    liquidity_sol: float = 0.0   # SOL in the bonding curve (vSolInBondingCurve)
    buys: int = 0
    sells: int = 0
    vol_sol: float = 0.0
    smart_buys: int = 0          # buys from tracked (curated) wallets


def _f(x) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


class PumpFeed:
    """In-memory state built from PumpPortal websocket events.

    Field names follow PumpPortal's documented payloads (mint, txType,
    traderPublicKey, solAmount, tokenAmount, symbol); parsing is defensive —
    a malformed event is dropped, never raises. Confirm live shapes on deploy.
    """

    def __init__(self, tracked_wallets: tuple[str, ...] | list[str] = (),
                 max_mints: int = 1000) -> None:
        self.tracked = set(tracked_wallets)
        self.max_mints = max_mints
        self.mints: dict[str, MintState] = {}
        self.seen_total = 0

    @staticmethod
    def _apply_price(st: MintState, event: dict) -> None:
        """Set price from the bonding-curve reserves that pump.fun puts on EVERY
        event (create and trades) — vSolInBondingCurve / vTokensInBondingCurve.
        Falls back to a single trade's solAmount/tokenAmount. This is why a coin
        gets a price the instant it's created, without needing a trade stream."""
        vsol = _f(event.get("vSolInBondingCurve"))
        vtok = _f(event.get("vTokensInBondingCurve"))
        if vsol > 0 and vtok > 0:
            st.last_price = vsol / vtok
            st.liquidity_sol = vsol
            return
        sol = _f(event.get("solAmount"))
        tok = _f(event.get("tokenAmount"))
        if sol > 0 and tok > 0:
            st.last_price = sol / tok

    def handle(self, event: dict) -> None:
        try:
            mint = event.get("mint")
            if not mint or not isinstance(mint, str):
                return
            tx = (event.get("txType") or "").lower()
            if tx == "create":
                if mint not in self.mints:
                    self.seen_total += 1
                    self.mints[mint] = MintState(
                        symbol=str(event.get("symbol") or "")[:16],
                        creator=str(event.get("traderPublicKey") or ""),
                        first_seen=time.time())
                self._apply_price(self.mints[mint], event)
                self._cap()
                return
            st = self.mints.get(mint)
            if st is None or tx not in ("buy", "sell"):
                return
            self._apply_price(st, event)
            sol = _f(event.get("solAmount"))
            if sol > 0:
                st.vol_sol += sol
            if tx == "buy":
                st.buys += 1
                if event.get("traderPublicKey") in self.tracked:
                    st.smart_buys += 1
            else:
                st.sells += 1
        except Exception:  # a bad event must never kill the stream
            log.debug("unparseable event dropped", exc_info=True)

    def prune(self, older_than_s: float = 1800) -> None:
        """Forget mints with no entry signal after `older_than_s` (memory cap)."""
        cutoff = time.time() - older_than_s
        for mint in [m for m, s in self.mints.items() if s.first_seen < cutoff]:
            self.mints.pop(mint, None)

    def _cap(self) -> None:
        if len(self.mints) <= self.max_mints:
            return
        for mint in sorted(self.mints, key=lambda m: self.mints[m].first_seen)[
                :len(self.mints) - self.max_mints]:
            self.mints.pop(mint, None)


def no_enrichment(mint: str, state: MintState) -> tuple[TokenSafety, dict]:
    """Default enricher: NO verified safety data -> all-failing TokenSafety, so
    the screen rejects. Wire a RugCheck/Helius enricher to let tokens through."""
    return TokenSafety(), {}


class SniperProvider(MemeDataProvider):
    def __init__(self, feed: PumpFeed, enricher=None, min_age_s: float = 30.0,
                 enrich_ttl_s: float = 300.0) -> None:
        self.feed = feed
        self.enricher = enricher or no_enrichment
        self.min_age_s = min_age_s
        self.enrich_ttl_s = enrich_ttl_s
        # Cache enrichment per mint — safety data barely changes, and without
        # this the same coins are re-fetched every ~10s cycle, hammering the
        # data API (429s) and, since the call is blocking, stalling the worker.
        self._cache: dict[str, tuple[float, TokenSafety, dict]] = {}
        self.last_batch = 0   # candidates produced on the latest discover()

    def _enrich(self, mint: str, st) -> tuple[TokenSafety, dict]:
        now = time.time()
        hit = self._cache.get(mint)
        if hit and (now - hit[0]) < self.enrich_ttl_s:
            return hit[1], hit[2]
        try:
            safety, extra = self.enricher(mint, st)
        except Exception:                     # enrichment failure = unknown = reject
            safety, extra = TokenSafety(), {}
        self._cache[mint] = (now, safety, extra or {})
        if len(self._cache) > 4000:           # bound memory; drop oldest half
            for m in sorted(self._cache, key=lambda k: self._cache[k][0])[:2000]:
                self._cache.pop(m, None)
        return safety, extra

    def discover(self, limit: int = 20) -> list[Candidate]:
        now = time.time()
        out: list[Candidate] = []
        for mint, st in sorted(self.feed.mints.items(),
                               key=lambda kv: -kv[1].first_seen):
            if len(out) >= limit:
                break
            if st.last_price <= 0:
                continue                      # no trades yet -> no price -> skip
            if (now - st.first_seen) < self.min_age_s:
                continue                      # let a few trades accrue first
            safety, extra = self._enrich(mint, st)
            kw = dict(age_minutes=(now - st.first_seen) / 60.0,
                      liquidity_sol=st.liquidity_sol,
                      volume_5m_sol=st.vol_sol, buys_5m=st.buys, sells_5m=st.sells,
                      smart_money_buys=st.smart_buys)
            kw.update(extra or {})
            out.append(Candidate(mint, st.symbol, safety, TokenMetrics(**kw),
                                 price_sol=st.last_price))
        self.last_batch = len(out)
        return out

    def price(self, mint: str) -> float:
        st = self.feed.mints.get(mint)
        return st.last_price if st else 0.0


class SniperService:
    """One shadow-portfolio cycle: discover -> screen -> paper-open -> manage
    exits, with every decision persisted and positions restart-safe."""

    def __init__(self, store, provider: SniperProvider, engine: MemeEngine | None = None) -> None:
        self.store = store
        self.provider = provider
        self.engine = engine or MemeEngine(
            provider, None,  # no executor — dry mode never places orders
            base_size_sol=settings.meme_base_size_sol,
            max_size_sol=settings.meme_max_sol_per_trade,
            max_open=settings.meme_max_open, dry=True,
            min_score=settings.meme_min_score,
            # New pump.fun mints are inherently concentrated — relax the holder
            # gate (config) while keeping the rug-vector gates strict.
            screen=SafetyScreen(max_top_holder_pct=settings.meme_max_top_holder_pct))
        assert self.engine.dry, "sniper runs SHADOW MODE only — engine must be dry"
        # Observe every screening decision so the operator can see which coins
        # were checked and why each failed/passed. Buys are already logged as
        # "open"; here we persist the REJECTs (deduped per mint, in-memory).
        self.engine.on_check = self._record_check
        self._checked: set[str] = set()   # distinct mints screened this run
        self.positions: dict[str, Position] = {}
        self.opened_at: dict[str, float] = {}
        self.pnl = self._load_pnl()       # cumulative paper scoreboard
        self._load_positions()

    # ── paper scoreboard (realized, survives restarts) ──────
    def _load_pnl(self) -> dict:
        try:
            d = json.loads(self.store.get_meta(_PNL_KEY) or "{}")
        except Exception:
            d = {}
        return {"realized_sol": float(d.get("realized_sol", 0.0)),
                "wins": int(d.get("wins", 0)), "losses": int(d.get("losses", 0)),
                "closed": int(d.get("closed", 0))}

    def _record_close(self, realized_sol: float) -> None:
        self.pnl["realized_sol"] = round(self.pnl["realized_sol"] + realized_sol, 6)
        self.pnl["closed"] += 1
        if realized_sol > 0:
            self.pnl["wins"] += 1
        elif realized_sol < 0:
            self.pnl["losses"] += 1
        try:
            self.store.set_meta(_PNL_KEY, json.dumps(self.pnl))
        except Exception:  # scoreboard is best-effort
            pass

    def _record_check(self, candidate, decision: str, reason: str) -> None:
        mint = getattr(candidate, "mint", "")
        if not mint or mint in self._checked:
            return                        # one row per coin, not one per cycle
        self._checked.add(mint)
        if decision == "reject":          # buys are persisted as "open" already
            try:
                self.store.add_sniper_event(
                    mint, "reject", symbol=getattr(candidate, "symbol", ""),
                    price_sol=getattr(candidate, "price_sol", 0.0), reason=reason)
            except Exception:             # logging must never break a cycle
                log.debug("reject log failed", exc_info=True)

    # ── persistence (survives worker restarts) ──────────────
    def _load_positions(self) -> None:
        try:
            raw = json.loads(self.store.get_meta(_POSITIONS_KEY) or "{}")
        except Exception:
            raw = {}
        for mint, d in raw.items():
            opened = float(d.pop("opened_at", time.time()))
            try:
                self.positions[mint] = Position(**d)
                self.opened_at[mint] = opened
            except TypeError:   # schema drift — drop rather than crash
                log.warning("dropping unreadable persisted position %s", mint)

    def _save_positions(self) -> None:
        raw = {}
        for mint, pos in self.positions.items():
            d = dataclasses.asdict(pos)
            d["opened_at"] = self.opened_at.get(mint, time.time())
            raw[mint] = d
        self.store.set_meta(_POSITIONS_KEY, json.dumps(raw))

    # ── one cycle ───────────────────────────────────────────
    def cycle(self) -> dict:
        now = time.time()
        # Keep ages current — the flip timeout depends on them.
        for mint, pos in self.positions.items():
            pos.age_minutes = (now - self.opened_at.get(mint, now)) / 60.0

        opened = self.engine.find_and_open(self.positions)
        for o in opened:
            self.opened_at[o["mint"]] = now
            self.store.add_sniper_event(
                o["mint"], "open", symbol=o.get("symbol", ""), mode=o.get("mode", ""),
                size_sol=o.get("size_sol", 0.0),
                price_sol=self.positions[o["mint"]].entry_price,
                score=o.get("score", 0.0), reason="paper open")

        actions = self.engine.manage_open(self.positions)
        for a in actions:
            self.store.add_sniper_event(
                a["mint"], a["action"], fraction=a.get("fraction", 0.0),
                price_sol=self.provider.price(a["mint"]), reason=a.get("reason", ""),
                size_sol=a.get("realized_sol", 0.0))
            if a["action"] == "sell_all":
                self._record_close(a.get("realized_sol", 0.0))
                self.opened_at.pop(a["mint"], None)

        # Zombie sweep: a paper position whose feed died can never exit via
        # price — close it out so the portfolio can't silt up. Whatever it had
        # already realized (via de-risk sells) counts; the rest is a loss.
        for mint, pos in list(self.positions.items()):
            if pos.age_minutes >= _STALE_POSITION_MIN:
                realized = pos.proceeds_sol - pos.init_cost_sol
                self.store.add_sniper_event(
                    mint, "sell_all", price_sol=self.provider.price(mint),
                    size_sol=realized, reason="stale — no price feed for 24h")
                self._record_close(realized)
                self.positions.pop(mint, None)
                self.opened_at.pop(mint, None)

        # Keep the reject ledger bounded — with no enricher every coin fails the
        # same way, so old rows add volume, not insight.
        try:
            self.store.prune_sniper_rejects(keep=500)
        except Exception:  # best-effort housekeeping
            pass

        priced = sum(1 for st in self.provider.feed.mints.values() if st.last_price > 0)
        self._save_positions()
        stats = {"ts": now, "mints_tracked": len(self.provider.feed.mints),
                 "mints_seen_total": self.provider.feed.seen_total,
                 "priced_now": priced,          # mints with a live price (trades flowing)
                 "last_candidates": self.provider.last_batch,
                 "checked_total": len(self._checked),
                 "open_positions": len(self.positions),
                 "opened_now": len(opened), "exits_now": len(actions),
                 "pnl": self.pnl}
        try:
            self.store.set_meta(_STATS_KEY, json.dumps(stats))
        except Exception:  # stats are best-effort
            pass
        return stats
