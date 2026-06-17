"""Chart helpers — equity curves and drawdowns saved straight to PNG."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")  # headless: render to file, never to a screen
import matplotlib.pyplot as plt

from engine import BacktestResult


def plot_equity(results: list[BacktestResult], title: str, path: str) -> str:
    fig, (ax1, ax2) = plt.subplots(
        2, 1, figsize=(11, 8), sharex=True, gridspec_kw={"height_ratios": [3, 1]}
    )

    for res in results:
        ax1.plot(res.equity.index, res.equity.values, label=res.name, linewidth=1.6)
    ax1.set_title(title, fontsize=13, fontweight="bold")
    ax1.set_ylabel("Equity ($)")
    ax1.legend(loc="upper left", fontsize=9)
    ax1.grid(alpha=0.25)

    # drawdown of each strategy (how deep the pain got)
    for res in results:
        eq = res.equity
        dd = (eq / eq.cummax() - 1) * 100
        ax2.plot(dd.index, dd.values, label=res.name, linewidth=1.0)
    ax2.set_ylabel("Drawdown (%)")
    ax2.set_xlabel("Date")
    ax2.grid(alpha=0.25)

    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)
    return path
