"""Automatic symbol universe: everything the broker lets you trade, classified
into asset classes so crypto (or any other class) can be excluded."""

from __future__ import annotations

import re
from typing import Any, Iterable

from .. import mt5_constants as C

CRYPTO_CODES = {"BTC", "ETH", "LTC", "XRP", "BCH", "ADA", "DOT", "DOGE", "SOL", "BNB", "XLM", "EOS", "LINK", "UNI", "AVAX",
                "MATIC", "TRX", "XMR", "DASH", "ETC", "NEO", "ATOM", "SHIB", "USDT", "USDC", "XTZ", "ALGO", "FIL", "AAVE",
                "ZEC", "IOTA", "VET", "SAND", "MANA", "APE", "NEAR", "ICP", "TON", "ARB", "OP", "SUI", "PEPE", "XLM"}
FIAT = {"USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "ZAR",
        "MXN", "SGD", "HKD", "CNH", "CNY", "RUB", "ILS", "THB", "INR", "KRW", "BRL", "CLP", "COP", "RON", "AED", "SAR"}
METALS = {"XAU", "XAG", "XPT", "XPD", "GOLD", "SILVER", "PLATINUM", "PALLADIUM", "COPPER", "XCU"}
ENERGY_WORDS = ("OIL", "BRENT", "WTI", "NGAS", "NATGAS", "GAS", "UKOIL", "USOIL", "XBR", "XTI", "XNG")
INDEX_WORDS = ("US30", "US500", "US100", "NAS100", "USTEC", "SPX", "DJ30", "GER40", "GER30", "DE40", "DE30", "DAX", "UK100",
               "FTSE", "JP225", "JPN225", "NIKKEI", "AUS200", "HK50", "HSI", "FRA40", "CAC", "EU50", "STOXX", "ESP35", "IT40",
               "SWI20", "CHINA50", "US2000", "VIX", "NDX", "SP500", "DOW")

CATEGORIES = ("forex", "metals", "indices", "energies", "stocks", "other")


def classify(info: dict[str, Any]) -> str:
    name = str(info.get("name") or "").upper()
    path = str(info.get("path") or "").upper().replace("/", "\\")
    base = str(info.get("currency_base") or "").upper()
    profit = str(info.get("currency_profit") or "").upper()
    calc = info.get("trade_calc_mode")
    head = name.split(".")[0].split("_")[0].replace("#", "")
    fiat_pair = len(head) == 6 and head[:3] in FIAT and head[3:] in FIAT
    if "CRYPTO" in path or base in CRYPTO_CODES or (not fiat_pair and (head[:3] in CRYPTO_CODES or head[:4] in CRYPTO_CODES)):
        return "crypto"
    if any(w in path for w in ("METAL", "GOLD", "SILVER")) or base in METALS or head[:3] in METALS or head.startswith(("XAU", "XAG", "XPT", "XPD")):
        return "metals"
    if "ENERG" in path or "OIL" in path or any(w in head for w in ENERGY_WORDS):
        return "energies"
    if any(w in path for w in ("INDEX", "INDICES", "CASH", "CFD\\IND")) or any(head.startswith(w) or head == w for w in INDEX_WORDS) or calc == 3:
        return "indices"
    if any(w in path for w in ("STOCK", "SHARE", "EQUIT", "ETF")) or calc in (32, 33, 34) or (len(head) <= 5 and head.isalpha() and base == "" and profit == "USD" and "FOREX" not in path):
        return "stocks"
    if "FOREX" in path or "FX" in path or (len(head) == 6 and head[:3] in FIAT and head[3:] in FIAT) or (base in FIAT and profit in FIAT and calc in (0, 5, None)):
        return "forex"
    return "other"


def build_universe(symbols: Iterable[dict[str, Any]], *, include: Iterable[str] = ("forex", "metals", "indices", "energies"),
                   exclude_crypto: bool = True, max_symbols: int = 40, prefer_visible: bool = True,
                   exclude_patterns: Iterable[str] = ()) -> dict[str, Any]:
    include = {c for c in include}
    pats = [re.compile(p, re.I) for p in exclude_patterns if p]
    chosen: list[dict[str, Any]] = []
    counts: dict[str, int] = {c: 0 for c in CATEGORIES + ("crypto",)}
    skipped: dict[str, int] = {"not_tradeable": 0, "crypto": 0, "category": 0, "pattern": 0, "cap": 0}
    for info in symbols:
        tm = info.get("trade_mode")
        if tm is not None and tm != C.SYMBOL_TRADE_MODE_FULL:
            skipped["not_tradeable"] += 1
            continue
        cat = classify(info)
        counts[cat] = counts.get(cat, 0) + 1
        if cat == "crypto" and exclude_crypto:
            skipped["crypto"] += 1
            continue
        if cat != "crypto" and cat not in include:
            skipped["category"] += 1
            continue
        name = str(info.get("name") or "")
        if any(p.search(name) for p in pats):
            skipped["pattern"] += 1
            continue
        chosen.append({"name": name, "category": cat, "visible": bool(info.get("visible")), "path": info.get("path"),
                       "spread": info.get("spread"), "description": info.get("description")})
    # Market Watch symbols first (the ones the trader already follows), then the rest alphabetically within category
    order = {c: i for i, c in enumerate(CATEGORIES)}
    chosen.sort(key=lambda s: (0 if (prefer_visible and s["visible"]) else 1, order.get(s["category"], 9), s["name"]))
    if max_symbols and len(chosen) > max_symbols:
        skipped["cap"] = len(chosen) - max_symbols
        chosen = chosen[:max_symbols]
    return {"symbols": [s["name"] for s in chosen], "details": chosen, "counts": counts, "skipped": skipped, "total_scanned": sum(counts.values()) + skipped["not_tradeable"]}
