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
  notify/            alerts fan out to all configured channels:
    telegram.py        Telegram Bot API
    webhook.py         generic JSON webhook (optional HMAC-SHA256 signing)
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

Tables: `trades`, `signals`, `equity_snapshots`, `error_log`. If
`DATABASE_URL` is unset, the bot still runs and simply skips persistence
(logs a warning).

Runtime errors are captured to `error_log` (source, message, traceback) in
addition to logs and notifications. Read recent ones via `GET /errors?limit=N`.

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

## Frontend (React dashboard)

A Vite + React control panel lives in `frontend/`. It polls `/status` and
drives the `/control/*` endpoints (start/stop/pause/resume), shows a
LIVE/DRY-RUN safety banner, and lists the latest per-symbol signals.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /status,/control to :8000)
npm run build      # production build into frontend/dist
```

Run the backend (`uvicorn app.main:app`) alongside it for live data.

## Control-API authentication

The state-changing `/control/*` endpoints are protected by a shared secret.

- Set `CONTROL_API_KEY` in `.env`; clients must send it as the `X-API-Key`
  header. `/health` and `/status` stay open.
- If `CONTROL_API_KEY` is empty, control endpoints are **unprotected** (a
  loud warning is logged on startup) — acceptable for local dry-run only.
- The React dashboard reads `VITE_CONTROL_API_KEY` and attaches it to
  control requests. For browser exposure, prefer a reverse proxy that
  injects the header rather than shipping the key to the client.

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"   # make a key
```

## Telegram control (two-way)

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and
`TELEGRAM_COMMANDS_ENABLED=true` to drive the bot from chat:

| Command   | Action                                   |
|-----------|------------------------------------------|
| `/status` | show running/paused/mode/strategy        |
| `/start`  | start the trading loop                   |
| `/stop`   | stop the trading loop                    |
| `/pause`  | pause trading (loop runs, no orders)     |
| `/resume` | resume trading                           |
| `/help`   | list commands                            |

Only messages from `TELEGRAM_CHAT_ID` are honoured; everything else is
ignored. The command listener runs inside the FastAPI process (polling).

## Strategy (confluence)

`app/strategy/confluence.py` is the real strategy: it scores RSI(14),
50/200 EMA structure, an EMA crossover trigger, and supply/demand-zone
proximity into a confidence in `[0,1]`, biased by a dynamic market-regime
detector (`regime.py`). The confidence doubles as the win-probability gate
(default 0.70). It emits a full plan: BUY/SELL, entry, 3% stop, the
TP1/TP2/TP3 ladder, blended risk:reward, and a leverage suggestion.

Sizing (`app/risk/sizing.py`) risks a fixed % of equity per trade (default
5%); the stop distance sets quantity and leverage is chosen (capped) so the
liquidation price stays beyond the stop.

## Backtesting

```bash
cd trading_bot
# Offline demo on reproducible synthetic data (no network):
python -m app.backtest.run --synthetic

# Real Bybit data (needs egress to api.bybit.com):
python -m app.backtest.run --source bybit --start 2023-01-01 \
    --symbols BTCUSDT ETHUSDT SOLUSDT XRPUSDT ADAUSDT DOGEUSDT \
    --timeframes 1h 4h --json-out report.json

# Offline from CSVs named <SYMBOL>_<TF>.csv:
python -m app.backtest.run --source csv --csv-dir ./data --symbols BTCUSDT --timeframes 1h
```

The engine simulates the live rules faithfully: 5%-risk sizing, 3% stop,
TP ladder partial closes, trailing stop after TP1, daily trade cap, taker
fees + slippage, and worst-case intrabar fills (stop assumed before TP).

> Note: the liquidation-heatmap input is neutral in backtests (that data is
> live-only / proxied); the backtest covers the RSI + EMA + supply/demand core.

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
