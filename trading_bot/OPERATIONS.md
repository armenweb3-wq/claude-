# OPERATIONS — ZENITH (multi-user trading beta)

Critical operational notes for the live SaaS. Read before changing anything in
Render. Losing these protections means losing user data or access.

## 🔒 NEVER change these env vars (data/access loss)

- **`SAAS_SECRET_KEY`** — friends' exchange API keys are encrypted at rest with a
  key derived from this. Change it and every stored key becomes undecryptable;
  each friend would have to reconnect their keys. Keep it constant forever.
- **`DATABASE_URL`** — points the app at the Postgres holding all accounts, keys,
  settings and payments. Changing/replacing it orphans everyone's data.

## 💳 Database upgrade deadline (free Postgres expires)

- The Render Postgres (`trading-bot-db`) was created on the **Free** plan, which
  Render **deletes ~30 days after creation**. Created **2026-06-15**, so it
  expires **on/around 2026-07-15**.
- **Before then:** Render → `trading-bot-db` → upgrade to **Basic** (~$6/mo) to
  keep all accounts and keys. If it lapses, every friend's account is wiped.

## Safe to change anytime (no user impact)

- `SAAS_ACCESS_CODE` — only affects new joins; already-active users keep access.
- `SYMBOLS` — only the default for new signups; existing users keep their saved list.
- `PAY_*`, `SAAS_PAYMENT_REQUIRED`, `CLOSE_ON_REGIME_FLIP`, `TIMEFRAME`, UI/code.

## Schema changes

- Add columns via the idempotent migration in `app/saas/store.py::_migrate`
  (e.g. `ALTER TABLE ... ADD COLUMN ...` wrapped to ignore "already exists"),
  so existing rows stay valid across deploys.

## Deploys

- Both the standalone bot and the SaaS run from one Render web service
  (`claude--1`), branch `claude/crypto-trading-bot-q27pu0`. Turn on Auto-Deploy
  so pushes go live; otherwise use Manual Deploy → Deploy latest commit.
