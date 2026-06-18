"""Backtest every strategy across every instrument, kept SEPARATE by asset class.

Real ~10-year daily history (in ``realdata/``), no crypto:

    Indices      : S&P 500, Nasdaq 100, Dow 30, DAX 30, FTSE 100
    Commodities  : Gold, Silver, Brent crude
    Currencies   : EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD
    Stocks       : AAPL, TSLA, NFLX

For each asset class it reports, per strategy, the average performance across
that class's instruments and how often the strategy beat Buy & Hold — so you can
see what actually works *within* each market type, not blended together.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

import data as datamod
from engine import metrics, run_backtest
from plotting import plot_equity
from strategies import default_suite

PERIODS = 252  # business-day daily data

ASSET_CLASSES: dict[str, dict[str, str]] = {
    "Indices": {
        "S&P 500": "SP500", "Nasdaq 100": "NASDAQ100", "Dow 30": "DOW30",
        "DAX 30": "DAX30", "FTSE 100": "FTSE100",
    },
    "Commodities": {"Gold": "XAUUSD", "Silver": "SILVER", "Brent Oil": "BRENT"},
    "Currencies": {
        "EUR/USD": "EURUSD", "GBP/USD": "GBPUSD", "USD/JPY": "USDJPY",
        "AUD/USD": "AUDUSD", "USD/CAD": "USDCAD",
    },
    "Stocks": {"Apple": "AAPL", "Tesla": "TSLA", "Netflix": "NFLX"},
}


def pct(x: float) -> str:
    return "n/a" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x * 100:,.1f}%"


def run_all() -> dict[str, pd.DataFrame]:
    """Return one per-strategy summary DataFrame per asset class."""
    summaries: dict[str, pd.DataFrame] = {}
    n_tests = 0

    for cls, instruments in ASSET_CLASSES.items():
        # collect metrics: rows = (instrument, strategy)
        records = []
        for nice, sym in instruments.items():
            df = datamod.load_csv(f"realdata/{sym}.csv")
            bh_sharpe = None
            for strat in default_suite():
                m = metrics(run_backtest(df, strat, periods_per_year=PERIODS), PERIODS)
                n_tests += 1
                if strat.name == "Buy & Hold":
                    bh_sharpe = m["Sharpe"]
                records.append({"instrument": nice, "strategy": strat.name, **m})
            for r in records:
                if r["instrument"] == nice:
                    r["beat_bh"] = r["Sharpe"] > bh_sharpe

        rec = pd.DataFrame(records)
        # aggregate across the class's instruments, per strategy
        agg = rec.groupby("strategy").agg(
            mean_CAGR=("CAGR", "mean"),
            mean_Sharpe=("Sharpe", "mean"),
            mean_MaxDD=("Max Drawdown", "mean"),
            beat_BH=("beat_bh", "mean"),
        )
        n_inst = len(instruments)
        agg["beat_BH"] = (agg["beat_BH"] * n_inst).round().astype(int).astype(str) + f"/{n_inst}"
        agg = agg.sort_values("mean_Sharpe", ascending=False)
        summaries[cls] = agg

    summaries["_n_tests"] = n_tests  # type: ignore
    return summaries


def main() -> None:
    summaries = run_all()
    n_tests = summaries.pop("_n_tests")

    print(f"\n{'='*70}\nMULTI-ASSET BACKTEST  —  {n_tests} backtests "
          f"(7 strategies × 16 instruments), ~10yr daily, no crypto\n{'='*70}")

    for cls, agg in summaries.items():
        show = agg.copy()
        show["mean_CAGR"] = show["mean_CAGR"].map(pct)
        show["mean_Sharpe"] = show["mean_Sharpe"].map(lambda v: f"{v:.2f}")
        show["mean_MaxDD"] = show["mean_MaxDD"].map(pct)
        best = agg.index[0]
        print(f"\n### {cls.upper()} — averaged across the class's instruments ###")
        print(show.to_string())
        print(f"  -> best risk-adjusted in {cls}: {best}")

    # visual: mean CAGR by strategy, one panel per asset class
    chart_mean_cagr(summaries, "multi_asset.png")
    print("\nChart -> multi_asset.png")


def chart_mean_cagr(summaries: dict[str, pd.DataFrame], path: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(2, 2, figsize=(13, 9))
    for ax, (cls, agg) in zip(axes.flat, summaries.items()):
        s = agg["mean_CAGR"].sort_values()
        colors = ["#c0392b" if v < 0 else "#27ae60" for v in s.values]
        ax.barh(s.index, s.values * 100, color=colors)
        ax.set_title(f"{cls} — mean CAGR by strategy", fontsize=11, fontweight="bold")
        ax.axvline(0, color="black", linewidth=0.8)
        ax.set_xlabel("Mean CAGR (%)")
        ax.grid(axis="x", alpha=0.25)
    fig.suptitle("Real ~10yr daily data — strategy performance per asset class",
                 fontsize=13, fontweight="bold")
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    main()
