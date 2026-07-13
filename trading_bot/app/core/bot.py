"""Trading loop orchestrator.

Ties together: exchange data -> strategy signal -> risk sizing -> order
-> persistence + notification. Runs as a background asyncio task started
by the FastAPI app. Can be paused/resumed/stopped via the control API.
"""
from __future__ import annotations

import asyncio
import logging
import threading
import traceback
from html import escape as _esc
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
    positions: list = field(default_factory=list)
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
        self._refresh_task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        # Serialises exchange access between the slow strategy loop and the
        # fast display-refresh loop (the pybit HTTP client is not thread-safe).
        self._ex_lock = threading.Lock()

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
        self._refresh_task = asyncio.create_task(self._refresh_loop())

    async def stop(self) -> None:
        self._stop.set()
        self.state.running = False
        tasks = [t for t in (self._task, self._refresh_task) if t]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
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

    async def _refresh_loop(self) -> None:
        """Fast, read-only loop that keeps the dashboard's positions/equity in
        step with the exchange between (slow) strategy ticks. Without this the
        UI shows a snapshot up to a full strategy cycle old — e.g. a position
        already closed on the exchange still appears open."""
        while not self._stop.is_set():
            if not self.state.paused:
                try:
                    await asyncio.to_thread(self._refresh_state)
                except Exception as exc:  # never let a refresh blip kill the loop
                    log.warning("position refresh failed: %s", exc)
            try:
                await asyncio.wait_for(
                    self._stop.wait(), timeout=settings.position_refresh_seconds
                )
            except asyncio.TimeoutError:
                pass

    def _refresh_state(self) -> None:
        """Fast loop: refresh the dashboard snapshot AND trail stops up the TP
        ladder promptly (manage=True), so SL->TP1 happens within ~30s of TP2
        filling rather than waiting for the slow strategy cycle."""
        with self._ex_lock:
            equity = self.exchange.get_equity()
            _, open_positions, open_details = self._snapshot_positions(manage=True)
        self.state.equity = round(equity, 4)
        if self.state.start_equity <= 0 and equity > 0:
            self.state.start_equity = round(equity, 4)
        self.state.open_positions = open_positions
        self.state.positions = open_details

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
        self.notifier.send(f"⚠️ bot error [{_esc(str(source))}]: {_esc(str(exc))}")

    def _tick(self) -> None:
        self.state.last_run = datetime.now(timezone.utc).isoformat()
        self._roll_day()
        # Hold the exchange lock for the whole strategy cycle so the fast
        # refresh loop never hits the (non-thread-safe) client concurrently.
        with self._ex_lock:
            self._run_strategy()

    def _run_strategy(self) -> None:
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

        # Snapshot open positions up front (also runs break-even management).
        positions, open_positions, open_details = self._snapshot_positions(manage=True)
        # Regime flip: if the market now blocks a side, bank any still-open
        # position on that side that is currently in profit.
        if settings.close_on_regime_flip:
            open_positions -= self._close_blocked_in_profit(positions, market)
        self.state.open_positions = open_positions
        self.state.positions = open_details

        for symbol in self.symbols:
            # Each symbol is independent: a failure here is logged and skipped,
            # never aborts the whole cycle.
            try:
                df = self.exchange.get_klines(symbol, settings.timeframe, limit=251)
                df = df.iloc[:-1]  # act on the last CLOSED candle (no repaint)
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

    def _snapshot_positions(self, *, manage: bool) -> tuple[dict, int, list]:
        """Read open positions from the exchange and build the dashboard list.

        The caller MUST hold ``self._ex_lock``. With ``manage=True`` it also
        runs break-even stop management (strategy tick); the display-refresh
        loop calls it with ``manage=False`` to stay read-only.
        """
        positions: dict[str, object] = {}
        open_positions = 0
        open_details: list[dict] = []
        # Authoritative TP-fill counts: closing orders recorded per symbol
        # (used to trail the stop reliably even if price wicked the TP briefly).
        closed = []
        if manage:
            try:
                closed = self.exchange.closed_pnl(limit=100)
            except Exception:
                closed = []
        for symbol in self.symbols:
            try:
                pos = self.exchange.get_position(symbol)
                positions[symbol] = pos
                if pos.side is not None:
                    open_positions += 1
                    if manage:
                        ot = getattr(pos, "created_at", "") or ""
                        self._manage_breakeven(symbol, pos, closed=closed, opened_at=ot)
                    tps, sl, is_long = self._trade_levels(pos)
                    at_be = (sl >= pos.entry_price) if is_long else (0 < sl <= pos.entry_price)
                    # ROI on margin (leveraged) — matches the % exchanges show.
                    notional = pos.size * pos.entry_price
                    margin = (notional / pos.leverage) if pos.leverage else notional
                    pnl_pct = round(pos.unrealised_pnl / margin * 100, 2) if margin else 0.0
                    open_details.append({
                        "symbol": symbol,
                        "side": pos.side,
                        "size": pos.size,
                        "entry_price": pos.entry_price,
                        "unrealised_pnl": round(pos.unrealised_pnl, 4),
                        "pnl_pct": pnl_pct,
                        "leverage": pos.leverage,
                        "stop_loss": sl,
                        "take_profits": tps,
                        "breakeven": at_be,
                    })
            except Exception as exc:  # one bad symbol must not break the rest
                log.warning("position check failed for %s: %s", symbol, exc)
        return positions, open_positions, open_details

    def _close_blocked_in_profit(self, positions: dict, market) -> int:
        """Close in-profit positions whose side the market filter now blocks.
        Returns how many were closed."""
        closed = 0
        for symbol, pos in positions.items():
            if pos is None or pos.side is None:
                continue
            is_long = (pos.side or "").lower() in ("buy", "long")
            blocked = (is_long and not market.allow_long) or (not is_long and not market.allow_short)
            if blocked and pos.unrealised_pnl > 0:
                try:
                    self.exchange.close_position(symbol)
                    pos.side = None  # reflect locally so we don't re-trade it
                    closed += 1
                    self.notifier.send(
                        f"🔄 {symbol} closed in profit (+{pos.unrealised_pnl:.4f}) — "
                        f"{'long' if is_long else 'short'} blocked by market filter"
                    )
                    log.info("regime-flip close %s (+%.4f)", symbol, pos.unrealised_pnl)
                except Exception as exc:  # pragma: no cover - best effort
                    log.warning("regime-flip close failed for %s: %s", symbol, exc)
        return closed

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
        if not plan.safe:  # liquidation would be inside the stop — refuse the trade
            log.warning("[%s] skipped: unsafe plan (liquidation inside stop)", symbol)
            self.notifier.send(f"⏭️ {symbol} skipped: unsafe (liquidation inside stop)")
            return False

        # Broadcast the signal BEFORE execution (per spec).
        self.notifier.send(format_signal(symbol, signal, dry_run=not settings.is_live))

        result = self.exchange.open_position(
            symbol=symbol, side=side, qty=plan.qty, leverage=plan.leverage,
            stop_loss=signal.stop_loss, take_profits=signal.take_profits,
        )
        if not result.ok:
            log.info("[%s] skipped: %s", symbol, result.skipped_reason)
            self.notifier.send(f"⏭️ {symbol} skipped: {_esc(str(result.skipped_reason))}")
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
        if getattr(result, "warning", ""):
            self.notifier.send(f"⚠️ {symbol}: {_esc(str(result.warning))}. Check the position on Bybit.")
        return True

    def _trade_levels(self, pos):
        """Entry/TP/SL price levels for an open position, derived from the
        strategy's ladder so the dashboard and chart can draw them."""
        cfg = getattr(self.strategy, "cfg", None)
        ladder = getattr(cfg, "tp_ladder", None) or [(6.0, 0.30), (12.0, 0.40), (20.0, 0.30)]
        stop_pct = getattr(cfg, "stop_pct", 3.0)
        is_long = (pos.side or "").lower() in ("buy", "long")
        sign = 1.0 if is_long else -1.0
        entry = pos.entry_price
        tps = [round(entry * (1 + sign * p / 100), 6) for p, _ in ladder]
        sl = pos.stop_loss if pos.stop_loss else round(entry * (1 - sign * stop_pct / 100), 6)
        return tps, sl, is_long

    def _manage_breakeven(self, symbol, pos, closed=None, opened_at="") -> None:
        """Trail the stop up the TP ladder: TP1 hit -> stop to break-even,
        TP2 hit -> stop to TP1. The stop only ever moves forward, never looser.

        When ``closed`` (real closing fills) is given, TP hits are counted from
        fills whose price matches a TP level, and we do NOT market-close on the
        final TP (the reduce-only TP ladder closes it on the exchange). Without
        ``closed`` we fall back to the live price (and may close on final TP)."""
        if pos.entry_price <= 0:
            return
        from ..strategy import trailing
        is_long = (pos.side or "").lower() in ("buy", "long")
        cfg = getattr(self.strategy, "cfg", None)
        ladder = getattr(cfg, "tp_ladder", None) or [(6.0, 0.30), (12.0, 0.40), (20.0, 0.30)]
        tp_pcts = [p for p, _ in ladder]
        entry = pos.entry_price
        tps = trailing.ladder_prices(entry, is_long, tp_pcts)

        close_on_final = False
        if closed is not None:
            hit = trailing.tp_hits_from_fills(closed, symbol, opened_at, tps)
        else:
            try:
                price = self.exchange.last_price(symbol)
            except Exception:
                return
            hit = trailing.tp_hits_from_price(price, tps, is_long)
            close_on_final = True
        if hit <= 0:
            return
        if hit >= len(tps):
            if close_on_final:  # price genuinely reached the final TP
                try:
                    self.exchange.close_position(symbol)
                    pos.side = None
                    self.notifier.send(f"✅ {symbol} final take-profit hit — position closed")
                    log.info("final TP close for %s", symbol)
                except Exception as exc:
                    log.warning("final close failed for %s: %s", symbol, exc)
                return
            hit = len(tps) - 1  # fills path: trail only, exchange closes TP3
            if hit <= 0:
                return
        target = round(trailing.trail_target(entry, is_long, tps, hit), 6)
        label = "break-even" if hit == 1 else f"TP{hit - 1}"
        if not trailing.is_forward(target, pos.stop_loss or 0.0, is_long):
            return
        try:
            self.exchange.set_stop_loss(symbol, target)
            pos.stop_loss = target  # reflect immediately for display
            self.notifier.send(f"🛡️ {symbol} stop moved to {label} @ {target}")
            log.info("trailing stop %s -> %s (%s)", symbol, target, label)
        except Exception as exc:
            log.warning("stop update failed for %s: %s", symbol, exc)

    def _assess_market(self):
        """Read BTC and decide what the market allows (long/short)."""
        from ..strategy.market_filter import MarketBias, assess_market

        if not settings.btc_filter_enabled:
            return MarketBias("neutral", True, True, 0.0, "BTC filter off")
        try:
            df = self.exchange.get_klines(settings.btc_symbol, settings.timeframe, limit=251)
            df = df.iloc[:-1]  # drop the forming candle (no repaint)
            return assess_market(df, crash_pct=settings.btc_crash_pct)
        except Exception as exc:  # never let the filter break the cycle
            # Fail CLOSED: unknown regime → block new entries, don't trade blind.
            log.warning("BTC market filter unavailable: %s", exc)
            return MarketBias("neutral", False, False, 0.0, "BTC data unavailable — new trades paused")

    def _roll_day(self) -> None:
        today = datetime.now(timezone.utc).date().isoformat()
        if self.state.trade_day != today:
            self.state.trade_day = today
            self.state.trades_today = 0
