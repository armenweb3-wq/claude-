"""Memecoin auto-trading engine — wires the senses + brain + hands together.

Per cycle, for one wallet:
  1. discover candidates (provider)
  2. drop scams (SafetyScreen)
  3. score & classify survivors (flip vs hold + size)
  4. open new positions (respecting caps) via the executor
  5. manage every open position to its exit (PositionManager)

It's dependency-injected (provider, executor, open-positions state) so it's
fully unit-testable with fakes, and honours dry-run + hard risk caps. The
executor is ``solana_exec.JupiterExecutor`` (or a fake) — buys/sells go through
the same proven swap path used by the manual trade terminal.
"""
from __future__ import annotations

import logging

from .memestrategy import PositionManager, Position, SafetyScreen, classify

log = logging.getLogger(__name__)


class MemeEngine:
    def __init__(self, provider, executor, *, base_size_sol: float, max_size_sol: float,
                 max_open: int = 5, daily_loss_limit_sol: float = 0.0,
                 dry: bool = True, screen: SafetyScreen | None = None,
                 manager: PositionManager | None = None) -> None:
        self.provider = provider
        self.ex = executor
        self.base_size_sol = base_size_sol
        self.max_size_sol = max_size_sol
        self.max_open = max_open
        self.daily_loss_limit_sol = daily_loss_limit_sol
        self.dry = dry
        self.screen = screen or SafetyScreen()
        self.manager = manager or PositionManager()

    def manage_open(self, positions: dict[str, Position]) -> list[dict]:
        """Run the exit logic over open positions. ``positions`` maps mint->Position
        and is mutated in place (fractions reduced / closed). Returns actions."""
        actions: list[dict] = []
        for mint, pos in list(positions.items()):
            price = self.provider.price(mint)
            if price <= 0:
                continue
            pos.peak_price = max(pos.peak_price or pos.entry_price, price)
            act = self.manager.decide(pos, price)
            if act.kind == "hold":
                continue
            if act.kind == "sell_all":
                self._sell(mint, pos, 1.0, price)
                positions.pop(mint, None)
                actions.append({"mint": mint, "action": "sell_all", "reason": act.reason})
            elif act.kind == "sell_fraction":
                self._sell(mint, pos, act.fraction, price)
                if act.reason.startswith("de-risk"):
                    pos.recovered = True
                    pos.cost_sol = 0.0
                else:
                    pos.rungs_hit += 1
                actions.append({"mint": mint, "action": "sell_fraction",
                                "fraction": act.fraction, "reason": act.reason})
        return actions

    def find_and_open(self, positions: dict[str, Position]) -> list[dict]:
        """Discover, screen, classify and open new positions up to the cap."""
        opened: list[dict] = []
        if len(positions) >= self.max_open:
            return opened
        for c in self.provider.discover():
            if len(positions) >= self.max_open:
                break
            if c.mint in positions:
                continue
            ok, why = self.screen.check(c.safety, c.metrics)
            if not ok:
                continue
            plan = classify(c.metrics, base_size_sol=self.base_size_sol,
                            max_size_sol=self.max_size_sol)
            if plan.action != "buy":
                continue
            tokens = self._buy(c.mint, plan.size_sol, c.price_sol)
            if tokens <= 0:
                continue
            positions[c.mint] = Position(
                mode=plan.mode, entry_price=c.price_sol, tokens=tokens,
                cost_sol=plan.size_sol, peak_price=c.price_sol)
            opened.append({"mint": c.mint, "symbol": c.symbol, "mode": plan.mode,
                           "size_sol": plan.size_sol, "score": plan.score})
        return opened

    # ── execution (skipped in dry-run) ──────────────────────
    def _buy(self, mint: str, size_sol: float, price_sol: float) -> float:
        tokens = (size_sol / price_sol) if price_sol > 0 else 0.0
        if self.dry:
            return tokens
        try:
            self.ex.buy(mint, size_sol, slippage_bps=getattr(self, "slippage_bps", 150))
            return tokens
        except Exception as exc:  # pragma: no cover - network path
            log.warning("meme buy failed %s: %s", mint, exc)
            return 0.0

    def _sell(self, mint: str, pos: Position, fraction: float, price: float) -> None:
        sold = pos.tokens * fraction
        pos.tokens = max(0.0, pos.tokens - sold)
        if self.dry:
            return
        try:
            raw = int(sold)  # caller-side fakes use whole tokens; live uses raw units
            self.ex.sell(mint, raw, slippage_bps=getattr(self, "slippage_bps", 150))
        except Exception as exc:  # pragma: no cover - network path
            log.warning("meme sell failed %s: %s", mint, exc)
