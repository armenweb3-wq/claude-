"""Find a *robust* profitable strategy — without fooling ourselves.

The cardinal sin of backtesting is tuning parameters until the curve looks
great on data you already saw ("overfitting"). This script refuses to do that:

1. Split history into TRAIN (older) and TEST (newer, untouched during tuning).
2. Grid-search parameters on TRAIN only, pick the best by TRAIN Sharpe.
3. Report how that choice does on TEST — the out-of-sample truth.
4. Walk-forward: repeat across rolling windows so it's not one lucky period.

A strategy is only "profitable" here if it stays profitable on data it was
never tuned on, AND beats Buy & Hold on risk-adjusted return.
"""

from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

import data as datamod
from engine import metrics, run_backtest
from plotting import plot_equity
from strategies import BuyAndHold, Grid, TrendDipBuyer, TrendFilter

PERIODS = 365


def score(df: pd.DataFrame, strat) -> dict:
    return metrics(run_backtest(df, strat), periods_per_year=PERIODS)


def search_trendfilter(train: pd.DataFrame) -> dict:
    """Grid-search the trend-filter SMA on TRAIN, ranked by Sharpe."""
    best = None
    for sma in (50, 100, 150, 200, 250):
        m = score(train, TrendFilter(sma=sma))
        if best is None or m["Sharpe"] > best["Sharpe"]:
            best = {"sma": sma, **m}
    return best


def search_grid(train: pd.DataFrame) -> dict:
    best = None
    for sell, buy, step in itertools.product(
        (0.03, 0.05, 0.08), (0.05, 0.10, 0.15), (0.2, 0.33)
    ):
        m = score(train, Grid(sell_pct=sell, buy_pct=buy, step=step))
        if best is None or m["Sharpe"] > best["Sharpe"]:
            best = {"sell": sell, "buy": buy, "step": step, **m}
    return best


def pct(x: float) -> str:
    return f"{x * 100:,.1f}%"


def main() -> None:
    # ~10 years of daily index-like data, with several bull/bear cycles
    df = datamod.index_market(days=3650, seed=7)
    split = int(len(df) * 0.6)
    train, test = df.iloc[:split], df.iloc[split:]
    print(f"Index-like data: {len(df)} bars "
          f"({df.index[0].date()} -> {df.index[-1].date()})")
    print(f"TRAIN: {len(train)} bars   TEST (out-of-sample): {len(test)} bars\n")

    # --- 1) tune ONLY on train ------------------------------------------------
    tf = search_trendfilter(train)
    gr = search_grid(train)
    print("Best params chosen on TRAIN (by Sharpe):")
    print(f"  Trend Filter : SMA={tf['sma']}  (train Sharpe {tf['Sharpe']:.2f})")
    print(f"  Grid         : +{pct(gr['sell'])}/-{pct(gr['buy'])} step {gr['step']}"
          f"  (train Sharpe {gr['Sharpe']:.2f})\n")

    chosen = {
        "Buy & Hold": BuyAndHold(),
        f"Trend Filter (SMA{tf['sma']})": TrendFilter(sma=tf["sma"]),
        "Grid (tuned)": Grid(sell_pct=gr["sell"], buy_pct=gr["buy"], step=gr["step"]),
        "Trend + Dip Buyer": TrendDipBuyer(sma=tf["sma"]),
    }

    # --- 2) judge on the untouched TEST set ----------------------------------
    rows = []
    for label, strat in chosen.items():
        m = score(test, strat)
        rows.append({
            "Strategy": label,
            "Total Return": pct(m["Total Return"]),
            "CAGR": pct(m["CAGR"]),
            "Sharpe": f"{m['Sharpe']:.2f}",
            "Max DD": pct(m["Max Drawdown"]),
            "Trades": m["Trades"],
        })
    table = pd.DataFrame(rows).set_index("Strategy")
    print("=== OUT-OF-SAMPLE results on TEST (never seen during tuning) ===\n")
    print(table.to_string())

    # chart on the test set
    results = [run_backtest(test, s) for s in chosen.values()]
    for r, label in zip(results, chosen.keys()):
        r.name = label
    plot_equity(results, "Out-of-sample (TEST) — tuned on TRAIN only", "oos_test.png")
    print("\nChart -> oos_test.png")

    # --- 3) walk-forward across rolling windows ------------------------------
    print("\n=== WALK-FORWARD: re-tune each window, trade the next, 8 folds ===\n")
    folds, wins = walk_forward(df, n_folds=8)
    wf = pd.DataFrame(folds)
    print(wf.to_string(index=False))
    print(f"\nTrend Filter beat Buy & Hold on Sharpe in {wins}/{len(folds)} "
          f"out-of-sample folds.")


def walk_forward(df: pd.DataFrame, n_folds: int = 8):
    n = len(df)
    fold = n // (n_folds + 1)  # expanding-ish: train window then next fold tested
    rows, wins = [], 0
    for k in range(1, n_folds + 1):
        train = df.iloc[: fold * k]
        test = df.iloc[fold * k: fold * (k + 1)]
        if len(test) < 30:
            continue
        tf = search_trendfilter(train)
        m_tf = score(test, TrendFilter(sma=tf["sma"]))
        m_bh = score(test, BuyAndHold())
        better = m_tf["Sharpe"] > m_bh["Sharpe"]
        wins += int(better)
        rows.append({
            "fold": k,
            "SMA": tf["sma"],
            "TF CAGR": pct(m_tf["CAGR"]),
            "TF Sharpe": f"{m_tf['Sharpe']:.2f}",
            "TF MaxDD": pct(m_tf["Max Drawdown"]),
            "B&H CAGR": pct(m_bh["CAGR"]),
            "B&H Sharpe": f"{m_bh['Sharpe']:.2f}",
            "TF wins?": "yes" if better else "no",
        })
    return rows, wins


if __name__ == "__main__":
    main()
