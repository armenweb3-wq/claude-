"""Trading loop orchestrator.

Ties together: exchange data -> strategy signal -> risk sizing -> order
-> persistence + notification. Runs as a background asyncio task started
by the FastAPI app. Can be paused/resumed/stopped via the control API.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from ..config import settings
from ..exchange import get_exchange
from ..exchange.base import Order
from ..notify import get_notifier
from ..risk import RiskManager
from ..storage import get_storage
from ..strategy import get_strategy

log = logging.getLogger(__name__)


@dataclass
class BotState:
    running: bool = False
    paused: bool = False
    mode: str = "dry_run"
    strategy: str = "sma_crossover"
    last_run: str | None = None
    last_signals: dict[str, str] = field(default_factory=dict)
    error: str | None = None


class TradingBot:
    def __init__(self, strategy_name: str = "sma_crossover") -> None:
        self.exchange = get_exchange()
        self.strategy = get_strategy(strategy_name)
        self.risk = RiskManager()
        self.storage = get_storage()
        self.notifier = get_notifier()
        self.state = BotState(mode=settings.trading_mode, strategy=strategy_name)
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    # ── lifecycle ───────────────────────────────────────────
    async def start(self) -> None:
        if self.state.running:
            return
        self._stop.clear()
        self.state.running = True
        self.notifier.send(
            f"🤖 crypto-trading-bot starting — {settings.safety_summary()}\n"
            f"Strategy: {self.strategy.name} | Symbols: {', '.join(settings.symbols)}"
        )
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop.set()
        self.state.running = False
        if self._task:
            await asyncio.gather(self._task, return_exceptions=True)
        self.notifier.send("🛑 crypto-trading-bot stopped.")

    def pause(self) -> None:
        self.state.paused = True

    def resume(self) -> None:
        self.state.paused = False

    # ── main loop ───────────────────────────────────────────
    async def _run_loop(self) -> None:
        while not self._stop.is_set():
            if not self.state.paused:
                try:
                    await asyncio.to_thread(self._tick)
                    self.state.error = None
                except Exception as exc:  # pragma: no cover - defensive
                    self.state.error = str(exc)
                    log.exception("tick failed")
                    self.notifier.send(f"⚠️ bot error: {exc}")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=settings.loop_interval_seconds)
            except asyncio.TimeoutError:
                pass

    def _tick(self) -> None:
        self.state.last_run = datetime.now(timezone.utc).isoformat()
        equity = self.exchange.get_equity()
        self.risk.register_equity(equity)
        self.storage.record_equity(equity)
        open_positions = sum(
            1 for s in settings.symbols if self.exchange.get_position(s).side is not None
        )

        for symbol in settings.symbols:
            df = self.exchange.get_klines(symbol, settings.timeframe, limit=200)
            signal = self.strategy.generate(df)
            self.state.last_signals[symbol] = f"{signal.action}: {signal.reason}"
            price = float(df["close"].iloc[-1]) if not df.empty else 0.0
            self.storage.record_signal(
                symbol=symbol, action=signal.action, reason=signal.reason, price=price
            )

            position = self.exchange.get_position(symbol)

            if signal.action in {"close", "hold"}:
                if signal.action == "close" and position.side:
                    self._close(symbol, signal.reason)
                continue

            # Reverse if an opposite position is open.
            desired_side = "Buy" if signal.action == "long" else "Sell"
            if position.side and position.side != desired_side:
                self._close(symbol, "reverse signal")
                open_positions = max(0, open_positions - 1)
            elif position.side == desired_side:
                continue  # already in the right direction

            decision = self.risk.evaluate(
                side=signal.action, equity=equity, price=price, open_positions=open_positions
            )
            if not decision.allowed:
                log.info("[risk] %s skipped: %s", symbol, decision.reason)
                continue

            self._enter(symbol, desired_side, decision.qty, price, signal.reason)
            open_positions += 1

    # ── order helpers ───────────────────────────────────────
    def _enter(self, symbol: str, side: str, qty: float, price: float, reason: str) -> None:
        order = Order(symbol=symbol, side=side, qty=qty)
        order = self.exchange.place_order(order)
        self.storage.record_trade(
            symbol=symbol, side=side, qty=qty, price=price, order_id=order.order_id,
            mode=settings.trading_mode, strategy=self.strategy.name, reason=reason,
        )
        tag = "LIVE" if settings.is_live else "DRY-RUN"
        self.notifier.send(f"[{tag}] {side} {qty} {symbol} @ ~{price} ({reason})")

    def _close(self, symbol: str, reason: str) -> None:
        order = self.exchange.close_position(symbol)
        if order:
            self.storage.record_trade(
                symbol=symbol, side=order.side, qty=order.qty, price=None,
                order_id=order.order_id, mode=settings.trading_mode,
                strategy=self.strategy.name, reason=f"close: {reason}",
            )
            tag = "LIVE" if settings.is_live else "DRY-RUN"
            self.notifier.send(f"[{tag}] CLOSE {symbol} ({reason})")
