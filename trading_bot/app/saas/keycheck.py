"""Validate a user's Bybit API key before we store it.

The cardinal rule of the non-custodial model: the key must be able to TRADE
but must NOT be able to WITHDRAW. We verify this against Bybit's
``query-api`` endpoint and reject anything that can move funds.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def parse_permissions(result: dict) -> dict:
    """Pure parser (unit-testable) for Bybit's query-api result."""
    perms = result.get("permissions", {}) or {}
    # Scan BOTH the permission group names and their values — Bybit may express
    # withdrawal as a group key ("Withdraw") or a value ("WithdrawOnly").
    flat = []
    for k, vals in perms.items():
        flat.append(str(k))
        if isinstance(vals, list):
            flat += [str(p) for p in vals]
    can_withdraw = any("withdraw" in s.lower() for s in flat)
    read_only = str(result.get("readOnly")) in {"1", "True", "true"}
    can_trade = (not read_only) and bool(perms.get("ContractTrade") or perms.get("Derivatives"))
    return {"can_trade": can_trade, "can_withdraw": can_withdraw, "read_only": read_only}


def verify_bybit_key(api_key: str, api_secret: str, testnet: bool = False) -> tuple[bool, str]:
    """Return (ok, message). ok=True only for trade-enabled, no-withdrawal keys."""
    try:
        from pybit.unified_trading import HTTP

        client = HTTP(testnet=testnet, api_key=api_key, api_secret=api_secret)
        resp = client.get_api_key_information()
        result = resp.get("result", {}) if isinstance(resp, dict) else {}
        perm = parse_permissions(result)
    except Exception as exc:  # network / auth / bad key
        return False, f"Could not verify this key with Bybit: {exc}"

    if perm["can_withdraw"]:
        return False, ("This API key has WITHDRAWAL permission. For your safety we only "
                       "accept keys that cannot withdraw. Recreate the key with trade "
                       "access but withdrawal DISABLED.")
    if not perm["can_trade"]:
        return False, ("This API key can't place trades. Enable Unified Trading / "
                       "Contract 'Trade' permission (and keep withdrawal disabled).")
    return True, "ok"
