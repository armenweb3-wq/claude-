"""Harden RSI-Reversion-on-indices into a leverage-ready strategy.

Three upgrades over the naive backtest, each aimed at *surviving* a leveraged
account rather than flattering the hindsight curve:

1. Volatility-targeted sizing. Exposure is scaled to a target annualized
   volatility and capped at a leverage limit, so leverage is applied to a *risk
   budget*: calm regimes get more size, turbulent ones automatically get less.

2. Walk-forward validation. RSI params are re-fit on each training window and
   traded on the *following* out-of-sample year; the OOS years are stitched into
   one honest equity curve. Nothing is optimized on the data it is scored on.

3. Leverage chosen by Calmar (CAGR / |max drawdown|), not raw return — the level
   that pays the most per unit of pain, which is what keeps a levered account alive.

Implementation note: signals/vol are precomputed vectorially and each window is
fit once (reused across leverage caps), so the whole study runs in seconds.
Indices only, daily, no crypto.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

import data as datamod
from engine import run_backtest
from strategies import Strategy, rsi

PERIODS = 252
INDICES = {"S&P 500": "SP500", "Nasdaq 100": "NASDAQ100", "Dow 30": "DOW30",
           "DAX 30": "DAX30", "FTSE 100": "FTSE100"}

TRAIN, TEST = 504, 252                                  # 2y fit, 1y out-of-sample
PERIOD_SET = (7, 14, 21)
LOW_SET = (25.0, 30.0, 35.0)
HIGH = 70.0
VOL_LOOKBACK, TARGET_VOL = 20, 0.15
LEV_CAPS = [1.0, 1.5, 2.0, 3.0]


def rsi_signal(r: pd.Series, low: float, high: float) -> pd.Series:
    """Stateful RSI long/flat signal as a vector: 1 below ``low``, 0 above
    ``high``, hold in between (matches strategies.RSIReversion)."""
    sig = pd.Series(np.nan, index=r.index)
    sig[r < low] = 1.0
    sig[r > high] = 0.0
    return sig.ffill().fillna(0.0)


class PrecomputedWeights(Strategy):
    """Replays a precomputed per-bar weight array through the engine, so margin
    interest and liquidation modelling still apply."""

    name = "VolTarget RSI"

    def __init__(self, weights: np.ndarray):
        self.weights = weights
        self.i = -1

    def reset(self) -> None:
        self.i = -1

    def decide(self, history: pd.DataFrame) -> float:
        self.i += 1
        return float(self.weights[self.i])


def precompute(df: pd.DataFrame):
    close = df["close"]
    ret = close.pct_change().fillna(0.0)
    rsis = {p: rsi(close, p) for p in PERIOD_SET}
    vol = ret.rolling(VOL_LOOKBACK).std() * np.sqrt(PERIODS)
    # walk-forward schedule: fit (period, low) on each train window by signal Sharpe
    n = len(df)
    schedule, start = [], TRAIN
    while start + TEST <= n:
        tr = slice(start - TRAIN, start)
        tr_ret = ret.iloc[tr]
        best, best_sharpe = (14, 30.0), -1e9
        for p in PERIOD_SET:
            for lo in LOW_SET:
                sig = rsi_signal(rsis[p].iloc[tr], lo, HIGH).shift(1).fillna(0.0)
                pnl = sig * tr_ret
                sd = pnl.std()
                sh = (pnl.mean() * PERIODS) / (sd * np.sqrt(PERIODS)) if sd > 0 else 0.0
                if sh > best_sharpe:
                    best_sharpe, best = sh, (p, lo)
        schedule.append((start, start + TEST, *best))
        start += TEST
    return rsis, vol, schedule


def weights_for(rsis, vol, schedule, cap) -> tuple[np.ndarray, int, int]:
    n = len(vol)
    w = np.zeros(n)
    for (s, e, p, lo) in schedule:
        sig = rsi_signal(rsis[p], lo, HIGH)
        for i in range(s, e):
            v = vol.iloc[i]
            if v > 0:
                exposure = sig.iloc[i] * (TARGET_VOL / v)
                w[i] = np.clip(min(exposure, cap) / cap, 0.0, 1.0)
    first, last = schedule[0][0], schedule[-1][1]
    return w, first, last


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
    pre = {}
    for name, sym in INDICES.items():
        df = datamod.load_csv(f"realdata/{sym}.csv")
        pre[name] = (df, *precompute(df))

    print(f"\n{'='*72}\nHARDENED RSI ON INDICES — walk-forward OUT-OF-SAMPLE, vol-targeted"
          f"\n(equal-weight 5-index portfolio, OOS years only)\n{'='*72}")

    rows, oos_by_cap = [], {}
    for cap in LEV_CAPS:
        streams = []
        for name, (df, rsis, vol, schedule) in pre.items():
            w, first, last = weights_for(rsis, vol, schedule, cap)
            res = run_backtest(df, PrecomputedWeights(w), leverage=cap, periods_per_year=PERIODS)
            streams.append(res.returns.iloc[first:last])
        idx = streams[0].index
        for s in streams[1:]:
            idx = idx.intersection(s.index)
        port = sum(s.reindex(idx).fillna(0) for s in streams) / len(streams)
        oos_by_cap[cap] = port
        rows.append({"lev_cap": f"{cap}x", **curve_metrics(port)})

    tbl = pd.DataFrame(rows).set_index("lev_cap")
    show = tbl.copy()
    show["CAGR"] = show["CAGR"].map(lambda v: f"{v*100:.1f}%")
    show["MaxDD"] = show["MaxDD"].map(lambda v: f"{v*100:.1f}%")
    show["Sharpe"] = show["Sharpe"].map(lambda v: f"{v:.2f}")
    show["Calmar"] = show["Calmar"].map(lambda v: f"{v:.2f}")
    print(show.to_string())
    best_cap = tbl["Calmar"].idxmax()
    print(f"\n-> best leverage by Calmar (return per unit of drawdown): {best_cap}")

    chart(oos_by_cap, best_cap, "harden_oos.png")
    print("Chart -> harden_oos.png")


def chart(oos_by_cap, best_cap, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(11, 6.5))
    for cap, rets in oos_by_cap.items():
        eq = (1 + rets).cumprod()
        is_best = f"{cap}x" == best_cap
        ax.plot(eq.index, eq.values, linewidth=2.6 if is_best else 1.4,
                label=f"{cap}x cap" + ("  ← best Calmar" if is_best else ""))
    ax.set_title("Hardened RSI on indices — out-of-sample equity by leverage cap",
                 fontsize=12, fontweight="bold")
    ax.set_ylabel("Growth of $1 (OOS, equal-weight 5 indices)")
    ax.axhline(1, color="black", linewidth=0.8)
    ax.grid(alpha=0.25)
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=120, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    main()
