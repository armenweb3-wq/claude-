"""Run the strategy suite over a dataset and print + plot the comparison.

Usage:
    python run_backtest.py                 # synthetic regime-switching data
    python run_backtest.py --csv FILE.csv  # any OHLC CSV (real data)
    python run_backtest.py --csv btc_recent.csv --periods 365
"""

from __future__ import annotations

import argparse

import pandas as pd

import data as datamod
from engine import metrics_table, run_backtest
from plotting import plot_equity
from strategies import default_suite

pd.set_option("display.float_format", lambda v: f"{v:,.4f}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="OHLC CSV to backtest (default: synthetic data)")
    ap.add_argument("--market", choices=["index", "equity"], default="index",
                    help="synthetic market type (index = calmer, upward-drifting)")
    ap.add_argument("--seed", type=int, default=2,
                    help="random market to draw (try different values!)")
    ap.add_argument("--days", type=int, default=3650, help="synthetic series length")
    ap.add_argument("--periods", type=int, default=365, help="periods/year for annualizing")
    ap.add_argument("--title", default=None)
    ap.add_argument("--out", default="equity.png")
    args = ap.parse_args()

    if args.csv:
        df = datamod.load_csv(args.csv)
        source = args.csv
    elif args.market == "index":
        df = datamod.index_market(days=args.days, seed=args.seed)
        source = f"synthetic index (seed {args.seed}, {args.days} bars)"
    else:
        df = datamod.synthetic(days=args.days, seed=args.seed)
        source = f"synthetic equity (seed {args.seed}, {args.days} bars)"

    title = args.title or f"Strategy comparison — {source}"
    results = [run_backtest(df, s) for s in default_suite()]

    table = metrics_table(results, periods_per_year=args.periods)
    pct = ["Total Return", "CAGR", "Max Drawdown", "Volatility", "Win Rate"]
    shown = table.copy()
    for c in pct:
        shown[c] = (shown[c] * 100).map(lambda v: f"{v:,.1f}%")
    shown["Sharpe"] = shown["Sharpe"].map(lambda v: f"{v:,.2f}")
    shown["Final Equity"] = shown["Final Equity"].map(lambda v: f"${v:,.0f}")

    print(f"\nData: {source}")
    print(f"Bars: {len(df)}  |  {df.index[0].date()} -> {df.index[-1].date()}\n")
    print(shown.to_string())

    out = plot_equity(results, title, args.out)
    print(f"\nChart written to {out}")


if __name__ == "__main__":
    main()
