# Trading-strategy backtester + paper bot

A small, honest framework for turning trading-book *ideas* into *testable rules*,
backtesting them against data, and running the winner as a fake-money paper bot.

It exists to answer one question: **does a strategy actually work, or does it just
sound good in a video?**

## What's inside

| File | Purpose |
|------|---------|
| `data.py` | Load any OHLC CSV, or generate a realistic regime-switching synthetic market. Also parses the Crypto.com live-feed candle shape. |
| `strategies.py` | Strategies distilled from the classics: **Grid** (the "+5% sell / −10% buy" rule), **RSI Reversion** (Elder), **MA Crossover** (Murphy), **Candlestick Engulfing** (Nison), and **Buy & Hold** (the benchmark). |
| `engine.py` | Event-driven backtester (no lookahead, real commission + slippage) and metrics: CAGR, Sharpe, max drawdown, win rate. |
| `plotting.py` | Equity-curve + drawdown charts. |
| `run_backtest.py` | CLI: run the whole suite and print a comparison table. |
| `paper_bot.py` | Live paper trader — same engine, fake money, real prices, state on disk. |

## Quick start

```bash
pip install -r requirements.txt

python run_backtest.py                      # synthetic equity-like market
python run_backtest.py --csv btc_recent.csv --periods 365   # real data
```

## How a strategy is written

Each strategy implements `decide(history) -> target_weight` (0 = all cash,
1 = fully invested). `history` only contains bars up to *now*, and the engine
fills the order at the **next** bar's open — so a strategy can never act on a
price it couldn't have known. Add your own by subclassing `Strategy`.

## The honest takeaways (from 30 random markets)

- **Buy & Hold wins on average** in markets that drift up over time — matching
  decades of academic evidence. Beating it consistently is genuinely hard.
- **The Grid ("+5%/−10%") strategy's real virtue is risk control**, not return:
  it roughly *halves* the max drawdown of buy & hold, at the cost of giving up
  upside. It shines in choppy/sideways and falling markets and lags in strong
  bull runs — exactly as theory predicts.
- No strategy here is a money printer. The framework's job is to let you
  *measure* that, not to promise it.

## Limitations / next steps

- Long-only, single asset, no leverage or shorting.
- Network is blocked in this environment, so real history comes via CSV or the
  live feed. Run it where you have data access (or upload a CSV) for longer tests.
- Next layers worth adding: walk-forward / out-of-sample splits, parameter
  sweeps (with overfitting guards), portfolio of assets, and only then an ML
  layer — and only if the rules show a real edge first.
