"""Trading loop orchestrator.

Ties together: exchange data -> strategy signal -> risk sizing -> order
-> persistence + notification. Runs as a background asyncio task started
by the FastAPI app. Can be paused/resumed/stopped via the control API.
"""
from __future__ import annotations

import asyncio
import logging
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timezone

from ..config import settings
from ..exchange import get_exchange
from ..notify import get_notifier
from ..notify.signal_format import format_signal
from ..risk import RiskManager
from ..risk.sizing import plan_position
from ..storage import get_storage
from ..strategy import get_strategy

log = logging.getLogger(__name__)


@dataclass
class BotState:
    running: bool = False
    paused: bool = False
    mode: str = "dry_run"
    strategy: str = "confluence"
    last_run: str | None = None
    last_signals: dict[str, str] = field(default_factory=dict)
    error: str | None = None
    trades_today: int = 0
    trade_day: str | None = None
    market: str | None = None
    equity: float = 0.0
    start_equity: float = 0.0
    open_positions: int = 0
    cycle: dict | None = None


class TradingBot:
    def __init__(self, strategy_name: str = "confluence") -> None:
        self.exchange = get_exchange()
        self.strategy = get_strategy(strategy_name)
        self.risk = RiskManager()
        self.storage = get_storage()
        self.notifier = get_notifier()
        self.state = BotState(mode=settings.trading_mode, strategy=strategy_name)
        self.symbols: list[str] = list(settings.symbols)
        self._cycle = None
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    def _validate_symbols(self) -> None:
        """Drop symbols Bybit doesn't list (e.g. wrong meme-coin names)."""
        try:
            available = self.exchange.available_symbols()
        except Exception as exc:  # pragma: no cover - network/best effort
            log.warning("symbol validation skipped: %s", exc)
            return
        if not available:
            return
        valid = [s for s in settings.symbols if s in available]
        dropped = [s for s in settings.symbols if s not in available]
        if dropped:
            log.warning("dropping invalid symbols: %s", dropped)
            self.notifier.send("⏭️ skipping invalid symbols: " + ", ".join(dropped))
        if valid:
            self.symbols = valid

    # ── lifecycle ───────────────────────────────────────────
    async def start(self) -> None:
        if self.state.running:
            return
        await asyncio.to_thread(self._validate_symbols)
        self._stop.clear()
        self.state.running = True
        self.notifier.send(
            f"🤖 crypto-trading-bot starting — {settings.safety_summary()}\n"
            f"Strategy: {self.strategy.name} | {len(self.symbols)} symbols"
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
                    self.handle_error("tick", exc)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=settings.loop_interval_seconds)
            except asyncio.TimeoutError:
                pass

    def handle_error(self, source: str, exc: Exception) -> None:
        """Record an error to state, logs, the database, and notifiers."""
        self.state.error = str(exc)
        log.exception("%s failed: %s", source, exc)
        try:
            self.storage.record_error(
                source=source, message=str(exc), traceback=traceback.format_exc()
            )
        except Exception:  # pragma: no cover - never let logging mask the error
            log.warning("failed to persist error to database")
        self.notifier.send(f"⚠️ bot error [{source}]: {exc}")

    def _tick(self) -> None:
        self.state.last_run = datetime.now(timezone.utc).isoformat()
        self._roll_day()

        equity = self.exchange.get_equity()
        self.risk.register_equity(equity)
        self.storage.record_equity(equity)
        self.state.equity = round(equity, 4)
        if self.state.start_equity <= 0 and equity > 0:
            self.state.start_equity = round(equity, 4)

        # Cycle-phase context (where we are in the BTC cycle).
        from ..strategy.cycle import assess_cycle
        self._cycle = assess_cycle()
        self.state.cycle = {
            "phase": self._cycle.phase,
            "months_since_halving": round(self._cycle.months_since_halving, 1),
            "months_to_next_halving": round(self._cycle.months_to_next_halving, 1),
            "note": self._cycle.note,
        }

        if equity <= 0:
            note = "no tradable balance — move USDT to your Unified Trading account"
            self.state.last_signals = {s: note for s in self.symbols}
            log.warning(note)
            return

        if self.risk.daily_drawdown_breached(equity):
            log.warning("daily drawdown breached — no new entries")
            return

        # BTC-led market filter: assessed once, applied to every symbol.
        market = self._assess_market()
        self.state.market = market.reason

        # Snapshot open positions up front (resilient to per-symbol errors).
        positions: dict[str, object] = {}
        open_positions = 0
        for symbol in self.symbols:
            try:
                pos = self.exchange.get_position(symbol)
                positions[symbol] = pos
                if pos.side is not None:
                    open_positions += 1
            except Exception as exc:  # one bad symbol must not break the rest
                log.warning("position check failed for %s: %s", symbol, exc)
        self.state.open_positions = open_positions

        for symbol in self.symbols:
            # Each symbol is independent: a failure here is logged and skipped,
            # never aborts the whole cycle.
            try:
                df = self.exchange.get_klines(symbol, settings.timeframe, limit=250)
                signal = self.strategy.generate(df)
                self.state.last_signals[symbol] = f"{signal.action}: {signal.reason}"
                price = float(df["close"].iloc[-1]) if not df.empty else 0.0
                self.storage.record_signal(
                    symbol=symbol, action=signal.action, reason=signal.reason, price=price
                )

                if signal.action not in {"long", "short"}:
                    continue  # exits are handled by exchange-side SL/TP orders

                # BTC market filter: don't long a falling market or short a
                # rising one, even if the alt's own signal looks good.
                if signal.action == "long" and not market.allow_long:
                    self.state.last_signals[symbol] = f"long blocked — {market.reason}"
                    continue
                if signal.action == "short" and not market.allow_short:
                    self.state.last_signals[symbol] = f"short blocked — {market.reason}"
                    continue

                # Gate: daily cap, max concurrent positions, already-in-position.
                if self.state.trades_today >= settings.max_trades_per_day:
                    log.info("daily trade cap reached (%s)", settings.max_trades_per_day)
                    break
                if open_positions >= settings.max_open_positions:
                    continue
                pos = positions.get(symbol)
                if pos is not None and pos.side is not None:
                    continue  # don't stack/reverse an existing position

                if self._open_from_signal(symbol, signal, equity):
                    open_positions += 1
                    self.state.trades_today += 1
            except Exception as exc:
                log.warning("symbol %s failed: %s", symbol, exc)
                self.state.last_signals[symbol] = f"error: {exc}"
                continue

    def _open_from_signal(self, symbol, signal, equity) -> bool:
        """Size, broadcast, and execute a single signal. Returns True if opened."""
        side = "Buy" if signal.action == "long" else "Sell"
        # Cycle phase tightens leverage in distribution/bear phases.
        cycle = getattr(self, "_cycle", None)
        cycle_factor = cycle.leverage_factor if cycle else 1.0
        lev_cap = min(settings.max_leverage, signal.leverage) * cycle_factor
        plan = plan_position(
            equity=equity, risk_pct=settings.risk_per_trade_pct,
            entry=signal.entry, stop=signal.stop_loss, side=signal.action,
            leverage_cap=max(1.0, lev_cap),
        )
        if plan.qty <= 0:
            log.info("[%s] sizing produced no quantity", symbol)
            return False

        # Broadcast the signal BEFORE execution (per spec).
        self.notifier.send(format_signal(symbol, signal, dry_run=not settings.is_live))

        result = self.exchange.open_position(
            symbol=symbol, side=side, qty=plan.qty, leverage=plan.leverage,
            stop_loss=signal.stop_loss, take_profits=signal.take_profits,
        )
        if not result.ok:
            log.info("[%s] skipped: %s", symbol, result.skipped_reason)
            self.notifier.send(f"⏭️ {symbol} skipped: {result.skipped_reason}")
            return False

        self.storage.record_trade(
            symbol=symbol, side=side, qty=result.qty, price=signal.entry,
            order_id=result.entry_order_id, mode=settings.trading_mode,
            strategy=self.strategy.name, reason=signal.reason,
        )
        tag = "LIVE" if settings.is_live else "DRY-RUN"
        self.notifier.send(
            f"[{tag}] OPEN {side} {result.qty} {symbol} @ ~{signal.entry} "
            f"lev {result.leverage:g}x SL {signal.stop_loss}"
        )
        return True

    def _assess_market(self):
        """Read BTC and decide what the market allows (long/short)."""
        from ..strategy.market_filter import MarketBias, assess_market

        if not settings.btc_filter_enabled:
            return MarketBias("neutral", True, True, 0.0, "BTC filter off")
        try:
            df = self.exchange.get_klines(settings.btc_symbol, settings.timeframe, limit=250)
            return assess_market(df, crash_pct=settings.btc_crash_pct)
        except Exception as exc:  # never let the filter break the cycle
            log.warning("BTC market filter unavailable: %s", exc)
            return MarketBias("neutral", True, True, 0.0, "BTC data unavailable")

    def _roll_day(self) -> None:
        today = datetime.now(timezone.utc).date().isoformat()
        if self.state.trade_day != today:
            self.state.trade_day = today
            self.state.trades_today = 0
