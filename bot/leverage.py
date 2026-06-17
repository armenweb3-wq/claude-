"""Show what leverage actually does — the upside AND the wipeout risk.

Runs the same strategies at 1x / 2x / 3x across MANY random index markets, so
you see the average outcome and the tail. Leverage is not free return: it
multiplies volatility, pays borrowing interest, and adds liquidation risk that
can take an account to zero. This script makes that trade-off explicit.

    python leverage.py
"""

from __future__ import annotations

import numpy as np
import pandas as pd

import data as datamod
from engine import metrics, run_backtest
from plotting import plot_equity
from strategies import BuyAndHold, TrendFilter

PERIODS = 365
LEVERAGES = [1.0, 2.0, 3.0]


def pct(x: float) -> str:
    return f"{x * 100:,.1f}%"


def main() -> None:
    # --- single illustrative market: equity curves at each leverage ----------
    df = datamod.index_market(days=3650, seed=7)
    results = []
    print(f"Single index market ({len(df)} bars, {df.index[0].date()} -> "
          f"{df.index[-1].date()}):\n")
    rows = []
    for lev in LEVERAGES:
        for strat, tag in ((BuyAndHold(), "Buy&Hold"), (TrendFilter(), "TrendFilter")):
            res = run_backtest(df, strat, leverage=lev, periods_per_year=PERIODS)
            res.name = f"{tag} {lev:g}x"
            results.append(res)
            m = metrics(res, PERIODS)
            rows.append({
                "Strategy": res.name,
                "CAGR": pct(m["CAGR"]),
                "Sharpe": f"{m['Sharpe']:.2f}",
                "Max DD": pct(m["Max Drawdown"]),
                "Liquidations": m["Liquidations"],
                "Final": f"${m['Final Equity']:,.0f}",
            })
    print(pd.DataFrame(rows).set_index("Strategy").to_string())

    plot_equity(
        [r for r in results if r.name.startswith("TrendFilter")],
        "Trend Filter at 1x / 2x / 3x leverage (single market)",
        "leverage.png",
    )
    print("\nChart -> leverage.png")

    # --- distribution across 200 random markets: the tail is the point -------
    print("\n=== Across 200 random index markets (the honest distribution) ===\n")
    rows = []
    for lev in LEVERAGES:
        for strat_cls, tag in ((BuyAndHold, "Buy&Hold"), (TrendFilter, "TrendFilter")):
            cagrs, dds, liqs, ruin = [], [], 0, 0
            for seed in range(200):
                d = datamod.index_market(days=2500, seed=seed)
                res = run_backtest(d, strat_cls(), leverage=lev, periods_per_year=PERIODS)
                m = metrics(res, PERIODS)
                cagrs.append(m["CAGR"])
                dds.append(m["Max Drawdown"])
                liqs += m["Liquidations"]
                if res.equity.iloc[-1] <= res.equity.iloc[0] * 0.05:
                    ruin += 1  # account effectively destroyed (>=95% loss)
            rows.append({
                "Strategy": f"{tag} {lev:g}x",
                "Median CAGR": pct(float(np.median(cagrs))),
                "Worst CAGR": pct(float(np.min(cagrs))),
                "Median MaxDD": pct(float(np.median(dds))),
                "Worst MaxDD": pct(float(np.min(dds))),
                "Liquidations": liqs,
                "Ruin runs": f"{ruin}/200",
            })
    print(pd.DataFrame(rows).set_index("Strategy").to_string())
    print("\n'Ruin runs' = markets where the account lost >=95%. That column is "
          "why leverage is dangerous: higher leverage trades a better median for "
          "a fatter chance of total wipeout.")


if __name__ == "__main__":
    main()
