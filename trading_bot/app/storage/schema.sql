-- crypto-trading-bot schema

CREATE TABLE IF NOT EXISTS trades (
    id           BIGSERIAL PRIMARY KEY,
    ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
    symbol       TEXT        NOT NULL,
    side         TEXT        NOT NULL,
    qty          DOUBLE PRECISION NOT NULL,
    price        DOUBLE PRECISION,
    order_id     TEXT,
    mode         TEXT        NOT NULL,          -- dry_run | live
    strategy     TEXT,
    reason       TEXT
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol_ts ON trades (symbol, ts DESC);

CREATE TABLE IF NOT EXISTS signals (
    id        BIGSERIAL PRIMARY KEY,
    ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
    symbol    TEXT NOT NULL,
    action    TEXT NOT NULL,
    reason    TEXT,
    price     DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS equity_snapshots (
    id      BIGSERIAL PRIMARY KEY,
    ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    equity  DOUBLE PRECISION NOT NULL
);
