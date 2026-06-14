"""Performance metrics for a backtest result."""
from __future__ import annotations

import math


def compute_metrics(result) -> dict:
    trades = [t for t in result.trades if t.exit_time is not None]
    n = len(trades)
    cfg = result.config
    start_eq = cfg.initial_equity
    end_eq = result.final_equity

    wins = [t for t in trades if t.realized_pnl > 0]
    losses = [t for t in trades if t.realized_pnl <= 0]
    gross_win = sum(t.realized_pnl for t in wins)
    gross_loss = -sum(t.realized_pnl for t in losses)

    win_rate = (len(wins) / n * 100) if n else 0.0
    profit_factor = (gross_win / gross_loss) if gross_loss > 0 else math.inf
    total_return = (end_eq / start_eq - 1) * 100 if start_eq else 0.0

    # Max drawdown from the equity curve.
    peak = -math.inf
    max_dd = 0.0
    for _, eq in result.equity_curve:
        peak = max(peak, eq)
        if peak > 0:
            max_dd = max(max_dd, (peak - eq) / peak * 100)

    return {
        "symbol": result.symbol,
        "timeframe": result.timeframe,
        "trades": n,
        "win_rate_pct": round(win_rate, 2),
        "profit_factor": round(profit_factor, 2) if profit_factor != math.inf else None,
        "total_return_pct": round(total_return, 2),
        "final_equity": end_eq,
        "max_drawdown_pct": round(max_dd, 2),
        "avg_win": round(gross_win / len(wins), 2) if wins else 0.0,
        "avg_loss": round(-gross_loss / len(losses), 2) if losses else 0.0,
        "total_fees": round(sum(t.fees for t in trades), 2),
        "tp_hits": sum(t.tp_hits for t in trades),
    }
