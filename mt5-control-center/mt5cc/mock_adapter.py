"""A deterministic, clearly-labelled DEMO data source.

It mimics the subset of the MetaTrader 5 API the worker uses, so the whole
application can be exercised without a terminal (e.g. on first run, or while
developing). Everything it produces is synthetic and the UI labels it as such.
"""

from __future__ import annotations

import math
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from . import mt5_constants as C

SYMBOLS = (
    ("EURUSD", 1.0850, 0.0010, 100000),
    ("GBPUSD", 1.2700, 0.0012, 100000),
    ("XAUUSD", 2350.0, 8.0, 100),
    ("USDJPY", 155.00, 0.15, 1000),
    ("US500", 5200.0, 15.0, 10),
)


class MockAdapter:
    def __init__(self, cfg: dict[str, Any]):
        self.cfg = cfg
        seed = sum(ord(c) for c in str(cfg.get("id", "mock"))) * 7919
        self.rng = random.Random(seed)
        self.login = int(cfg.get("login") or (50_000_000 + seed % 9_000_000))
        self.currency = "USD" if seed % 3 else "EUR"
        self.connected = False
        self._deals: list[dict[str, Any]] = []
        self._positions: list[dict[str, Any]] = []
        self._balance = 0.0
        self._build()

    # ------------------------------------------------------------------ #
    def _build(self) -> None:
        rng = self.rng
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=150)
        ticket = 100_000 + (self.login % 1000) * 100
        order = ticket + 5
        pos_id = ticket + 1000
        t = start
        balance = 0.0

        def add(deal: dict[str, Any]) -> None:
            nonlocal balance
            balance += deal["profit"] + deal["commission"] + deal["swap"] + deal["fee"]
            self._deals.append(deal)

        def mk(time_dt: datetime, **kw: Any) -> dict[str, Any]:
            nonlocal ticket, order
            ticket += 1
            order += 1
            base = {
                "ticket": ticket, "order": order, "time": int(time_dt.timestamp()),
                "time_msc": int(time_dt.timestamp() * 1000), "type": C.DEAL_TYPE_BUY,
                "entry": C.DEAL_ENTRY_IN, "magic": 0, "position_id": 0, "reason": 0,
                "volume": 0.0, "price": 0.0, "commission": 0.0, "swap": 0.0,
                "profit": 0.0, "fee": 0.0, "symbol": "", "comment": "", "external_id": "",
            }
            base.update(kw)
            return base

        # Initial deposit
        add(mk(t, type=C.DEAL_TYPE_BALANCE, profit=25000.0, comment="Deposit"))
        t += timedelta(hours=5)

        trades_per_week = 9
        while t < now - timedelta(hours=6):
            sym, px, vol_sd, contract = rng.choice(SYMBOLS)
            lots = rng.choice((0.1, 0.2, 0.25, 0.5, 1.0))
            is_buy = rng.random() < 0.5
            pos_id += 1
            entry_px = px * (1 + rng.gauss(0, 0.004))
            # cluster trading hours across sessions
            hour = rng.choice((1, 3, 7, 8, 9, 10, 13, 14, 15, 16, 17, 19, 21))
            t = t.replace(hour=hour, minute=rng.randrange(60), second=rng.randrange(60))
            if t.weekday() >= 5:
                t += timedelta(days=2)
                continue
            comm = -round(lots * 3.5, 2)
            add(mk(t, type=C.DEAL_TYPE_BUY if is_buy else C.DEAL_TYPE_SELL,
                   entry=C.DEAL_ENTRY_IN, position_id=pos_id, volume=lots,
                   price=round(entry_px, 5), commission=comm, symbol=sym))
            hold = timedelta(minutes=rng.choice((15, 45, 120, 300, 900, 1800, 3000)))
            # occasional scale-in (second entry)
            if rng.random() < 0.15:
                t2 = t + hold / 3
                entry2 = entry_px * (1 + rng.gauss(0, 0.002))
                add(mk(t2, type=C.DEAL_TYPE_BUY if is_buy else C.DEAL_TYPE_SELL,
                       entry=C.DEAL_ENTRY_IN, position_id=pos_id, volume=lots,
                       price=round(entry2, 5), commission=comm, symbol=sym))
                total_lots = lots * 2
                avg_px = (entry_px + entry2) / 2
            else:
                total_lots = lots
                avg_px = entry_px
            exit_px = avg_px * (1 + rng.gauss(0.0011, 0.006))
            direction = 1 if is_buy else -1
            swap = -round(total_lots * 0.8 * (hold.days + (1 if hold.seconds > 36000 else 0)), 2)
            remaining = total_lots
            # partial close in ~25% of trades
            if rng.random() < 0.25 and total_lots >= 0.2:
                part = round(total_lots / 2, 2)
                p1 = avg_px * (1 + rng.gauss(0.0003, 0.003))
                profit1 = round((p1 - avg_px) * direction * part * contract, 2)
                add(mk(t + hold / 2, type=C.DEAL_TYPE_SELL if is_buy else C.DEAL_TYPE_BUY,
                       entry=C.DEAL_ENTRY_OUT, position_id=pos_id, volume=part,
                       price=round(p1, 5), commission=-round(part * 3.5, 2),
                       profit=profit1, symbol=sym))
                remaining = round(total_lots - part, 2)
            profit = round((exit_px - avg_px) * direction * remaining * contract, 2)
            if rng.random() < 0.05:
                # position reversal: close and open opposite in one deal.
                # MT5 keeps the same POSITION_IDENTIFIER through a netting reversal.
                add(mk(t + hold, type=C.DEAL_TYPE_SELL if is_buy else C.DEAL_TYPE_BUY,
                       entry=C.DEAL_ENTRY_INOUT, position_id=pos_id, volume=round(remaining * 2, 2),
                       price=round(exit_px, 5), commission=-round(remaining * 2 * 3.5, 2),
                       swap=swap, profit=profit, symbol=sym))
                # and close the reversed part later
                rev_exit = exit_px * (1 + rng.gauss(0, 0.004))
                rev_profit = round((rev_exit - exit_px) * (-direction) * remaining * contract, 2)
                add(mk(t + hold + timedelta(hours=3), type=C.DEAL_TYPE_BUY if is_buy else C.DEAL_TYPE_SELL,
                       entry=C.DEAL_ENTRY_OUT, position_id=pos_id, volume=remaining,
                       price=round(rev_exit, 5), commission=-round(remaining * 3.5, 2),
                       profit=rev_profit, symbol=sym))
            else:
                add(mk(t + hold, type=C.DEAL_TYPE_SELL if is_buy else C.DEAL_TYPE_BUY,
                       entry=C.DEAL_ENTRY_OUT, position_id=pos_id, volume=remaining,
                       price=round(exit_px, 5), commission=-round(remaining * 3.5, 2),
                       swap=swap, profit=profit, symbol=sym))
            t += timedelta(hours=rng.uniform(4, 168 / trades_per_week * 2))

        # a withdrawal and a correction in the middle
        mid = start + timedelta(days=70)
        add(mk(mid, type=C.DEAL_TYPE_BALANCE, profit=-1500.0, comment="Withdrawal"))
        add(mk(mid + timedelta(days=20), type=C.DEAL_TYPE_CORRECTION, profit=12.4, comment="Adjustment"))
        self._deals.sort(key=lambda d: (d["time_msc"], d["ticket"]))
        self._balance = round(balance, 2)

        # open positions (entry deals exist in history, no exit yet)
        for i in range(3):
            sym, px, vol_sd, contract = SYMBOLS[(i * 2 + self.login) % len(SYMBOLS)]
            pos_id += 1
            lots = (0.2, 0.5, 0.1)[i]
            is_buy = i != 1
            opened = now - timedelta(hours=(3, 26, 1)[i])
            entry_px = px * (1 + rng.gauss(0, 0.002))
            d = mk(opened, type=C.DEAL_TYPE_BUY if is_buy else C.DEAL_TYPE_SELL,
                   entry=C.DEAL_ENTRY_IN, position_id=pos_id, volume=lots,
                   price=round(entry_px, 5), commission=-round(lots * 3.5, 2), symbol=sym)
            add(d)
            self._positions.append({
                "ticket": pos_id, "time": d["time"], "time_msc": d["time_msc"],
                "time_update": d["time"], "type": C.POSITION_TYPE_BUY if is_buy else C.POSITION_TYPE_SELL,
                "magic": 0, "identifier": pos_id, "reason": 0, "volume": lots,
                "price_open": d["price"], "sl": 0.0, "tp": 0.0, "price_current": d["price"],
                "swap": 0.0, "profit": 0.0, "symbol": sym, "comment": "", "external_id": "",
                "_contract": contract, "_vol": px * 0.0015,
            })
        self._deals.sort(key=lambda d: (d["time_msc"], d["ticket"]))
        self._balance = round(balance, 2)

    # ------------------------------------------------------------------ #
    def _tick_positions(self) -> None:
        phase = time.time() / 60.0
        for i, p in enumerate(self._positions):
            wobble = math.sin(phase + i) * 1.4 + math.sin(phase * 3.1 + i * 2) * 0.5
            direction = 1 if p["type"] == C.POSITION_TYPE_BUY else -1
            p["price_current"] = round(p["price_open"] + wobble * p["_vol"], 5)
            p["profit"] = round((p["price_current"] - p["price_open"]) * direction * p["volume"] * p["_contract"], 2)

    # ------------------------------------------------------------------ #
    def connect(self) -> dict[str, Any]:
        time.sleep(0.4)
        self.connected = True
        return self.account_info()

    def shutdown(self) -> None:
        self.connected = False

    def last_error(self) -> str:
        return "no error (mock)"

    def version(self) -> Any:
        return (500, 4400, "mock")

    def account_info(self) -> dict[str, Any]:
        self._tick_positions()
        floating = round(sum(p["profit"] + p["swap"] for p in self._positions), 2)
        margin = round(sum(p["volume"] * p["price_open"] * p["_contract"] / 100 for p in self._positions), 2)
        equity = round(self._balance + floating, 2)
        return {
            "login": self.login, "trade_mode": 0, "leverage": 100, "limit_orders": 200,
            "margin_so_mode": 0, "trade_allowed": True, "trade_expert": True, "margin_mode": 2,
            "currency_digits": 2, "fifo_close": False, "balance": self._balance, "credit": 0.0,
            "profit": floating, "equity": equity, "margin": margin,
            "margin_free": round(equity - margin, 2),
            "margin_level": round(equity / margin * 100, 2) if margin else 0.0,
            "margin_so_call": 100.0, "margin_so_so": 50.0, "margin_initial": 0.0,
            "margin_maintenance": 0.0, "assets": 0.0, "liabilities": 0.0,
            "commission_blocked": 0.0, "name": f"Demo Trader ({self.cfg.get('label', 'mock')})",
            "server": "MockBroker-Demo", "currency": self.currency, "company": "Mock Broker Ltd (DEMO DATA)",
        }

    def terminal_info(self) -> dict[str, Any]:
        return {
            "connected": True, "trade_allowed": True, "build": 4400, "ping_last": 42000,
            "company": "Mock Broker Ltd", "name": "MetaTrader 5 (mock)",
            "path": self.cfg.get("terminal_path") or "<mock terminal>",
            "data_path": "<mock>", "commondata_path": "<mock>",
        }

    def positions(self) -> list[dict[str, Any]]:
        self._tick_positions()
        return [{k: v for k, v in p.items() if not k.startswith("_")} for p in self._positions]

    def deals(self, date_from: datetime, date_to: datetime) -> list[dict[str, Any]]:
        lo = date_from.timestamp()
        hi = date_to.timestamp()
        return [dict(d) for d in self._deals if lo <= d["time"] <= hi]

    def deals_for_position(self, position_id: int) -> list[dict[str, Any]]:
        return [dict(d) for d in self._deals if d["position_id"] == position_id]
