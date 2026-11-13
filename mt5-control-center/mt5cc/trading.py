"""Pure trading logic shared by the worker (execution) and the API (preview):
position sizing, request building and the safety guards.

Nothing in this module talks to MT5. It works on plain dicts so it can be
unit-tested without a terminal.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from . import mt5_constants as C


class TradeRejected(Exception):
    """A request that must not be sent to the broker. The message says why."""


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def round_volume(volume: float, info: dict[str, Any]) -> float:
    step = float(info.get("volume_step") or 0.01)
    vmin = float(info.get("volume_min") or step)
    vmax = float(info.get("volume_max") or 100.0)
    if step <= 0:
        step = 0.01
    lots = math.floor(volume / step + 1e-9) * step
    lots = round(lots, 8)
    if lots < vmin:
        return 0.0
    return min(lots, vmax)


def round_price(price: float, info: dict[str, Any]) -> float:
    digits = int(info.get("digits") or 5)
    return round(price, digits)


def loss_per_lot(sl_distance: float, info: dict[str, Any]) -> float:
    """Money lost per 1.0 lot if price moves ``sl_distance`` against you.
    Uses the symbol's tick size/value, which MT5 reports in the deposit currency."""
    tick_size = float(info.get("trade_tick_size") or info.get("point") or 0)
    tick_value = float(info.get("trade_tick_value") or 0)
    if tick_size <= 0 or tick_value <= 0:
        raise TradeRejected("Symbol has no tick size/value information; cannot size the position.")
    return sl_distance / tick_size * tick_value


def entry_price_for(order_type: int, tick: dict[str, Any], price: float | None) -> float:
    if order_type == C.ORDER_TYPE_BUY:
        return float(tick.get("ask") or 0)
    if order_type == C.ORDER_TYPE_SELL:
        return float(tick.get("bid") or 0)
    if price is None or price <= 0:
        raise TradeRejected("Pending orders need an entry price.")
    return float(price)


def is_long(order_type: int) -> bool:
    return order_type in (C.ORDER_TYPE_BUY, C.ORDER_TYPE_BUY_LIMIT, C.ORDER_TYPE_BUY_STOP)


# --------------------------------------------------------------------------- #
# Plan
# --------------------------------------------------------------------------- #

@dataclass
class OrderPlan:
    symbol: str
    order_type: int
    volume: float
    entry: float
    sl: float | None
    tp: float | None
    risk_amount: float | None
    risk_percent: float | None
    reward_amount: float | None
    sizing: str
    risk_basis: str = "equity"
    basis_amount: float | None = None
    risk_percent_of_equity: float | None = None
    warnings: list[str] = field(default_factory=list)
    loss_per_lot: float | None = None
    requested_lots: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol, "order_type": self.order_type,
            "order_type_name": C.ORDER_TYPE_NAMES.get(self.order_type, str(self.order_type)),
            "direction": "BUY" if is_long(self.order_type) else "SELL",
            "volume": self.volume, "entry": self.entry, "sl": self.sl, "tp": self.tp,
            "risk_amount": round(self.risk_amount, 2) if self.risk_amount is not None else None,
            "risk_percent": round(self.risk_percent, 3) if self.risk_percent is not None else None,
            "reward_amount": round(self.reward_amount, 2) if self.reward_amount is not None else None,
            "rr": round(self.reward_amount / self.risk_amount, 2) if self.reward_amount and self.risk_amount else None,
            "sizing": self.sizing, "risk_basis": self.risk_basis,
            "basis_amount": round(self.basis_amount, 2) if self.basis_amount is not None else None,
            "risk_percent_of_equity": round(self.risk_percent_of_equity, 3) if self.risk_percent_of_equity is not None else None,
            "warnings": self.warnings,
            "loss_per_lot": round(self.loss_per_lot, 2) if self.loss_per_lot is not None else None,
            "requested_lots": self.requested_lots,
        }


def build_plan(req: dict[str, Any], info: dict[str, Any], tick: dict[str, Any], account: dict[str, Any],
               limits: dict[str, Any]) -> OrderPlan:
    """Turn a user request into a concrete, validated order plan.

    ``req`` keys: symbol, side ("BUY"/"SELL"), order_kind ("market"/"limit"/"stop"),
    price (pending only), sizing ("risk"/"lots"), risk_percent,
    risk_basis ("equity"/"balance"/"free_margin" - what the percentage is taken from), lots,
    sl_mode ("points"/"price"/"none"), sl, tp_mode ("points"/"price"/"rr"/"none"), tp.
    """
    symbol = str(req.get("symbol") or "").strip().upper()
    if not symbol:
        raise TradeRejected("Symbol is required.")
    side = str(req.get("side") or "").upper()
    if side not in ("BUY", "SELL"):
        raise TradeRejected("Side must be BUY or SELL.")
    kind = str(req.get("order_kind") or "market").lower()
    order_type = {
        ("BUY", "market"): C.ORDER_TYPE_BUY, ("SELL", "market"): C.ORDER_TYPE_SELL,
        ("BUY", "limit"): C.ORDER_TYPE_BUY_LIMIT, ("SELL", "limit"): C.ORDER_TYPE_SELL_LIMIT,
        ("BUY", "stop"): C.ORDER_TYPE_BUY_STOP, ("SELL", "stop"): C.ORDER_TYPE_SELL_STOP,
    }.get((side, kind))
    if order_type is None:
        raise TradeRejected("Order kind must be market, limit or stop.")

    # --- symbol must be tradeable
    tmode = info.get("trade_mode")
    if tmode == C.SYMBOL_TRADE_MODE_DISABLED or tmode == C.SYMBOL_TRADE_MODE_CLOSEONLY:
        raise TradeRejected(f"Trading in {symbol} is disabled or close-only at the broker.")
    if tmode == C.SYMBOL_TRADE_MODE_LONGONLY and side == "SELL":
        raise TradeRejected(f"{symbol} is long-only.")
    if tmode == C.SYMBOL_TRADE_MODE_SHORTONLY and side == "BUY":
        raise TradeRejected(f"{symbol} is short-only.")
    allowed = [s.upper() for s in (limits.get("allowed_symbols") or [])]
    if allowed and symbol not in allowed:
        raise TradeRejected(f"{symbol} is not in this account's allowed_symbols list.")

    point = float(info.get("point") or 0)
    if point <= 0:
        raise TradeRejected("Symbol has no point size information.")
    entry = entry_price_for(order_type, tick, req.get("price"))
    if entry <= 0:
        raise TradeRejected("No current price for this symbol (market closed or symbol not selected).")
    long = is_long(order_type)
    sign = 1 if long else -1

    # pending orders: sanity of entry vs market
    if kind == "limit":
        ref = float(tick.get("ask") if long else tick.get("bid") or 0)
        if ref and ((long and entry >= ref) or (not long and entry <= ref)):
            raise TradeRejected("A limit order must be placed on the better side of the market (buy below ask, sell above bid).")
    if kind == "stop":
        ref = float(tick.get("ask") if long else tick.get("bid") or 0)
        if ref and ((long and entry <= ref) or (not long and entry >= ref)):
            raise TradeRejected("A stop order must be placed on the worse side of the market (buy above ask, sell below bid).")

    # --- stop loss
    sl_mode = str(req.get("sl_mode") or "none").lower()
    sl: float | None = None
    if sl_mode == "points":
        pts = float(req.get("sl") or 0)
        if pts <= 0:
            raise TradeRejected("Stop-loss distance must be positive.")
        sl = entry - sign * pts * point
    elif sl_mode == "price":
        sl = float(req.get("sl") or 0)
        if sl <= 0:
            raise TradeRejected("Stop-loss price must be positive.")
        if (long and sl >= entry) or (not long and sl <= entry):
            raise TradeRejected("Stop-loss must be below the entry for a buy and above it for a sell.")
    elif sl_mode == "percent":
        pct = float(req.get("sl") or 0)
        if pct <= 0:
            raise TradeRejected("Stop-loss percent must be positive.")
        sl = entry * (1 - sign * pct / 100.0)
    elif sl_mode != "none":
        raise TradeRejected("sl_mode must be points, price, percent or none.")
    if sl is not None:
        sl = round_price(sl, info)
        stops_level = float(info.get("trade_stops_level") or 0) * point
        if stops_level and abs(entry - sl) < stops_level:
            raise TradeRejected(f"Stop-loss is closer than the broker's minimum distance ({info.get('trade_stops_level')} points).")

    # --- sizing
    sizing = str(req.get("sizing") or "risk").lower()
    equity = float(account.get("equity") or 0)
    risk_basis = str(req.get("risk_basis") or "equity").lower()
    basis_amount = {
        "equity": equity,
        "balance": float(account.get("balance") or 0),
        "free_margin": float(account.get("margin_free") or 0),
    }.get(risk_basis)
    if basis_amount is None:
        raise TradeRejected("risk_basis must be equity, balance or free_margin.")
    basis_label = {"equity": "equity", "balance": "balance", "free_margin": "free margin"}[risk_basis]
    max_risk = float(limits.get("max_risk_percent") or 0)
    max_lots = float(limits.get("max_lots") or 0)
    lpl = loss_per_lot(abs(entry - sl), info) if sl is not None else None
    warnings: list[str] = []
    requested_lots = None
    if sizing == "risk":
        if sl is None:
            raise TradeRejected("Risk-based sizing needs a stop-loss; choose fixed lots or set a stop.")
        risk_pct = float(req.get("risk_percent") or 0)
        if risk_pct <= 0:
            raise TradeRejected("Risk percent must be positive.")
        if max_risk and risk_pct > max_risk + 1e-9:
            raise TradeRejected(f"Risk {risk_pct:g}% exceeds this account's max_risk_percent ({max_risk:g}%).")
        if basis_amount <= 0:
            raise TradeRejected(f"Account {basis_label} is not positive; refusing to size a trade.")
        risk_amount = basis_amount * risk_pct / 100.0
        raw = risk_amount / lpl
        volume = round_volume(raw, info)
        if volume <= 0:
            raise TradeRejected(
                f"Risking {risk_pct:g}% ({risk_amount:.2f}) with this stop allows only {raw:.4f} lots, below the "
                f"minimum of {info.get('volume_min')}. Widen the risk or tighten the stop.")
        if volume < raw * 0.999:
            warnings.append(f"Volume rounded down from {raw:.4f} to {volume:g} lots (lot step {info.get('volume_step')}).")
    elif sizing == "lots":
        requested_lots = float(req.get("lots") or 0)
        if requested_lots <= 0:
            raise TradeRejected("Lots must be positive.")
        volume = round_volume(requested_lots, info)
        if volume <= 0:
            raise TradeRejected(f"Lots below the minimum of {info.get('volume_min')}.")
        if abs(volume - requested_lots) > 1e-9:
            warnings.append(f"Volume adjusted from {requested_lots:g} to {volume:g} to match the lot step.")
    else:
        raise TradeRejected("sizing must be risk or lots.")
    if max_lots and volume > max_lots + 1e-9:
        raise TradeRejected(f"Volume {volume:g} exceeds this account's max_lots ({max_lots:g}).")

    risk_amount = lpl * volume if lpl is not None else None
    risk_percent = (risk_amount / basis_amount * 100.0) if (risk_amount is not None and basis_amount > 0) else None
    risk_percent_of_equity = (risk_amount / equity * 100.0) if (risk_amount is not None and equity > 0) else None
    if risk_percent is not None and max_risk and risk_percent > max_risk + 1e-6:
        raise TradeRejected(f"Resulting risk {risk_percent:.2f}% of {basis_label} exceeds max_risk_percent ({max_risk:g}%).")
    if risk_basis != "equity" and risk_percent_of_equity is not None and max_risk and risk_percent_of_equity > max_risk + 1e-6:
        raise TradeRejected(f"Resulting risk is {risk_percent_of_equity:.2f}% of equity, above max_risk_percent ({max_risk:g}%). The cap applies to equity as well as to the chosen basis.")
    if sl is None:
        warnings.append("No stop-loss: the risk of this trade is not capped.")

    # --- take profit
    tp_mode = str(req.get("tp_mode") or "none").lower()
    tp: float | None = None
    if tp_mode == "points":
        pts = float(req.get("tp") or 0)
        if pts <= 0:
            raise TradeRejected("Take-profit distance must be positive.")
        tp = entry + sign * pts * point
    elif tp_mode == "price":
        tp = float(req.get("tp") or 0)
        if tp <= 0:
            raise TradeRejected("Take-profit price must be positive.")
        if (long and tp <= entry) or (not long and tp >= entry):
            raise TradeRejected("Take-profit must be above the entry for a buy and below it for a sell.")
    elif tp_mode == "percent":
        pct = float(req.get("tp") or 0)
        if pct <= 0:
            raise TradeRejected("Take-profit percent must be positive.")
        tp = entry * (1 + sign * pct / 100.0)
    elif tp_mode == "rr":
        if sl is None:
            raise TradeRejected("A reward:risk take-profit needs a stop-loss.")
        rr = float(req.get("tp") or 0)
        if rr <= 0:
            raise TradeRejected("Reward:risk must be positive.")
        tp = entry + sign * abs(entry - sl) * rr
    elif tp_mode != "none":
        raise TradeRejected("tp_mode must be points, price, percent, rr or none.")
    if tp is not None:
        tp = round_price(tp, info)
    reward = loss_per_lot(abs(tp - entry), info) * volume if tp is not None else None

    return OrderPlan(symbol=symbol, order_type=order_type, volume=volume, entry=round_price(entry, info), sl=sl, tp=tp,
                     risk_amount=risk_amount, risk_percent=risk_percent, reward_amount=reward, sizing=sizing,
                     risk_basis=risk_basis, basis_amount=basis_amount, risk_percent_of_equity=risk_percent_of_equity,
                     warnings=warnings, loss_per_lot=lpl, requested_lots=requested_lots)


def choose_filling(info: dict[str, Any]) -> int:
    mode = int(info.get("filling_mode") or 0)
    if mode & C.SYMBOL_FILLING_FOK:
        return C.ORDER_FILLING_FOK
    if mode & C.SYMBOL_FILLING_IOC:
        return C.ORDER_FILLING_IOC
    return C.ORDER_FILLING_RETURN


def build_order_request(plan: OrderPlan, info: dict[str, Any], magic: int, deviation: int, comment: str) -> dict[str, Any]:
    pending = plan.order_type not in (C.ORDER_TYPE_BUY, C.ORDER_TYPE_SELL)
    req: dict[str, Any] = {
        "action": C.TRADE_ACTION_PENDING if pending else C.TRADE_ACTION_DEAL,
        "symbol": plan.symbol,
        "volume": float(plan.volume),
        "type": int(plan.order_type),
        "price": float(plan.entry),
        "deviation": int(deviation),
        "magic": int(magic),
        "comment": (comment or "mt5cc")[:31],
        "type_time": C.ORDER_TIME_GTC,
        "type_filling": choose_filling(info),
    }
    if plan.sl is not None:
        req["sl"] = float(plan.sl)
    if plan.tp is not None:
        req["tp"] = float(plan.tp)
    return req


def build_close_request(position: dict[str, Any], info: dict[str, Any], tick: dict[str, Any], volume: float | None,
                        magic: int, deviation: int) -> dict[str, Any]:
    pos_vol = float(position.get("volume") or 0)
    vol = pos_vol if volume is None else float(volume)
    if vol <= 0 or vol > pos_vol + 1e-9:
        raise TradeRejected(f"Close volume must be between {info.get('volume_min')} and the position volume ({pos_vol:g}).")
    vol = round_volume(vol, info) if vol < pos_vol - 1e-9 else pos_vol
    if vol <= 0:
        raise TradeRejected("Close volume is below the minimum lot.")
    long = position.get("type") == C.POSITION_TYPE_BUY
    return {
        "action": C.TRADE_ACTION_DEAL,
        "symbol": position.get("symbol"),
        "position": int(position.get("ticket")),
        "volume": float(vol),
        "type": C.ORDER_TYPE_SELL if long else C.ORDER_TYPE_BUY,
        "price": float(tick.get("bid") if long else tick.get("ask") or 0),
        "deviation": int(deviation),
        "magic": int(magic),
        "comment": "mt5cc close",
        "type_time": C.ORDER_TIME_GTC,
        "type_filling": choose_filling(info),
    }


def build_modify_request(position: dict[str, Any], info: dict[str, Any], sl: float | None, tp: float | None) -> dict[str, Any]:
    long = position.get("type") == C.POSITION_TYPE_BUY
    cur = float(position.get("price_current") or position.get("price_open") or 0)
    if sl is not None and sl > 0 and cur and ((long and sl >= cur) or (not long and sl <= cur)):
        raise TradeRejected("Stop-loss must be below the current price for a buy and above it for a sell.")
    if tp is not None and tp > 0 and cur and ((long and tp <= cur) or (not long and tp >= cur)):
        raise TradeRejected("Take-profit must be above the current price for a buy and below it for a sell.")
    return {
        "action": C.TRADE_ACTION_SLTP,
        "symbol": position.get("symbol"),
        "position": int(position.get("ticket")),
        "sl": round_price(float(sl), info) if sl else 0.0,
        "tp": round_price(float(tp), info) if tp else 0.0,
    }


def retcode_name(code: int | None) -> str:
    if code is None:
        return "no response"
    return C.TRADE_RETCODE_NAMES.get(int(code), f"retcode {code}")
