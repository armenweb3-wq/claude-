"""How much leverage can each asset class actually take?

For every asset class we take that class's best 1x strategy (by mean Sharpe,
from multi_asset.py) and re-run it across the class's instruments at increasing
leverage. The engine models margin loans + real liquidations, so this shows the
honest trade-off: leverage scales returns *and* manufactures blow-ups.

Run after multi_asset.py. Daily data, no crypto.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

import data as datamod
from engine import metrics, run_backtest
from multi_asset import ASSET_CLASSES, PERIODS, pct
from strategies import default_suite

LEVERAGES = [1, 2, 3, 5, 10]


def best_strategy_per_class() -> dict[str, str]:
    """Pick each class's top strategy by mean Sharpe at 1x leverage."""
    best = {}
    for cls, instruments in ASSET_CLASSES.items():
        scores: dict[str, list[float]] = {}
        for sym in instruments.values():
            df = datamod.load_csv(f"realdata/{sym}.csv")
            for strat in default_suite():
                m = metrics(run_backtest(df, strat, periods_per_year=PERIODS), PERIODS)
                scores.setdefault(strat.name, []).append(m["Sharpe"])
        best[cls] = max(scores, key=lambda k: float(np.mean(scores[k])))
    return best


def sweep() -> dict[str, pd.DataFrame]:
    best = best_strategy_per_class()
    out: dict[str, pd.DataFrame] = {}

    for cls, instruments in ASSET_CLASSES.items():
        target = best[cls]
        rows = []
        for lev in LEVERAGES:
            cagrs, dds, liqs = [], [], 0
            for sym in instruments.values():
                df = datamod.load_csv(f"realdata/{sym}.csv")
                strat = next(s for s in default_suite() if s.name == target)
                res = run_backtest(df, strat, leverage=lev, periods_per_year=PERIODS)
                m = metrics(res, PERIODS)
                cagrs.append(m["CAGR"])
                dds.append(m["Max Drawdown"])
                liqs += int(m["Liquidations"] > 0)
            rows.append({
                "leverage": f"{lev}x",
                "mean_CAGR": float(np.mean(cagrs)),
                "worst_MaxDD": float(np.min(dds)),
                "blowups": f"{liqs}/{len(instruments)}",
            })
        out[cls] = (target, pd.DataFrame(rows).set_index("leverage"))
    return out


def main() -> None:
    results = sweep()
    print(f"\n{'='*70}\nLEVERAGE SWEEP — best strategy per asset class, 1x→10x"
          f"\n(blowups = instruments liquidated by a margin call)\n{'='*70}")
    for cls, (target, tbl) in results.items():
        show = tbl.copy()
        show["mean_CAGR"] = show["mean_CAGR"].map(pct)
        show["worst_MaxDD"] = show["worst_MaxDD"].map(pct)
        print(f"\n### {cls.upper()} — strategy: {target} ###")
        print(show.to_string())

    chart(results, "leverage_sweep.png")
    print("\nChart -> leverage_sweep.png")


def chart(results: dict, path: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(11, 6.5))
    xs = LEVERAGES
    for cls, (target, tbl) in results.items():
        ys = [tbl.loc[f"{l}x", "mean_CAGR"] * 100 for l in xs]
        blow = [tbl.loc[f"{l}x", "blowups"] for l in xs]
        line, = ax.plot(xs, ys, marker="o", linewidth=2, label=f"{cls} ({target})")
        # mark leverage levels where any instrument blew up
        for x, y, b in zip(xs, ys, blow):
            if int(b.split("/")[0]) > 0:
                ax.scatter([x], [y], s=180, facecolors="none",
                           edgecolors="red", linewidths=2, zorder=5)
    ax.axhline(0, color="black", linewidth=0.8)
    ax.set_xlabel("Leverage")
    ax.set_ylabel("Mean CAGR across the class (%)")
    ax.set_title("Leverage vs return by asset class — red rings = margin-call blow-ups",
                 fontsize=12, fontweight="bold")
    ax.set_xticks(xs)
    ax.grid(alpha=0.25)
    ax.legend(fontsize=9)
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    main()
