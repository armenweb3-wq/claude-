#!/usr/bin/env python3
"""Validate Bybit connectivity, show balance, and report which symbols are
tradeable at the current balance + risk settings.

Run this on a machine/host that has network access to Bybit (NOT the
restricted build sandbox). Reads keys from the environment / .env:

    BYBIT_API_KEY, BYBIT_API_SECRET, BYBIT_TESTNET, BYBIT_CATEGORY

    python scripts/check_bybit.py

Nothing is traded — this is read-only (wallet balance + instrument info).
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT"]
RISK_PCT = 5.0
STOP_PCT = 3.0


def main() -> int:
    if not settings.bybit_api_key or not settings.bybit_api_secret:
        print("Set BYBIT_API_KEY and BYBIT_API_SECRET (in .env or the environment).")
        return 1

    try:
        from pybit.unified_trading import HTTP
    except ImportError:
        print("pybit not installed. Run: pip install -r requirements.txt")
        return 1

    net = "TESTNET" if settings.bybit_testnet else "MAINNET"
    print(f"Connecting to Bybit {net} ({settings.bybit_category}) ...")
    client = HTTP(
        testnet=settings.bybit_testnet,
        api_key=settings.bybit_api_key,
        api_secret=settings.bybit_api_secret,
    )

    # --- balance -------------------------------------------------
    try:
        wb = client.get_wallet_balance(accountType="UNIFIED")
        acct = wb["result"]["list"][0]
        equity = float(acct.get("totalEquity") or 0.0)
        avail = acct.get("totalAvailableBalance") or "?"
        print(f"\n✅ Auth OK. Total equity: {equity:.4f} USDT (available: {avail})")
    except Exception as exc:
        print(f"\n❌ Auth/balance failed: {exc}")
        print("   Check the key/secret, permissions (Orders & Positions), and testnet flag.")
        return 1

    risk_amount = equity * RISK_PCT / 100
    print(f"\nWith {RISK_PCT:g}% risk and a {STOP_PCT:g}% stop:")
    print(f"  risk/trade = {risk_amount:.4f} USDT  ->  notional ~= {risk_amount / (STOP_PCT/100):.2f} USDT\n")

    # --- per-symbol affordability --------------------------------
    target_notional = risk_amount / (STOP_PCT / 100)
    print(f"{'SYMBOL':10s} {'price':>12s} {'minQty':>12s} {'minNotional':>12s}  tradeable?")
    print("-" * 64)
    for sym in SYMBOLS:
        try:
            info = client.get_instruments_info(category=settings.bybit_category, symbol=sym)
            item = info["result"]["list"][0]
            lot = item["lotSizeFilter"]
            min_qty = float(lot.get("minOrderQty") or 0)
            min_notional = float(lot.get("minNotionalValue") or 0)
            tick = client.get_tickers(category=settings.bybit_category, symbol=sym)
            price = float(tick["result"]["list"][0]["lastPrice"])
            our_qty = target_notional / price
            ok = our_qty >= min_qty and target_notional >= (min_notional or 0)
            mark = "YES" if ok else "no (below min)"
            print(f"{sym:10s} {price:>12.5f} {min_qty:>12g} {min_notional:>12g}  {mark}")
        except Exception as exc:
            print(f"{sym:10s}  error: {exc}")

    print("\nDone. Symbols marked 'no' will be auto-skipped by the bot at this balance.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
