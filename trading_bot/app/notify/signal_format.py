"""Format a trade signal for the Telegram signal broadcast.

Matches the required layout: Asset, Entry Price, Position Type (BUY/SELL),
Leverage, Stop Loss, TP1, TP2, TP3, Risk:Reward.
"""
from __future__ import annotations

from ..strategy.base import Signal

_POSITION = {"long": "BUY", "short": "SELL"}


def format_signal(symbol: str, sig: Signal, *, dry_run: bool = True) -> str:
    pos = _POSITION.get(sig.action, sig.action.upper())
    lines = [
        f"📡 <b>SIGNAL</b> {'(DRY-RUN)' if dry_run else ''}".strip(),
        f"<b>Asset:</b> {symbol}",
        f"<b>Position:</b> {pos}",
        f"<b>Entry:</b> {_fmt(sig.entry)}",
        f"<b>Leverage:</b> {sig.leverage:g}x",
        f"<b>Stop Loss:</b> {_fmt(sig.stop_loss)}",
    ]
    for i, tp in enumerate(sig.take_profits, start=1):
        lines.append(
            f"<b>TP{i}:</b> {_fmt(tp.price)}  (+{tp.pct:g}%, close {tp.close_fraction:.0%})"
        )
    if sig.risk_reward is not None:
        lines.append(f"<b>Risk:Reward:</b> {sig.risk_reward:g}")
    lines.append(f"<b>Confidence:</b> {sig.confidence:.0%}")
    return "\n".join(lines)


def _fmt(value: float | None) -> str:
    if value is None:
        return "—"
    if value >= 100:
        return f"{value:,.2f}"
    return f"{value:.6g}"
