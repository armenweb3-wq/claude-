# Deploying the bot (Railway or Render)

The bot can't run in the build sandbox (no network to Bybit). Deploy it to a
cloud host with open network. Both options below build from `trading_bot/Dockerfile`.

> **Secrets rule:** never put your API key/secret in the repo or in chat.
> Enter them as environment variables in the platform dashboard.

## Recommended first-run settings (safe)

| Variable | First value | Why |
|---|---|---|
| `TRADING_MODE` | `dry_run` | watch real signals, place **no** orders |
| `AUTO_START` | `false` | you start the loop deliberately via the API |
| `BYBIT_TESTNET` | `false` | mainnet (your $13) — set `true` to use testnet |
| `SYMBOLS` | `SOLUSDT,XRPUSDT,ADAUSDT,DOGEUSDT` | affordable at a small balance |
| `RISK_PER_TRADE_PCT` | `5` | 5% risk per trade |
| `MAX_LEVERAGE` | `10` | leverage cap |
| `BYBIT_API_KEY` / `BYBIT_API_SECRET` | *(secret)* | trade perms, **no withdrawal** |
| `CONTROL_API_KEY` | *(secret)* | protects the control API |
| `DATABASE_URL` | *(from managed PG)* | trades/signals/errors |

Flip `TRADING_MODE=live` only after dry-run looks right.

## Railway
1. Push this repo to GitHub (done on your branch).
2. railway.app → **New Project → Deploy from GitHub repo** → pick this repo.
3. Settings → **Root Directory** = `trading_bot` (so it finds the Dockerfile).
4. Add a **Postgres** plugin; copy its connection string into `DATABASE_URL`.
5. **Variables** tab → add the table above (secrets included).
6. Deploy. Hit `https://<your-app>.up.railway.app/health` → `{"status":"ok"}`.

## Render
1. render.com → **New → Blueprint**, point it at this repo (`trading_bot/render.yaml`).
2. It provisions the web service + managed Postgres.
3. Fill the `sync:false` secrets in the dashboard; set `DATABASE_URL` from the DB.
4. Use a **paid plan** — free web services sleep when idle and would pause trading.

## After deploy (both)
```bash
BASE=https://<your-app-url>
curl $BASE/status                                   # should show is_live + dry-run
curl -X POST $BASE/control/start -H "X-API-Key: <CONTROL_API_KEY>"   # begin the loop
```
Watch `GET /status` and `GET /errors`. When ready for real orders, set
`TRADING_MODE=live`, redeploy, confirm `/status` shows `is_live: true`, then start.
