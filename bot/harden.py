"""Harden RSI-Reversion-on-indices into a leverage-ready strategy.

Three upgrades over the naive backtest, each aimed at *surviving* a leveraged
account rather than flattering the hindsight curve:

1. Volatility-targeted sizing (``VolTargetRSI``). Exposure is scaled to a target
   annualized volatility and capped at a leverage limit. Leverage is applied to
   a *risk budget*, not as a flat multiplier — so calm regimes get more size and
   turbulent ones automatically get less.

2. Walk-forward validation. RSI params are re-fit on each training window and
   traded on the *following* out-of-sample year; the OOS years are stitched into
   one honest equity curve. Nothing is optimized on the data it's scored on.

3. Leverage chosen by Calmar (CAGR / |max drawdown|), not raw return — the level
   that pays the most per unit of pain, which is what keeps a levered account alive.

Run after multi_asset.py. Indices only, daily, no crypto.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

import data as datamod
from engine import metrics, run_backtest
from strategies import RSIReversion, Strategy, rsi

PERIODS = 252
INDICES = {"S&P 500": "SP500", "Nasdaq 100": "NASDAQ100", "Dow 30": "DOW30",
           "DAX 30": "DAX30", "FTSE 100": "FTSE100"}

TRAIN, TEST = 504, 252                          # 2y fit, 1y out-of-sample
PARAM_GRID = [(p, lo) for p in (7, 14, 21) for lo in (25, 30, 35)]
HIGH = 70.0
LEV_CAPS = [1.0, 1.5, 2.0, 3.0]


class VolTargetRSI(Strategy):
    """RSI long/flat signal, sized to ``target_vol`` and capped at ``lev_cap``.

    Returns a weight in [0,1] = fraction of the leverage cap; the engine (run
    with ``leverage=lev_cap``) turns weight 1.0 into full ``lev_cap`` exposure,
    so margin interest and liquidation modelling stay intact.
    """

    name = "VolTarget RSI"

    def __init__(self, period=14, low=30.0, high=70.0,
                 vol_lookback=20, target_vol=0.15, lev_cap=2.0):
        self.period, self.low, self.high = period, low, high
        self.vol_lookback, self.target_vol, self.lev_cap = vol_lookback, target_vol, lev_cap
        self._sig = 0.0

    def reset(self) -> None:
        self._sig = 0.0

    def decide(self, history: pd.DataFrame) -> float:
        warm = max(self.period, self.vol_lookback) + 1
        if len(history) <= warm:
            return 0.0
        r = rsi(history["close"], self.period).iloc[-1]
        if r < self.low:
            self._sig = 1.0
        elif r > self.high:
            self._sig = 0.0
        rvol = history["close"].pct_change().iloc[-self.vol_lookback:].std() * np.sqrt(PERIODS)
        if rvol <= 0:
            return 0.0
        exposure = self._sig * (self.target_vol / rvol)        # equity units
        return float(np.clip(min(exposure, self.lev_cap) / self.lev_cap, 0.0, 1.0))


def window_returns(df, strat, leverage, lo, hi):
    """Run ``strat`` over df[:hi] (full warmup) and return the OOS slice [lo:hi]."""
    res = run_backtest(df.iloc[:hi], strat, leverage=leverage, periods_per_year=PERIODS)
    return res.returns.iloc[lo:hi]


def fit_params(train_df) -> tuple[int, float]:
    """Pick the (period, low) with the best 1x-signal Sharpe on the train slice."""
    best, best_sharpe = PARAM_GRID[0], -1e9
    for period, low in PARAM_GRID:
        res = run_backtest(train_df, RSIReversion(period=period, low=low, high=HIGH),
                           periods_per_year=PERIODS)
        s = metrics(res, PERIODS)["Sharpe"]
        if s > best_sharpe:
            best_sharpe, best = s, (period, low)
    return best


def walk_forward(df, lev_cap) -> pd.Series:
    """Stitch out-of-sample yearly returns into one continuous OOS return series."""
    n = len(df)
    pieces = []
    start = TRAIN
    while start + TEST <= n:
        period, low = fit_params(df.iloc[start - TRAIN:start])
        strat = VolTargetRSI(period=period, low=low, high=HIGH, lev_cap=lev_cap)
        pieces.append(window_returns(df, strat, lev_cap, start, start + TEST))
        start += TEST
    return pd.concat(pieces) if pieces else pd.Series(dtype=float)


def curve_metrics(rets: pd.Series) -> dict:
    eq = (1 + rets).cumprod()
    years = len(eq) / PERIODS
    cagr = eq.iloc[-1] ** (1 / years) - 1 if years > 0 else np.nan
    vol = rets.std() * np.sqrt(PERIODS)
    sharpe = (rets.mean() * PERIODS) / vol if vol > 0 else 0.0
    maxdd = (eq / eq.cummax() - 1).min()
    calmar = cagr / abs(maxdd) if maxdd < 0 else np.nan
    return {"CAGR": cagr, "Sharpe": sharpe, "MaxDD": maxdd, "Calmar": calmar}


def main() -> None:
    dfs = {name: datamod.load_csv(f"realdata/{sym}.csv") for name, sym in INDICES.items()}

    print(f"\n{'='*72}\nHARDENED RSI ON INDICES — walk-forward OUT-OF-SAMPLE, vol-targeted"
          f"\n{'='*72}")

    rows = []
    oos_by_cap = {}
    for cap in LEV_CAPS:
        # average OOS return stream across the 5 indices (equal-weight portfolio)
        streams = [walk_forward(df, cap) for df in dfs.values()]
        common = streams[0].index
        for s in streams[1:]:
            common = common.intersection(s.index)
        port = sum(s.reindex(common).fillna(0) for s in streams) / len(streams)
        oos_by_cap[cap] = port
        m = curve_metrics(port)
        rows.append({"lev_cap": f"{cap}x", **m})

    tbl = pd.DataFrame(rows).set_index("lev_cap")
    show = tbl.copy()
    show["CAGR"] = show["CAGR"].map(lambda v: f"{v*100:.1f}%")
    show["MaxDD"] = show["MaxDD"].map(lambda v: f"{v*100:.1f}%")
    show["Sharpe"] = show["Sharpe"].map(lambda v: f"{v:.2f}")
    show["Calmar"] = show["Calmar"].map(lambda v: f"{v:.2f}")
    print("\nEqual-weight index portfolio, out-of-sample only:")
    print(show.to_string())

    best_cap = tbl["Calmar"].idxmax()
    print(f"\n-> best leverage by Calmar (return per unit of drawdown): {best_cap}")

    chart(oos_by_cap, best_cap, dfs, "harden_oos.png")
    print("Chart -> harden_oos.png")


def chart(oos_by_cap, best_cap, dfs, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(11, 6.5))
    for cap, rets in oos_by_cap.items():
        eq = (1 + rets).cumprod()
        lw = 2.6 if f"{cap}x" == best_cap else 1.4
        ax.plot(eq.index, eq.values, linewidth=lw,
                label=f"{cap}x cap" + ("  ← best Calmar" if f"{cap}x" == best_cap else ""))
    ax.set_title("Hardened RSI on indices — out-of-sample equity by leverage cap",
                 fontsize=12, fontweight="bold")
    ax.set_ylabel("Growth of 1 (OOS, equal-weight 5 indices)")
    ax.axhline(1, color="black", linewidth=0.8)
    ax.grid(alpha=0.25)
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    main()
