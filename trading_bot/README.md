# crypto-trading-bot

A FastAPI-driven crypto trading bot for **Bybit**, written in Python.
It pulls market data, runs a pluggable strategy, sizes positions with a
risk manager, persists to PostgreSQL, and sends Telegram alerts.

> ⚠️ **Safety:** the bot runs in **dry-run** mode by default and will
> **not** place real orders unless `TRADING_MODE=live` *and* valid Bybit
> API keys are set. Even then, start on **testnet**. Trading carries real
> financial risk — you are responsible for any live use.

## Architecture

```
app/
  main.py            FastAPI app + lifespan (creates the bot; does not auto-start)
  config.py          env/.env settings, with an `is_live` safety gate
  api/routes.py      /health, /status, /control/{start,stop,pause,resume}
  core/bot.py        the trading loop: data → signal → risk → order → persist/notify
  exchange/          pluggable venues
    base.py          ExchangeAdapter interface
    paper.py         simulated fills on REAL Bybit public data (default)
    bybit.py         live pybit adapter (only used when is_live)
  strategy/          pluggable strategies
    base.py          Strategy interface (returns a Signal)
    sma_crossover.py PLACEHOLDER — replace with your real edge
  risk/manager.py    fixed-fractional sizing + leverage/positions/daily-loss guards
  storage/           PostgreSQL persistence (degrades to no-op if unconfigured)
  notify/telegram.py Telegram alerts (degrades to logging if unconfigured)
tests/               offline unit tests (no network/DB/keys needed)
```

The exchange, strategy, risk, storage, and notify layers are all swappable —
the core loop only talks to their interfaces.

## Database (PostgreSQL)

```bash
# Option A — local Postgres via Docker (schema auto-applied on first run):
docker compose up -d
docker compose ps           # wait for "healthy"

# Option B — managed/remote Postgres: set DATABASE_URL in .env, then:
python scripts/init_db.py   # applies schema.sql idempotently
```

Tables: `trades`, `signals`, `equity_snapshots`. If `DATABASE_URL` is unset,
the bot still runs and simply skips persistence (logs a warning).

## Quick start

```bash
cd trading_bot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # edit as needed (defaults are safe / dry-run)

# run tests (no keys required)
pytest

# start the API (bot is created but idle until you start it)
uvicorn app.main:app --reload --port 8000

# in another shell
curl localhost:8000/status
curl -X POST localhost:8000/control/start
curl -X POST localhost:8000/control/pause
```

## Going live (when you're ready)

1. Create Bybit **testnet** keys; set `BYBIT_TESTNET=true`, fill the keys.
2. Set `TRADING_MODE=live` and confirm `GET /status` shows `is_live: true`
   and the correct `safety` string.
3. Validate behaviour on testnet for a while.
4. Only then switch to mainnet keys (`BYBIT_TESTNET=false`). Use keys
   **without withdrawal permission**.

## Still TODO (needs your input)

These were left as safe placeholders pending your specification:

- **Strategy logic** — `sma_crossover.py` is a stub, not an edge. Replace
  it with your real entry/exit rules.
- **Symbols / timeframe** — defaults to `BTCUSDT` @ 15m in `.env`.
- **Risk parameters** — tune `.env` (risk %, leverage, SL/TP, daily cap).
- **Telegram command handling** — currently alert-only; two-way control
  (`/status`, `/pause` from chat) can be added if you want it.
```
