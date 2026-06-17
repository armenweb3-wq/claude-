"""Multi-user beta API (auth, onboarding, key connect, payment, admin).

Mounted under /app and fully separate from the single-user /control surface,
so it cannot affect the existing live bot.
"""
from __future__ import annotations

import datetime as dt
import pathlib

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..config import settings
from . import security
from .keycheck import verify_bybit_key
from .store import Store

router = APIRouter(prefix="/app")
_WEB = pathlib.Path(__file__).parent / "web"

_store: Store | None = None


def store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store


# ── auth helpers ────────────────────────────────────────────
def current_user(request: Request) -> dict:
    token = request.cookies.get("sid") or request.headers.get("X-Session", "")
    user = store().user_for_session(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="not logged in")
    return user


def _is_admin_user(user: dict) -> bool:
    """Admin if flagged in the DB OR the email matches SAAS_ADMIN_EMAIL.

    The env match is evaluated live so the configured admin always has access,
    even if they registered before the var was set (the stored flag is fixed
    at registration time and can otherwise get stuck as non-admin)."""
    if user.get("is_admin"):
        return True
    admin = settings.saas_admin_email
    return bool(admin) and (user.get("email") or "").strip().lower() == admin


def require_admin(request: Request) -> dict:
    user = current_user(request)
    if not _is_admin_user(user):
        raise HTTPException(status_code=403, detail="admin only")
    return user


def _set_cookie(resp: Response, token: str, request: Request) -> None:
    # secure only over https (so local/test http still works)
    secure = request.url.scheme == "https"
    resp.set_cookie("sid", token, httponly=True, samesite="lax",
                    secure=secure, max_age=60 * 60 * 24 * 30, path="/")


# ── request models ──────────────────────────────────────────
class Creds(BaseModel):
    email: str
    password: str
    username: str | None = None
    ref: str | None = None


class ProfileIn(BaseModel):
    username: str | None = None
    avatar: str | None = None  # data URL, or "" to clear


class PasswordIn(BaseModel):
    new_password: str


class Keys(BaseModel):
    api_key: str
    api_secret: str
    testnet: bool = False


class SettingsIn(BaseModel):
    risk_pct: float = 2.0
    symbols: str = ",".join(settings.symbols) or "BTCUSDT"
    enabled: bool = False


class PaymentIn(BaseModel):
    tx_hash: str


class ActivateIn(BaseModel):
    user_id: int
    days: int = 30


class UserId(BaseModel):
    user_id: int


# ── static / shell ──────────────────────────────────────────
# The shell carries the app's JS, which changes on deploy — never let a browser
# serve a stale copy (that was hiding the admin panel after updates).
_NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate"}


@router.get("")
def app_shell() -> FileResponse:
    return FileResponse(_WEB / "app.html", headers=_NO_CACHE)


@router.get("/manifest.webmanifest")
def manifest() -> FileResponse:
    return FileResponse(_WEB / "manifest.webmanifest", media_type="application/manifest+json")


@router.get("/sw.js")
def service_worker() -> FileResponse:
    return FileResponse(_WEB / "sw.js", media_type="application/javascript")


@router.get("/icon.svg")
def icon() -> FileResponse:
    return FileResponse(_WEB / "icon.svg", media_type="image/svg+xml")


@router.get("/legal")
def legal() -> FileResponse:
    return FileResponse(_WEB / "legal.html")


# ── auth ────────────────────────────────────────────────────
@router.post("/api/register")
def register(body: Creds, response: Response, request: Request) -> dict:
    email = body.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(400, "enter a valid email")
    if len(body.password) < 8:
        raise HTTPException(400, "password must be at least 8 characters")
    st = store()
    if st.get_user_by_email(email):
        raise HTTPException(400, "an account with that email already exists")
    is_admin = bool(settings.saas_admin_email) and email == settings.saas_admin_email
    if not is_admin and st.seats_left() <= 0:
        raise HTTPException(403, f"the beta is full ({settings.saas_seat_limit} seats). "
                                 "Ask for a spot to open up.")
    username = (body.username or "").strip() or email.split("@")[0]
    ref = (body.ref or "").strip().lower() or None
    salt, pw_hash = security.hash_password(body.password)
    user = st.create_user(email, salt, pw_hash, is_admin, username=username, referred_by=ref)
    token = security.new_token()
    st.create_session(token, user["id"])
    _set_cookie(response, token, request)
    return {"ok": True, "token": token, "is_admin": is_admin}


@router.post("/api/login")
def login(body: Creds, response: Response, request: Request) -> dict:
    st = store()
    user = st.get_user_by_email(body.email.strip().lower())
    if not user or not security.verify_password(body.password, user["pw_salt"], user["pw_hash"]):
        raise HTTPException(401, "wrong email or password")
    token = security.new_token()
    st.create_session(token, user["id"])
    _set_cookie(response, token, request)
    return {"ok": True, "token": token, "is_admin": _is_admin_user(user)}


@router.post("/api/logout")
def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get("sid") or request.headers.get("X-Session", "")
    if token:
        store().delete_session(token)
    response.delete_cookie("sid", path="/")
    return {"ok": True}


@router.get("/api/recover")
def recover_password(email: str, key: str, new: str) -> dict:
    """Self-service password reset gated by SAAS_SECRET_KEY (the operator holds
    it). GET so it can be run from a phone's address bar. There is no email
    delivery yet, so this is the recovery path for a forgotten password."""
    import hmac

    if not settings.saas_secret_key or not hmac.compare_digest(key, settings.saas_secret_key):
        raise HTTPException(403, "invalid key")
    if len(new) < 8:
        raise HTTPException(400, "new password must be at least 8 characters")
    st = store()
    user = st.get_user_by_email(email.strip().lower())
    if not user:
        raise HTTPException(404, "no account with that email")
    salt, pw_hash = security.hash_password(new)
    st.set_password(user["id"], salt, pw_hash)
    return {"ok": True, "message": "password updated — you can now log in"}


def _is_active(user: dict) -> bool:
    if _is_admin_user(user):  # the operator is always active
        return True
    if not user["activated"]:
        return False
    if user["active_until"]:
        try:
            return dt.date.fromisoformat(user["active_until"]) >= dt.date.today()
        except ValueError:
            return True
    return True


@router.get("/api/bot")
def bot_status(request: Request) -> dict:
    user = current_user(request)
    runner = getattr(request.app.state, "saas_runner", None)
    res = runner.results.get(user["id"]) if runner else None
    return {"running": runner is not None, "dry_run": settings.saas_dry_run,
            "last_run": res}


@router.get("/api/dashboard")
def dashboard(request: Request) -> dict:
    """Everything the user's live dashboard needs in one call: their equity,
    open positions, latest signals/market, and BTC cycle context."""
    user = current_user(request)
    st = store()
    uid = user["id"]
    cfg = st.get_settings(uid)
    keys = st.get_keys(uid)
    runner = getattr(request.app.state, "saas_runner", None)
    res = runner.results.get(uid) if runner else None

    from . import live as live_mod

    live_data = {"equity": 0.0, "open_pnl": 0.0, "open_positions": 0, "positions": []}
    live_err = None
    if keys:
        try:
            live_data = live_mod.positions_snapshot(uid, keys)
        except Exception as exc:  # surface, never 500 the dashboard
            live_err = f"live data unavailable: {exc}"

    from ..strategy.cycle import assess_cycle

    cyc = assess_cycle()
    return {
        "active": _is_active(user),
        "enabled": bool(cfg["enabled"]),
        "has_keys": bool(keys),
        "running": runner is not None,
        "dry_run": settings.saas_dry_run,
        "equity": live_data["equity"],
        "open_pnl": live_data["open_pnl"],
        "open_positions": live_data["open_positions"],
        "positions": live_data["positions"],
        "signals": (res or {}).get("signals", {}),
        "market": (res or {}).get("market"),
        "error": live_err or (res or {}).get("error"),
        "symbols": [s.strip() for s in cfg["symbols"].split(",") if s.strip()],
        "cycle": {
            "phase": cyc.phase,
            "months_since_halving": round(cyc.months_since_halving, 1),
            "months_to_next_halving": round(cyc.months_to_next_halving, 1),
            "note": cyc.note,
        },
    }


@router.get("/api/history")
def user_history(request: Request) -> dict:
    user = current_user(request)
    keys = store().get_keys(user["id"])
    empty = {"wins": 0, "losses": 0, "total": 0, "win_rate": 0.0, "realized_pnl": 0}
    if not keys:
        return {"trades": [], "stats": empty}
    from . import live as live_mod

    try:
        return live_mod.history_snapshot(user["id"], keys)
    except Exception as exc:
        raise HTTPException(502, f"history unavailable: {exc}")


class RedeemIn(BaseModel):
    code: str


@router.post("/api/redeem")
def redeem(body: RedeemIn, request: Request) -> dict:
    """Activate the current user for free by entering the shared access code."""
    import hmac

    user = current_user(request)
    code = (body.code or "").strip()
    if not settings.saas_access_code or not hmac.compare_digest(code, settings.saas_access_code):
        raise HTTPException(400, "invalid access code")
    store().set_activation(user["id"], True, None)  # no expiry
    return {"ok": True}


@router.post("/api/profile")
def update_profile(body: ProfileIn, request: Request) -> dict:
    user = current_user(request)
    st = store()
    if body.username is not None and body.username.strip():
        st.set_username(user["id"], body.username.strip())
    if body.avatar is not None:
        av = body.avatar.strip()
        if av and len(av) > 400_000:
            raise HTTPException(400, "image too large — please pick a smaller one")
        st.set_avatar(user["id"], av or None)
    return {"ok": True}


@router.post("/api/password")
def change_password(body: PasswordIn, request: Request) -> dict:
    user = current_user(request)
    if len(body.new_password) < 8:
        raise HTTPException(400, "password must be at least 8 characters")
    salt, pw_hash = security.hash_password(body.new_password)
    store().set_password(user["id"], salt, pw_hash)
    return {"ok": True}


# ── manual trading (acts on the user's own account) ─────────
class CloseIn(BaseModel):
    symbol: str


class OpenIn(BaseModel):
    symbol: str
    side: str             # 'long' | 'short'
    notional: float       # USDT to deploy at entry
    leverage: float = 3.0
    stop_pct: float       # required stop-loss distance, % from entry
    tp_pcts: list[float] | None = None  # optional take-profit targets, % gain


def _user_exchange(request: Request):
    user = current_user(request)
    keys = store().get_keys(user["id"])
    if not keys:
        raise HTTPException(400, "connect your exchange keys first")
    if not _is_active(user):
        raise HTTPException(403, "your account isn't active yet")
    from . import live as live_mod
    return user, live_mod._exchange(keys)


@router.post("/api/position/close")
def manual_close(body: CloseIn, request: Request) -> dict:
    _, ex = _user_exchange(request)
    try:
        order = ex.close_position(body.symbol.strip().upper())
    except Exception as exc:
        raise HTTPException(502, f"close failed: {exc}")
    return {"ok": True, "closed": bool(order)}


@router.post("/api/position/open")
def manual_open(body: OpenIn, request: Request) -> dict:
    if settings.saas_dry_run:
        raise HTTPException(400, "manual trading is off while the engine is in test mode")
    _, ex = _user_exchange(request)
    symbol = body.symbol.strip().upper()
    side = body.side.lower()
    if side not in ("long", "short"):
        raise HTTPException(400, "side must be long or short")
    if body.notional <= 0:
        raise HTTPException(400, "enter an amount (USDT) to deploy")
    if body.stop_pct <= 0:
        raise HTTPException(400, "enter a stop-loss % (e.g. 3)")
    lev = max(1.0, min(float(body.leverage or 1), float(settings.max_leverage)))
    try:
        price = ex.last_price(symbol)
    except Exception as exc:
        raise HTTPException(400, f"no price for {symbol}: {exc}")
    if price <= 0:
        raise HTTPException(400, f"no price for {symbol}")
    sign = 1.0 if side == "long" else -1.0
    # Stop/TP prices derived from the live entry and the user's percentages.
    stop_price = round(price * (1 - sign * body.stop_pct / 100), 8)
    qty = body.notional / price
    bside = "Buy" if side == "long" else "Sell"
    valid_tps = [t for t in (body.tp_pcts or []) if t and t > 0]
    frac = (1.0 / len(valid_tps)) if valid_tps else 0.0
    tps = [type("TP", (), {"price": round(price * (1 + sign * t / 100), 8),
                           "close_fraction": frac})()
           for t in valid_tps]
    try:
        res = ex.open_position(symbol=symbol, side=bside, qty=qty, leverage=lev,
                               stop_loss=stop_price, take_profits=tps)
    except Exception as exc:
        raise HTTPException(502, f"order failed: {exc}")
    if not getattr(res, "ok", False):
        raise HTTPException(400, getattr(res, "skipped_reason", "order rejected by exchange"))
    return {"ok": True, "qty": getattr(res, "qty", 0), "leverage": lev}


@router.get("/api/me")
def me(request: Request) -> dict:
    user = current_user(request)
    st = store()
    s = st.get_settings(user["id"])
    pay = st.latest_payment(user["id"])
    return {
        "email": user["email"],
        "username": (user.get("username") or user["email"].split("@")[0]),
        "avatar": user.get("avatar"),
        "referral_count": st.referral_count(user.get("username") or ""),
        "is_admin": _is_admin_user(user),
        "payment_required": settings.pay_required,
        "access_code_enabled": bool(settings.saas_access_code),
        "max_leverage": settings.max_leverage,
        "activated": _is_active(user),
        "active_until": user["active_until"],
        "has_keys": bool(st.get_keys(user["id"])),
        "settings": {"risk_pct": s["risk_pct"], "symbols": s["symbols"],
                     "enabled": bool(s["enabled"])},
        "payment": {"tx_hash": pay["tx_hash"], "status": pay["status"]} if pay else None,
        "pay": {"wallet": settings.pay_wallet_address,
                "coin_network": settings.pay_coin_network,
                "price": settings.pay_price},
        "seats_left": st.seats_left(),
    }


# ── exchange keys ───────────────────────────────────────────
@router.post("/api/keys")
def connect_keys(body: Keys, request: Request) -> dict:
    user = current_user(request)
    ok, msg = verify_bybit_key(body.api_key.strip(), body.api_secret.strip(), body.testnet)
    if not ok:
        raise HTTPException(400, msg)
    store().save_keys(user["id"], security.encrypt(body.api_key.strip()),
                      security.encrypt(body.api_secret.strip()), body.testnet)
    return {"ok": True}


@router.delete("/api/keys")
def remove_keys(request: Request) -> dict:
    store().delete_keys(current_user(request)["id"])
    return {"ok": True}


# ── settings ────────────────────────────────────────────────
@router.post("/api/settings")
def save_settings(body: SettingsIn, request: Request) -> dict:
    user = current_user(request)
    risk = max(0.5, min(10.0, body.risk_pct))
    store().save_settings(user["id"], risk, body.symbols, body.enabled)
    return {"ok": True}


# ── payment ─────────────────────────────────────────────────
@router.post("/api/payment")
def submit_payment(body: PaymentIn, request: Request) -> dict:
    user = current_user(request)
    tx = body.tx_hash.strip()
    if len(tx) < 6:
        raise HTTPException(400, "enter the transaction hash from your payment")
    store().add_payment(user["id"], tx)
    return {"ok": True, "status": "pending"}


# ── admin ───────────────────────────────────────────────────
@router.get("/api/admin/users")
def admin_users(admin: dict = Depends(require_admin)) -> dict:
    users = store().list_users()
    for u in users:
        u.pop("pw_hash", None)
        u.pop("pw_salt", None)
        u["active"] = _is_active(u)
    return {"users": users, "seats_left": store().seats_left(),
            "seat_limit": settings.saas_seat_limit}


@router.post("/api/admin/activate")
def admin_activate(body: ActivateIn, admin: dict = Depends(require_admin)) -> dict:
    st = store()
    until = (dt.date.today() + dt.timedelta(days=body.days)).isoformat()
    st.set_activation(body.user_id, True, until)
    pay = st.latest_payment(body.user_id)
    if pay and pay["status"] == "pending":
        st.set_payment_status(pay["id"], "approved")
    return {"ok": True, "active_until": until}


@router.post("/api/admin/deactivate")
def admin_deactivate(body: UserId, admin: dict = Depends(require_admin)) -> dict:
    store().set_activation(body.user_id, False, None)
    return {"ok": True}
