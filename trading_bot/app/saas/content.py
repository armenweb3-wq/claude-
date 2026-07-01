"""Rotating channel content — educational tips the bot auto-posts so the channel
stays active without manual work. Add/edit freely."""
from __future__ import annotations

TIPS = [
    "💡 <b>Why we ladder take-profits</b>\nZENITH banks 30% at +6%, 40% at +12%, 30% at +20% — and moves the stop to break-even after TP1. Winners run, losers stay tiny.",
    "🛡️ <b>Risk first</b>\nEvery trade has a stop on the exchange the moment it opens. The bot never holds an unprotected position.",
    "📈 <b>The trend filter</b>\nWhen BTC is dumping we pause longs; when it's pumping we pause shorts. Alts follow BTC — we don't fight it.",
    "🤖 <b>Hands-off by design</b>\nNo screens, no emotions. The bot scans the market around the clock and only acts on high-confidence setups.",
    "🎯 <b>Quality over quantity</b>\nMost of the time the right move is to do nothing. The bot waits for the setup instead of forcing trades.",
    "🔒 <b>Your funds stay yours</b>\nZENITH trades on your own exchange account with a key that can't withdraw. You keep full custody, always.",
    "📊 <b>Small losses, bigger wins</b>\nWith a ~4:1 reward-to-risk ladder, you don't need to win often — you need winners to run. The math does the work.",
    "⚖️ <b>Position sizing</b>\nEach trade risks a fixed small % of your balance, so no single trade can blow up the account.",
]


def daily_tip(now) -> str:
    return TIPS[now.timetuple().tm_yday % len(TIPS)]
