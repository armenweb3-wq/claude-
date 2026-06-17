"""Live paper-trading bot — same engine, fake money, real prices.

It keeps a tiny JSON portfolio on disk (cash + units) and advances it by one
bar each time it is invoked with the latest candles. No broker, no real funds:
this is the safe place to let a strategy prove itself before anything real.

In this hosted environment the candles come from the connected Crypto.com feed
(the caller passes them in as a list of dicts). Point ``--candles`` at any JSON
file with the same shape, or wire ``feed_fn`` to your own data source.

    python paper_bot.py --candles candles.json --instrument BTC_USDT
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import asdict, dataclass

import data as datamod
from strategies import Grid, Strategy

STATE_FILE = "paper_state.json"


@dataclass
class Portfolio:
    cash: float = 10_000.0
    units: float = 0.0
    last_ts: str = ""

    def equity(self, price: float) -> float:
        return self.cash + self.units * price


def load_state(path: str = STATE_FILE) -> Portfolio:
    if os.path.exists(path):
        with open(path) as f:
            return Portfolio(**json.load(f))
    return Portfolio()


def save_state(p: Portfolio, path: str = STATE_FILE) -> None:
    with open(path, "w") as f:
        json.dump(asdict(p), f, indent=2)


def step(
    candles: list[dict],
    strategy: Strategy,
    state: Portfolio,
    commission: float = 0.0005,
    slippage: float = 0.0005,
) -> dict:
    """Apply the strategy to the newest closed bar and rebalance once."""
    df = datamod.from_candlestick_json({"data": candles})
    latest = df.iloc[-1]
    price = float(latest["close"])
    ts = str(df.index[-1])

    if ts == state.last_ts:
        return {"action": "noop", "reason": "no new bar", "price": price}

    strategy.reset()
    target_w = float(min(max(strategy.decide(df), 0.0), 1.0))

    equity = state.equity(price)
    target_units = (target_w * equity) / price
    delta = target_units - state.units
    cost = abs(delta) * price * (commission + slippage)

    action = "hold"
    if delta > 1e-9:
        action = "buy"
    elif delta < -1e-9:
        action = "sell"

    state.cash -= delta * price + cost
    state.units = target_units
    state.last_ts = ts

    return {
        "action": action,
        "price": round(price, 2),
        "target_weight": round(target_w, 3),
        "units": round(state.units, 6),
        "cash": round(state.cash, 2),
        "equity": round(state.equity(price), 2),
        "timestamp": ts,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candles", required=True, help="JSON file: {'data': [...]}")
    ap.add_argument("--instrument", default="BTC_USDT")
    args = ap.parse_args()

    with open(args.candles) as f:
        payload = json.load(f)
    candles = payload["data"] if isinstance(payload, dict) else payload

    state = load_state()
    result = step(candles, Grid(), state)
    save_state(state)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
