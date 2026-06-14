"""Backtest CLI.

Examples
--------
# Demo on reproducible synthetic data (no network needed):
    python -m app.backtest.run --synthetic

# Real data from Bybit (needs network egress to api.bybit.com):
    python -m app.backtest.run --source bybit --start 2023-01-01 \
        --symbols BTCUSDT ETHUSDT --timeframes 1h 4h

# Offline from CSV files named <SYMBOL>_<TF>.csv in a directory:
    python -m app.backtest.run --source csv --csv-dir ./data \
        --symbols BTCUSDT --timeframes 1h
"""
from __future__ import annotations

import argparse
import json
import os

from .data import fetch_bybit, load_csv, synthetic_ohlcv
from .engine import BacktestConfig, Backtester
from .metrics import compute_metrics

DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT"]
DEFAULT_TFS = ["1h", "4h"]


def _load(args, symbol, tf):
    if args.synthetic or args.source == "synthetic":
        return synthetic_ohlcv(periods=args.periods, freq=tf)
    if args.source == "csv":
        return load_csv(os.path.join(args.csv_dir, f"{symbol}_{tf}.csv"))
    return fetch_bybit(symbol, tf, start=args.start, end=args.end)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="crypto-trading-bot backtester")
    p.add_argument("--source", choices=["synthetic", "bybit", "csv"], default="synthetic")
    p.add_argument("--synthetic", action="store_true", help="alias for --source synthetic")
    p.add_argument("--symbols", nargs="+", default=DEFAULT_SYMBOLS)
    p.add_argument("--timeframes", nargs="+", default=DEFAULT_TFS)
    p.add_argument("--start", default="2023-01-01")
    p.add_argument("--end", default=None)
    p.add_argument("--csv-dir", default="./data")
    p.add_argument("--periods", type=int, default=3000, help="synthetic bar count")
    p.add_argument("--equity", type=float, default=10_000.0)
    p.add_argument("--risk", type=float, default=5.0)
    p.add_argument("--leverage-cap", type=float, default=10.0)
    p.add_argument("--json-out", default=None, help="write full report to this path")
    args = p.parse_args(argv)

    cfg = BacktestConfig(
        initial_equity=args.equity, risk_pct=args.risk, leverage_cap=args.leverage_cap
    )
    bt = Backtester(config=cfg)

    reports = []
    for symbol in args.symbols:
        for tf in args.timeframes:
            try:
                df = _load(args, symbol, tf)
            except Exception as exc:
                print(f"!! {symbol} {tf}: data load failed: {exc}")
                continue
            if df is None or len(df) <= cfg.warmup + 5:
                print(f"!! {symbol} {tf}: not enough data ({0 if df is None else len(df)} bars)")
                continue
            result = bt.run(df, symbol, tf)
            m = compute_metrics(result)
            reports.append(m)
            print(
                f"{symbol:9s} {tf:3s} | trades {m['trades']:4d} | "
                f"win {m['win_rate_pct']:5.1f}% | PF {m['profit_factor']} | "
                f"ret {m['total_return_pct']:7.2f}% | maxDD {m['max_drawdown_pct']:5.1f}%"
            )

    if reports:
        agg_trades = sum(r["trades"] for r in reports)
        avg_win = sum(r["win_rate_pct"] for r in reports) / len(reports)
        print("-" * 72)
        print(f"TOTAL    | configs {len(reports)} | trades {agg_trades} | "
              f"avg win-rate {avg_win:.1f}%")

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(reports, f, indent=2)
        print(f"\nReport written to {args.json_out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
