"""FastAPI application: read-only JSON API + static dashboard."""

from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from . import mt5_constants as C
from .config import ACCOUNT_COLORS, DATA_DIR, AccountConfig, Settings
from .history import TradeBook, build_trades, normalize_deals
from .security import COOKIE_NAME, build_middleware
from .stats import (balance_curve, balance_flows, by_session, by_symbol, daily_pl, filter_trades,
                    period_bounds, realized_curve, realized_pl, resolve_timezone, trade_stats)
from .store import EquityStore
from .supervisor import AccountState, Supervisor

log = logging.getLogger("mt5cc.server")
STATIC_DIR = Path(__file__).resolve().parent / "static"


class Analytics:
    """Caches normalised deals + reconstructed trades per account, keyed by
    the worker's deals version so heavy work happens once per history update."""

    def __init__(self):
        self._cache: dict[str, tuple[int, int, list[dict[str, Any]], TradeBook]] = {}

    def get(self, st: AccountState) -> tuple[list[dict[str, Any]], TradeBook]:
        open_ids = tuple(sorted(int(p.get("identifier") or p.get("ticket") or 0) for p in st.positions))
        key_open = hash(open_ids)
        cached = self._cache.get(st.cfg.id)
        if cached and cached[0] == st.deals_version and cached[1] == key_open:
            return cached[2], cached[3]
        deals = normalize_deals(st.deals, st.cfg.server_utc_offset_hours)
        book = build_trades(deals, open_ids)
        self._cache[st.cfg.id] = (st.deals_version, key_open, deals, book)
        return deals, book


def _iso(ts: float | None) -> str | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds")


def _parse_date(value: str | None, tz, end: bool = False) -> float | None:
    if not value:
        return None
    try:
        d = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=tz)
    except ValueError:
        raise HTTPException(400, f"Invalid date '{value}', expected YYYY-MM-DD")
    if end:
        d = d + timedelta(days=1)
    return d.timestamp()


class AuditLog:
    """Append-only record of every trading action requested through the API."""

    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.Lock()

    def write(self, entry: dict[str, Any]) -> None:
        entry = {"ts": _iso(time.time()), **entry}
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self._lock, self.path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, default=str) + "\n")
        except OSError:
            log.exception("Could not write trading audit log")

    def tail(self, n: int = 50) -> list[dict[str, Any]]:
        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()[-n:]
        except OSError:
            return []
        out = []
        for ln in lines:
            try:
                out.append(json.loads(ln))
            except json.JSONDecodeError:
                continue
        return out


INTENT_TTL_S = 120
ORDER_FIELDS = ("symbol", "side", "order_kind", "price", "sizing", "risk_percent", "risk_basis", "lots", "sl_mode", "sl", "tp_mode", "tp", "comment")


def _order_request(body: dict[str, Any]) -> dict[str, Any]:
    return {k: body.get(k) for k in ORDER_FIELDS if body.get(k) not in (None, "")}


def _canonical(acc_id: str, action: str, payload: dict[str, Any]) -> str:
    return f"{acc_id}|{action}|" + json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def create_app(supervisor: Supervisor, settings: Settings, token: str, store: EquityStore) -> FastAPI:
    app = FastAPI(title="MT5 Trading Control Center", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    tz = resolve_timezone(settings.report_timezone)
    analytics = Analytics()
    app.state.analytics = analytics
    host = settings.server.host
    port = settings.server.port
    allowed_hosts = {f"{host}:{port}".lower(), host.lower()}
    if host in ("127.0.0.1", "localhost", "::1"):
        allowed_hosts |= {f"localhost:{port}", f"127.0.0.1:{port}", "localhost", "127.0.0.1"}
    app.middleware("http")(build_middleware(token, allowed_hosts))
    settings_ref: dict[str, Settings] = {"settings": settings}
    audit = AuditLog(DATA_DIR / "trading-audit.jsonl")
    intent_key = hashlib.sha256(("intent:" + token).encode()).digest()

    def make_intent(acc_id: str, action: str, payload: dict[str, Any]) -> dict[str, Any]:
        ts = int(time.time())
        sig = hmac.new(intent_key, f"{ts}|{_canonical(acc_id, action, payload)}".encode(), hashlib.sha256).hexdigest()
        return {"ts": ts, "sig": sig, "expires_in": INTENT_TTL_S}

    def check_intent(acc_id: str, action: str, payload: dict[str, Any], intent: Any) -> None:
        if not isinstance(intent, dict):
            raise HTTPException(400, "Missing confirmation. Preview the order first, then confirm it.")
        try:
            ts = int(intent.get("ts"))
            sig = str(intent.get("sig"))
        except (TypeError, ValueError):
            raise HTTPException(400, "Invalid confirmation.")
        if abs(time.time() - ts) > INTENT_TTL_S:
            raise HTTPException(409, "The preview has expired. Preview the order again.")
        expected = hmac.new(intent_key, f"{ts}|{_canonical(acc_id, action, payload)}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise HTTPException(409, "The order details changed since the preview. Preview again.")

    def trading_status(st: AccountState) -> dict[str, Any]:
        t = st.cfg.trading
        a = st.account or {}
        reasons = []
        if not settings_ref["settings"].trading_enabled:
            reasons.append("Global trading switch is off (Accounts page)")
        if not t.enabled:
            reasons.append("Trading is off for this account (Accounts page > Edit)")
        if a and a.get("trade_allowed") is False:
            reasons.append("Broker reports trading not allowed (investor password or disabled account)")
        if st.terminal and st.terminal.get("trade_allowed") is False:
            reasons.append("Algorithmic trading disabled in the terminal (Tools > Options > Expert Advisors)")
        if st.effective_state(time.time(), settings.refresh_seconds) != "connected":
            reasons.append("Account not connected")
        return {"enabled": not reasons, "reasons": reasons, "limits": {
            "max_risk_percent": t.max_risk_percent, "max_lots": t.max_lots,
            "max_open_positions": t.max_open_positions, "allowed_symbols": t.allowed_symbols,
            "magic": t.magic, "deviation_points": t.deviation_points}}

    def worker_call(acc_id: str, name: str, args: dict[str, Any], timeout: float = 25.0) -> dict[str, Any]:
        res = supervisor.call(acc_id, name, args, timeout=timeout)
        if not res.get("ok"):
            raise HTTPException(422 if res.get("rejected") else 502, res.get("error") or "Worker error")
        return res.get("data") or {}

    def sample_listener(acc_id: str, st: AccountState) -> None:
        store.maybe_sample(acc_id, st.account, settings.equity_sample_seconds)

    supervisor.listeners.append(sample_listener)

    # ------------------------------------------------------------------ #
    def get_state(acc_id: str) -> AccountState:
        st = supervisor.states.get(acc_id)
        if st is None:
            raise HTTPException(404, f"Unknown account '{acc_id}'")
        return st

    def account_summary(st: AccountState) -> dict[str, Any]:
        now = time.time()
        a = st.account or {}
        pub = st.cfg.public_dict()
        pub.update({
            "state": st.effective_state(now, settings.refresh_seconds),
            "message": st.message,
            "last_update": _iso(st.last_snapshot_ts),
            "last_update_age_s": round(now - st.last_snapshot_ts, 1) if st.last_snapshot_ts else None,
            "history_loaded": bool(st.deals),
            "history_from": _iso(st.history_window.get("from")) if st.history_window else None,
            "deals_count": len(st.deals),
            "positions_count": len(st.positions),
            "restarts": st.restarts,
            "trading": trading_status(st),
            "account": {
                "login": a.get("login"), "name": a.get("name"), "server": a.get("server"),
                "company": a.get("company"), "currency": a.get("currency"),
                "currency_digits": a.get("currency_digits", 2),
                "leverage": a.get("leverage"),
                "trade_mode": C.ACCOUNT_TRADE_MODE_NAMES.get(a.get("trade_mode"), None),
                "margin_mode": C.ACCOUNT_MARGIN_MODE_NAMES.get(a.get("margin_mode"), None),
                "balance": a.get("balance"), "equity": a.get("equity"), "credit": a.get("credit"),
                "margin": a.get("margin"), "margin_free": a.get("margin_free"),
                "margin_level": a.get("margin_level"), "floating": a.get("profit"),
                "margin_so_call": a.get("margin_so_call"), "margin_so_so": a.get("margin_so_so"),
            } if a else None,
            "terminal": {
                "connected": st.terminal.get("connected"), "build": st.terminal.get("build"),
                "ping_ms": (st.terminal.get("ping_last") or 0) / 1000 if st.terminal.get("ping_last") else None,
                "company": st.terminal.get("company"), "path": st.terminal.get("path"),
            } if st.terminal else None,
        })
        return pub

    # ------------------------------------------------------------------ #
    @app.get("/auth")
    async def auth(request: Request, token_q: str = Query("", alias="token")):
        import hmac
        if not hmac.compare_digest(token_q.encode(), token.encode()):
            raise HTTPException(401, "Invalid token. Use the link printed by the launcher.")
        resp = RedirectResponse(url="/", status_code=303)
        resp.set_cookie(COOKIE_NAME, token, httponly=True, samesite="strict", secure=False, path="/", max_age=60 * 60 * 24 * 30)
        return resp

    @app.get("/api/overview")
    async def overview():
        accounts = [account_summary(st) for st in supervisor.states.values()]
        live = [a for a in accounts if a["account"]]
        currencies = {a["account"]["currency"] for a in live if a["account"].get("currency")}
        compatible = len(currencies) == 1 and len(live) == len(accounts) and len(accounts) > 0
        combined = None
        if live:
            def s(key):
                return round(sum(float(a["account"].get(key) or 0) for a in live), 2)
            combined = {
                "compatible": compatible,
                "currency": next(iter(currencies)) if len(currencies) == 1 else None,
                "currencies": sorted(currencies),
                "accounts_included": len(live),
                "balance": s("balance") if compatible else None,
                "equity": s("equity") if compatible else None,
                "margin": s("margin") if compatible else None,
                "margin_free": s("margin_free") if compatible else None,
                "floating": s("floating") if compatible else None,
                "positions": sum(a["positions_count"] for a in live),
            }
        # realized today/week/month per account for the overview strip
        for a in accounts:
            st = supervisor.states[a["id"]]
            if st.deals:
                deals, _book = analytics.get(st)
                a["realized"] = {p: realized_pl(deals, *period_bounds(p, tz))["net"] for p in ("day", "week", "month")}
            else:
                a["realized"] = None
        return {
            "version": __version__,
            "server_time": _iso(time.time()),
            "report_timezone": str(tz),
            "refresh_seconds": settings.refresh_seconds,
            "mock_mode": any(st.cfg.mock for st in supervisor.states.values()),
            "setup_needed": not supervisor.states,
            "accounts": accounts,
            "combined": combined,
        }

    @app.get("/api/accounts/{acc_id}/positions")
    async def positions(acc_id: str):
        st = get_state(acc_id)
        offset = st.cfg.server_utc_offset_hours * 3600
        rows = []
        for p in st.positions:
            rows.append({
                "ticket": p.get("ticket"), "symbol": p.get("symbol"),
                "direction": "BUY" if p.get("type") == C.POSITION_TYPE_BUY else "SELL",
                "volume": p.get("volume"), "price_open": p.get("price_open"),
                "price_current": p.get("price_current"), "sl": p.get("sl") or None, "tp": p.get("tp") or None,
                "swap": p.get("swap"), "profit": p.get("profit"),
                "net": round(float(p.get("profit") or 0) + float(p.get("swap") or 0), 2),
                "open_time": _iso((p.get("time") or 0) - offset) if p.get("time") else None,
                "magic": p.get("magic"), "comment": p.get("comment"),
            })
        rows.sort(key=lambda r: r["open_time"] or "", reverse=True)
        return {"account_id": acc_id, "currency": (st.account or {}).get("currency"), "positions": rows,
                "floating_total": round(sum(r["net"] for r in rows), 2), "last_update": _iso(st.last_snapshot_ts)}

    @app.get("/api/accounts/{acc_id}/performance")
    async def performance(acc_id: str, period: str = "month", date_from: str | None = Query(None, alias="from"),
                          date_to: str | None = Query(None, alias="to")):
        st = get_state(acc_id)
        if not st.deals:
            return {"account_id": acc_id, "available": False, "reason": "No deal history loaded yet."}
        deals, book = analytics.get(st)
        if period == "custom":
            start, end = _parse_date(date_from, tz), _parse_date(date_to, tz, end=True)
        else:
            start, end = period_bounds(period, tz)
        trades = filter_trades(book.trades, start=start, end=end)
        curve = realized_curve(trades)
        return {
            "account_id": acc_id, "available": True,
            "currency": (st.account or {}).get("currency"),
            "period": {"name": period, "from": _iso(start), "to": _iso(end)},
            "history_window": {"from": _iso(st.history_window.get("from")), "to": _iso(st.history_window.get("to"))},
            "realized": {p: realized_pl(deals, *period_bounds(p, tz)) for p in ("day", "week", "month", "year")}
                        | {"all": realized_pl(deals, None, None), "period": realized_pl(deals, start, end)},
            "flows": {"period": balance_flows(deals, start, end), "all": balance_flows(deals, None, None)},
            "floating": (st.account or {}).get("profit"),
            "stats": trade_stats(trades),
            "by_symbol": by_symbol(trades),
            "by_session": by_session(trades),
            "daily": daily_pl(deals, tz, start, end),
            "curve": curve,
            "reconciliation": book.reconciliation,
            "incomplete_positions": st.incomplete_positions,
            "notes": [
                "Realized P/L totals are deal-based (profit + commission + swap + fee of every BUY/SELL deal), the same method as the MT5 terminal report.",
                "Trade statistics are built from closed trades reconstructed per position; partial closes count as separate trades.",
                "Drawdown is measured on cumulative closed-trade results and excludes deposits, withdrawals and floating P/L.",
                f"Trading sessions are classified by entry time in UTC (server clock offset {st.cfg.server_utc_offset_hours:+g}h applied).",
            ],
        }

    @app.get("/api/accounts/{acc_id}/balance-curve")
    async def balance_curve_route(acc_id: str):
        st = get_state(acc_id)
        if not st.deals or not st.account:
            return {"available": False, "points": []}
        deals, _ = analytics.get(st)
        return {"available": True, "currency": st.account.get("currency"),
                "points": balance_curve(deals, float(st.account.get("balance") or 0))}

    @app.get("/api/accounts/{acc_id}/equity")
    async def equity(acc_id: str, hours: float = 24):
        get_state(acc_id)
        hours = max(0.1, min(hours, 24 * 90))
        return {"account_id": acc_id, "hours": hours, "samples": store.samples(acc_id, time.time() - hours * 3600)}

    def _trade_rows(acc_ids: list[str], symbol, result, direction, start, end) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for acc_id in acc_ids:
            st = get_state(acc_id)
            if not st.deals:
                continue
            _, book = analytics.get(st)
            cur = (st.account or {}).get("currency")
            for t in filter_trades(book.trades, start=start, end=end, symbol=symbol, result=result, direction=direction):
                d = t.to_dict()
                d.update({"account_id": acc_id, "account_label": st.cfg.label, "currency": cur,
                          "entry_time_iso": _iso(t.entry_time), "exit_time_iso": _iso(t.exit_time)})
                rows.append(d)
        rows.sort(key=lambda r: r["exit_time"], reverse=True)
        return rows

    def _acc_ids(acc_id: str) -> list[str]:
        if acc_id == "all":
            return list(supervisor.states.keys())
        get_state(acc_id)
        return [acc_id]

    @app.get("/api/accounts/{acc_id}/trades")
    async def trades(acc_id: str, symbol: str | None = None, result: str | None = None, direction: str | None = None,
                     date_from: str | None = Query(None, alias="from"), date_to: str | None = Query(None, alias="to"),
                     page: int = 1, page_size: int = 50):
        start, end = _parse_date(date_from, tz), _parse_date(date_to, tz, end=True)
        rows = _trade_rows(_acc_ids(acc_id), symbol, result, direction, start, end)
        page_size = max(10, min(page_size, 500))
        page = max(1, page)
        total = len(rows)
        chunk = rows[(page - 1) * page_size: page * page_size]
        currencies = {r["currency"] for r in rows if r["currency"]}
        summary = {"trades": total, "net": round(sum(r["net"] for r in rows), 2) if len(currencies) <= 1 else None,
                   "wins": sum(1 for r in rows if r["net"] > 0), "losses": sum(1 for r in rows if r["net"] < 0),
                   "volume": round(sum(r["volume"] for r in rows), 2), "currency": next(iter(currencies)) if len(currencies) == 1 else None}
        symbols = sorted({t.symbol for st in supervisor.states.values() if st.deals for t in analytics.get(st)[1].trades})
        return {"page": page, "page_size": page_size, "total": total, "trades": chunk, "summary": summary, "symbols": symbols}

    @app.get("/api/accounts/{acc_id}/trades.csv")
    async def trades_csv(acc_id: str, symbol: str | None = None, result: str | None = None, direction: str | None = None,
                         date_from: str | None = Query(None, alias="from"), date_to: str | None = Query(None, alias="to")):
        start, end = _parse_date(date_from, tz), _parse_date(date_to, tz, end=True)
        rows = _trade_rows(_acc_ids(acc_id), symbol, result, direction, start, end)
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(["account", "position_id", "symbol", "direction", "entry_time_utc", "exit_time_utc", "entry_price",
                    "exit_price", "volume", "gross_pl", "commission", "swap", "fee", "net_pl", "currency",
                    "partial_close", "reversal", "incomplete", "exit_deal_ticket", "comment"])
        for r in rows:
            w.writerow([r["account_label"], r["position_id"], r["symbol"], r["direction"], r["entry_time_iso"] or "",
                        r["exit_time_iso"], r["entry_price"] if r["entry_price"] is not None else "", r["exit_price"],
                        r["volume"], f"{r['gross']:.2f}", f"{r['commission']:.2f}", f"{r['swap']:.2f}", f"{r['fee']:.2f}",
                        f"{r['net']:.2f}", r["currency"] or "", int(r["partial"]), int(r["reversal"]), int(r["incomplete"]),
                        r["exit_ticket"], r["comment"]])
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        headers = {"Content-Disposition": f'attachment; filename="trades-{acc_id}-{stamp}.csv"'}
        return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv; charset=utf-8", headers=headers)

    @app.get("/api/accounts/{acc_id}/balance-ops")
    async def balance_ops(acc_id: str):
        st = get_state(acc_id)
        if not st.deals:
            return {"operations": []}
        _, book = analytics.get(st)
        ops = sorted(book.balance_ops, key=lambda o: o["time"], reverse=True)
        for o in ops:
            o["time_iso"] = _iso(o["time"])
        return {"operations": ops, "currency": (st.account or {}).get("currency")}

    @app.get("/api/diagnostics")
    async def diagnostics():
        now = time.time()
        out = []
        for st in supervisor.states.values():
            proc = supervisor._procs.get(st.cfg.id)
            out.append({
                **account_summary(st),
                "worker_pid": proc.pid if proc else None,
                "worker_alive": bool(proc and proc.is_alive()),
                "worker_uptime_s": round(now - st.started_ts),
                "last_heartbeat_age_s": round(now - st.last_heartbeat_ts, 1) if st.last_heartbeat_ts else None,
                "last_history_update": _iso(st.last_deals_ts),
                "deals_version": st.deals_version,
                "incomplete_positions": st.incomplete_positions,
                "reconciliation": analytics.get(st)[1].reconciliation if st.deals else None,
                "logs": [{**l, "time": _iso(l["ts"])} for l in list(st.logs)[-60:]],
            })
        return {"accounts": out, "settings": {**settings_ref["settings"].to_dict(), "report_timezone_resolved": str(tz)},
                "security": {"bind": f"{host}:{port}", "token_protected": True, "loopback_only": host in ("127.0.0.1", "localhost", "::1"),
                             "trading_global": settings_ref["settings"].trading_enabled,
                             "trading_accounts": [st.cfg.id for st in supervisor.states.values() if trading_status(st)["enabled"]]},
                "audit": audit.tail(40)}

    @app.post("/api/accounts/{acc_id}/reconnect")
    async def reconnect(acc_id: str):
        get_state(acc_id)
        return {"ok": supervisor.send_command(acc_id, "reconnect")}

    @app.post("/api/accounts/{acc_id}/refresh-history")
    async def refresh_history(acc_id: str):
        get_state(acc_id)
        return {"ok": supervisor.send_command(acc_id, "refresh_history")}

    # ------------------------------------------------------------------ #
    # Trading
    # ------------------------------------------------------------------ #
    @app.get("/api/accounts/{acc_id}/trading")
    async def trading_info(acc_id: str):
        st = get_state(acc_id)
        symbols = sorted({d.get("symbol") for d in st.deals if d.get("symbol")} | {p.get("symbol") for p in st.positions if p.get("symbol")})
        return {"account_id": acc_id, "status": trading_status(st), "currency": (st.account or {}).get("currency"),
                "equity": (st.account or {}).get("equity"), "margin_free": (st.account or {}).get("margin_free"),
                "known_symbols": symbols, "audit": [e for e in audit.tail(100) if e.get("account") == acc_id][-20:]}

    @app.post("/api/accounts/{acc_id}/symbol")
    async def symbol_lookup(acc_id: str, body: dict[str, Any] = Body(...)):
        get_state(acc_id)
        return worker_call(acc_id, "symbol_info", {"symbol": body.get("symbol")}, timeout=15)

    @app.post("/api/accounts/{acc_id}/orders/preview")
    async def order_preview(acc_id: str, body: dict[str, Any] = Body(...)):
        st = get_state(acc_id)
        status = trading_status(st)
        if not status["enabled"]:
            raise HTTPException(403, "Trading is disabled for this account: " + "; ".join(status["reasons"]))
        req = _order_request(body)
        data = worker_call(acc_id, "trade_preview", req)
        data["intent"] = make_intent(acc_id, "order", req)
        data["request_echo"] = req
        return data

    @app.post("/api/accounts/{acc_id}/orders")
    async def order_execute(acc_id: str, body: dict[str, Any] = Body(...)):
        st = get_state(acc_id)
        status = trading_status(st)
        if not status["enabled"]:
            raise HTTPException(403, "Trading is disabled for this account: " + "; ".join(status["reasons"]))
        req = _order_request(body)
        check_intent(acc_id, "order", req, body.get("intent"))
        expected = body.get("expected") or {}
        args = {**req, "expected": {k: expected.get(k) for k in ("symbol", "order_type", "volume")}}
        audit.write({"account": acc_id, "action": "order", "request": req, "stage": "sent"})
        try:
            data = worker_call(acc_id, "trade_execute", args, timeout=60)
        except HTTPException as exc:
            audit.write({"account": acc_id, "action": "order", "request": req, "stage": "rejected", "error": exc.detail})
            raise
        audit.write({"account": acc_id, "action": "order", "request": req, "stage": "result", "ok": data.get("ok"),
                     "result": data.get("result"), "plan": data.get("plan")})
        return data

    @app.post("/api/accounts/{acc_id}/positions/{ticket}/close")
    async def close_position(acc_id: str, ticket: int, body: dict[str, Any] = Body(default={})):
        st = get_state(acc_id)
        status = trading_status(st)
        if not status["enabled"]:
            raise HTTPException(403, "Trading is disabled for this account: " + "; ".join(status["reasons"]))
        if body.get("confirm") is not True:
            raise HTTPException(400, "Close requests must be confirmed.")
        vol = body.get("volume")
        args = {"ticket": ticket, "volume": vol if vol not in (None, "") else None}
        audit.write({"account": acc_id, "action": "close", "request": args, "stage": "sent"})
        try:
            data = worker_call(acc_id, "close_position", args, timeout=60)
        except HTTPException as exc:
            audit.write({"account": acc_id, "action": "close", "request": args, "stage": "rejected", "error": exc.detail})
            raise
        audit.write({"account": acc_id, "action": "close", "request": args, "stage": "result", "ok": data.get("ok"), "result": data.get("result")})
        return data

    @app.post("/api/accounts/{acc_id}/positions/{ticket}/modify")
    async def modify_position(acc_id: str, ticket: int, body: dict[str, Any] = Body(...)):
        st = get_state(acc_id)
        status = trading_status(st)
        if not status["enabled"]:
            raise HTTPException(403, "Trading is disabled for this account: " + "; ".join(status["reasons"]))
        args = {"ticket": ticket, "sl": body.get("sl"), "tp": body.get("tp")}
        audit.write({"account": acc_id, "action": "modify", "request": args, "stage": "sent"})
        try:
            data = worker_call(acc_id, "modify_position", args, timeout=60)
        except HTTPException as exc:
            audit.write({"account": acc_id, "action": "modify", "request": args, "stage": "rejected", "error": exc.detail})
            raise
        audit.write({"account": acc_id, "action": "modify", "request": args, "stage": "result", "ok": data.get("ok"), "result": data.get("result")})
        return data

    # ------------------------------------------------------------------ #
    @app.get("/")
    async def index():
        return FileResponse(STATIC_DIR / "index.html")

    install_setup_routes(app, supervisor, settings_ref)
    install_bot_routes(app, supervisor, settings_ref, audit, trading_status, worker_call)
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    return app


# --------------------------------------------------------------------------- #
# Guided setup (Accounts page)
# --------------------------------------------------------------------------- #

def install_setup_routes(app: FastAPI, supervisor: Supervisor, settings_ref: dict[str, Settings]) -> None:
    from . import setup as S
    from .config import ConfigError, load_settings, parse_accounts

    pending: dict[str, dict[str, Any]] = {}

    def sanitized(entry: dict[str, Any]) -> dict[str, Any]:
        e = {k: v for k, v in entry.items() if k not in ("password", "password_env", "password_dpapi")}
        e["has_password"] = any(entry.get(k) for k in ("password", "password_env", "password_dpapi"))
        e["password_store"] = "encrypted (Windows DPAPI)" if entry.get("password_dpapi") else "environment variable" if entry.get("password_env") else "plain text" if entry.get("password") else "none"
        e["managed_copy"] = str(entry.get("terminal_path") or "").lower().startswith(str(S.TERMINALS_DIR).lower())
        st = supervisor.states.get(entry.get("id"))
        e["state"] = st.effective_state(time.time(), settings_ref["settings"].refresh_seconds) if st else "not running"
        e["message"] = st.message if st else ""
        e["live_login"] = (st.account or {}).get("login") if st else None
        e["pending"] = pending.get(entry.get("id"))
        return e

    def parse_one(entry: dict[str, Any]) -> AccountConfig:
        return parse_accounts([entry], settings_ref["settings"])[0]

    @app.get("/api/setup")
    async def setup_info():
        try:
            raw = S.list_raw_accounts()
        except Exception as exc:
            raise HTTPException(500, f"Cannot read accounts.json: {exc}")
        st = settings_ref["settings"]
        return {
            "platform": "windows" if S.IS_WINDOWS else "other",
            "dpapi": S.dpapi_available(),
            "terminals": S.detect_terminals(),
            "terminals_dir": str(S.TERMINALS_DIR),
            "accounts": [sanitized(a) for a in raw],
            "colors": list(ACCOUNT_COLORS),
            "settings": {"trading_enabled": st.trading_enabled, "mock_mode": st.mock_mode, "refresh_seconds": st.refresh_seconds,
                         "history_lookback_days": st.history_lookback_days, "report_timezone": st.report_timezone},
        }

    def _finish_add(entry: dict[str, Any], restart: bool) -> None:
        S.save_account(entry)
        cfg = parse_one(entry)
        if restart or cfg.id in supervisor.states:
            supervisor.restart_account(cfg)
        else:
            supervisor.add_account(cfg)

    @app.post("/api/setup/accounts")
    async def setup_add(body: dict[str, Any] = Body(...)):
        try:
            raw = S.list_raw_accounts()
            existing = {a.get("id") for a in raw}
            entry = S.build_account_entry(body, existing)
            if any(int(a.get("login") or 0) == entry["login"] and (a.get("server") or "").lower() == entry["server"].lower() for a in raw):
                raise ConfigError("That login on that server is already configured.")
            if body.get("make_copy"):
                job = S.copy_terminal(entry["terminal_path"], entry["id"])
                entry["terminal_path"] = job["dest"]
                entry["portable"] = True
                if job["state"] == "done":
                    _finish_add(entry, restart=False)
                    return {"id": entry["id"], "status": "started"}
                pending[entry["id"]] = {"stage": "copying", "message": job["message"], "progress": 0.0}

                def waiter() -> None:
                    while True:
                        st = S.copy_status(entry["id"]) or {}
                        pending[entry["id"]] = {"stage": "copying", "message": st.get("message"), "progress": st.get("progress", 0.0)}
                        if st.get("state") == "done":
                            try:
                                _finish_add(entry, restart=False)
                            except Exception as exc:
                                pending[entry["id"]] = {"stage": "error", "message": str(exc)}
                                return
                            pending.pop(entry["id"], None)
                            return
                        if st.get("state") == "error":
                            pending[entry["id"]] = {"stage": "error", "message": st.get("error")}
                            return
                        time.sleep(0.5)
                threading.Thread(target=waiter, daemon=True).start()
                return {"id": entry["id"], "status": "copying"}
            else:
                others = [a for a in raw if (a.get("terminal_path") or "").lower() == entry["terminal_path"].lower()]
                if others:
                    raise ConfigError(f"That terminal is already used by '{others[0].get('label')}'. One terminal can serve only one account; tick 'make a private copy'.")
                _finish_add(entry, restart=False)
                return {"id": entry["id"], "status": "started"}
        except ConfigError as exc:
            raise HTTPException(422, str(exc))

    @app.get("/api/setup/accounts/{acc_id}/status")
    async def setup_status(acc_id: str):
        raw = next((a for a in S.list_raw_accounts() if a.get("id") == acc_id), None)
        return {"id": acc_id, "pending": pending.get(acc_id), "account": sanitized(raw) if raw else None}

    @app.put("/api/setup/accounts/{acc_id}")
    async def setup_update(acc_id: str, body: dict[str, Any] = Body(...)):
        raw = S.list_raw_accounts()
        current = next((a for a in raw if a.get("id") == acc_id), None)
        if current is None:
            raise HTTPException(404, "Unknown account")
        try:
            entry = S.build_account_entry({**{k: current.get(k) for k in ("label", "login", "server", "terminal_path", "color", "portable", "server_utc_offset_hours")}, **body},
                                          {a.get("id") for a in raw}, current)
            if current.get("mock"):
                entry["mock"] = True
            _finish_add(entry, restart=True)
        except ConfigError as exc:
            raise HTTPException(422, str(exc))
        return {"id": acc_id, "status": "restarted"}

    @app.delete("/api/setup/accounts/{acc_id}")
    async def setup_delete(acc_id: str, delete_copy: bool = False):
        raw = next((a for a in S.list_raw_accounts() if a.get("id") == acc_id), None)
        if raw is None:
            raise HTTPException(404, "Unknown account")
        supervisor.remove_account(acc_id)
        S.delete_account(acc_id)
        pending.pop(acc_id, None)
        removed_copy = False
        if delete_copy:
            folder = Path(str(raw.get("terminal_path") or "")).parent
            if folder.is_dir() and str(folder.resolve()).lower().startswith(str(S.TERMINALS_DIR.resolve()).lower()):
                import shutil
                shutil.rmtree(folder, ignore_errors=True)
                removed_copy = True
        return {"id": acc_id, "removed": True, "removed_copy": removed_copy}

    @app.post("/api/setup/demo")
    async def setup_demo():
        raw = S.list_raw_accounts()
        ids = {a.get("id") for a in raw}
        added = []
        for i, (label, color) in enumerate((("Demo account A", "blue"), ("Demo account B", "orange"))):
            acc_id = f"demo{i + 1}"
            if acc_id in ids:
                continue
            entry = {"id": acc_id, "label": label, "color": color, "mock": True, "enabled": True, "login": 0, "server": "",
                     "trading": {"enabled": True, "max_risk_percent": 2.0, "max_lots": 2.0, "max_open_positions": 10, "allowed_symbols": [], "magic": 700000 + i, "deviation_points": 20}}
            S.save_account(entry)
            supervisor.add_account(parse_one(entry))
            added.append(acc_id)
        return {"added": added}

    @app.get("/api/setup/autostart")
    async def autostart_status():
        from . import autostart
        return autostart.status()

    @app.put("/api/setup/autostart")
    async def autostart_set(body: dict[str, Any] = Body(...)):
        from . import autostart
        try:
            if "enabled" in body:
                return autostart.enable() if body["enabled"] else autostart.disable()
            if body.get("desktop_shortcut"):
                url = getattr(app.state, "dashboard_url", None) or f"http://{settings_ref['settings'].server.host}:{settings_ref['settings'].server.port}/"
                return autostart.create_desktop_shortcut(url)
        except Exception as exc:
            raise HTTPException(422, str(exc))
        raise HTTPException(400, "Nothing to change")

    @app.put("/api/setup/settings")
    async def setup_settings(body: dict[str, Any] = Body(...)):
        allowed = {k: body[k] for k in ("trading_enabled", "mock_mode", "report_timezone", "history_lookback_days", "refresh_seconds") if k in body}
        if not allowed:
            raise HTTPException(400, "Nothing to change")
        S.update_settings(allowed)
        try:
            new_settings = load_settings()
        except ConfigError as exc:
            raise HTTPException(422, str(exc))
        settings_ref["settings"] = new_settings
        supervisor.apply_settings(new_settings)
        return {"ok": True, "settings": {"trading_enabled": new_settings.trading_enabled, "mock_mode": new_settings.mock_mode}}


# --------------------------------------------------------------------------- #
# Trading bot
# --------------------------------------------------------------------------- #

def install_bot_routes(app: FastAPI, supervisor: Supervisor, settings_ref: dict[str, Settings], audit: "AuditLog",
                       trading_status: Any, worker_call: Any) -> None:
    from .bot.engine import DEFAULT_CONFIG
    from .bot.strategies import STRATEGIES, catalogue
    from .config import save_bot_config

    def get_state(acc_id: str) -> AccountState:
        st = supervisor.states.get(acc_id)
        if st is None:
            raise HTTPException(404, f"Unknown account '{acc_id}'")
        return st

    def validate(cfg: dict[str, Any]) -> dict[str, Any]:
        out = {**DEFAULT_CONFIG}
        for k in DEFAULT_CONFIG:
            if k in cfg and cfg[k] is not None:
                out[k] = cfg[k]
        if out["strategy"] not in STRATEGIES:
            raise HTTPException(422, f"Unknown strategy '{out['strategy']}'")
        if out["mode"] not in ("paper", "live"):
            raise HTTPException(422, "mode must be paper or live")
        if out["exits"] not in ("strategy", "fixed"):
            raise HTTPException(422, "exits must be strategy or fixed")
        if out["risk_basis"] not in ("equity", "free_margin", "balance"):
            raise HTTPException(422, "risk_basis must be equity, free_margin or balance")
        try:
            out["sl_percent"] = float(out["sl_percent"]); out["tp_percent"] = float(out["tp_percent"] or 0); out["breakeven_percent"] = float(out["breakeven_percent"] or 0)
        except (TypeError, ValueError):
            raise HTTPException(422, "Exit percentages must be numbers")
        if out["exits"] == "fixed" and out["sl_percent"] <= 0:
            raise HTTPException(422, "Stop-loss percent must be positive")
        syms = out["symbols"]
        if isinstance(syms, str):
            syms = [s.strip() for s in syms.split(",")]
        out["symbols"] = [s.strip().upper() for s in syms if s and s.strip()]
        if not out["symbols"]:
            raise HTTPException(422, "Add at least one symbol")
        if str(out["timeframe"]).upper() not in C.TIMEFRAMES:
            raise HTTPException(422, f"timeframe must be one of {', '.join(C.TIMEFRAMES)}")
        out["timeframe"] = str(out["timeframe"]).upper()
        try:
            out["risk_percent"] = float(out["risk_percent"]); out["max_positions"] = int(out["max_positions"])
            out["max_daily_loss_percent"] = float(out["max_daily_loss_percent"]); out["max_lots"] = float(out["max_lots"])
            out["max_spread_points"] = float(out["max_spread_points"] or 0); out["max_bars_held"] = int(out["max_bars_held"] or 0)
            out["paper_equity"] = float(out["paper_equity"] or 0); out["autostart"] = bool(out["autostart"])
        except (TypeError, ValueError):
            raise HTTPException(422, "Numeric bot settings must be numbers")
        if not (0 < out["risk_percent"] <= 10):
            raise HTTPException(422, "risk_percent must be between 0 and 10")
        if out["max_positions"] < 1 or out["max_lots"] <= 0 or out["max_daily_loss_percent"] < 0:
            raise HTTPException(422, "max_positions must be ≥ 1, max_lots > 0, max_daily_loss_percent ≥ 0")
        out["params"] = {k: v for k, v in (out.get("params") or {}).items() if v not in (None, "")}
        return out

    @app.get("/api/bot/strategies")
    async def bot_strategies():
        return {"strategies": catalogue(), "timeframes": list(C.TIMEFRAMES), "defaults": DEFAULT_CONFIG}

    @app.get("/api/accounts/{acc_id}/bot")
    async def bot_get(acc_id: str):
        st = get_state(acc_id)
        return {"account_id": acc_id, "config": {**DEFAULT_CONFIG, **(st.cfg.bot or {})}, "state": st.bot or None,
                "trading": trading_status(st), "strategies": catalogue(), "timeframes": list(C.TIMEFRAMES),
                "currency": (st.account or {}).get("currency"), "equity": (st.account or {}).get("equity"), "mock": st.cfg.mock}

    @app.put("/api/accounts/{acc_id}/bot/config")
    async def bot_config(acc_id: str, body: dict[str, Any] = Body(...)):
        st = get_state(acc_id)
        cfg = validate(body)
        save_bot_config(acc_id, cfg)
        st.cfg.bot = cfg
        audit.write({"account": acc_id, "action": "bot_config", "request": cfg, "stage": "saved"})
        try:
            state = worker_call(acc_id, "bot", {"op": "config", "config": cfg}, timeout=20)
        except HTTPException as exc:
            if exc.status_code == 502:
                return {"ok": True, "config": cfg, "state": None, "note": "Saved; the worker is not connected yet, it will use this when it connects."}
            raise
        return {"ok": True, "config": cfg, "state": state}

    @app.post("/api/accounts/{acc_id}/bot/start")
    async def bot_start(acc_id: str, body: dict[str, Any] = Body(default={})):
        st = get_state(acc_id)
        mode = str(body.get("mode") or (st.cfg.bot or {}).get("mode") or "paper")
        if mode == "live":
            status = trading_status(st)
            if not status["enabled"]:
                raise HTTPException(403, "Live bot needs trading enabled for this account: " + "; ".join(status["reasons"]))
            if body.get("confirm") != "LIVE":
                raise HTTPException(400, "Type LIVE to confirm starting the bot with real money.")
        audit.write({"account": acc_id, "action": "bot_start", "request": {"mode": mode}, "stage": "sent"})
        state = worker_call(acc_id, "bot", {"op": "start", "mode": mode}, timeout=30)
        cfg = {**DEFAULT_CONFIG, **(st.cfg.bot or {}), "mode": mode}
        st.cfg.bot = cfg
        save_bot_config(acc_id, cfg)
        return {"ok": True, "state": state}

    @app.post("/api/accounts/{acc_id}/bot/stop")
    async def bot_stop(acc_id: str):
        get_state(acc_id)
        audit.write({"account": acc_id, "action": "bot_stop", "stage": "sent"})
        return {"ok": True, "state": worker_call(acc_id, "bot", {"op": "stop"}, timeout=20)}

    @app.post("/api/accounts/{acc_id}/bot/paper-reset")
    async def bot_paper_reset(acc_id: str):
        get_state(acc_id)
        return {"ok": True, "state": worker_call(acc_id, "bot", {"op": "paper_reset"}, timeout=20)}

    @app.get("/api/accounts/{acc_id}/bot/performance")
    async def bot_performance(acc_id: str):
        from .stats import by_symbol, realized_curve, trade_stats
        st = get_state(acc_id)
        magic = (st.bot or {}).get("magic") or int(st.cfg.trading.magic) + 500
        if not st.deals:
            return {"available": False, "magic": magic, "trades": [], "stats": None}
        deals, book = app.state.analytics.get(st)
        trades = [t for t in book.trades if t.magic == magic]
        rows = [{**t.to_dict(), "entry_time_iso": _iso(t.entry_time), "exit_time_iso": _iso(t.exit_time)} for t in trades]
        rows.sort(key=lambda r: r["exit_time"], reverse=True)
        open_pos = [{"symbol": p.get("symbol"), "direction": "BUY" if p.get("type") == C.POSITION_TYPE_BUY else "SELL", "volume": p.get("volume"),
                     "entry": p.get("price_open"), "stop": p.get("sl"), "target": p.get("tp"), "floating": round(float(p.get("profit") or 0) + float(p.get("swap") or 0), 2),
                     "ticket": p.get("ticket")} for p in st.positions if p.get("magic") == magic]
        return {"available": True, "magic": magic, "currency": (st.account or {}).get("currency"), "stats": trade_stats(trades),
                "by_symbol": by_symbol(trades), "curve": realized_curve(trades), "trades": rows[:200], "open_positions": open_pos,
                "floating": round(sum(p["floating"] for p in open_pos), 2)}

    @app.post("/api/accounts/{acc_id}/bot/backtest")
    async def bot_backtest(acc_id: str, body: dict[str, Any] = Body(...)):
        get_state(acc_id)
        args = {"op": "backtest", **{k: body.get(k) for k in ("symbol", "timeframe", "strategy", "params", "bars", "equity", "risk_percent",
                                                               "max_lots", "max_bars_held", "spread_points", "commission_per_lot",
                                                               "exits", "sl_percent", "tp_percent", "breakeven_percent")}}
        if not args.get("symbol"):
            raise HTTPException(422, "symbol is required")
        return worker_call(acc_id, "bot", args, timeout=240)
