"""Multi-user beta API (auth, onboarding, key connect, payment, admin).

Mounted under /app and fully separate from the single-user /control surface,
so it cannot affect the existing live bot.
"""
from __future__ import annotations

import datetime as dt
import pathlib

import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, HTMLResponse
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
    # Secure over https, including behind a TLS-terminating proxy (Render sets
    # X-Forwarded-Proto: https even though the app sees http internally).
    fwd = request.headers.get("x-forwarded-proto", "")
    secure = request.url.scheme == "https" or fwd == "https"
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
    telegram: str | None = None  # Telegram chat ID for alerts, or "" to clear


class PasswordIn(BaseModel):
    new_password: str


class RecoverIn(BaseModel):
    email: str
    key: str
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


@router.get("/icon-{size}.png")
def icon_png(size: str) -> FileResponse:
    if size not in ("180", "192", "512"):
        raise HTTPException(404, "icon not found")
    return FileResponse(_WEB / f"icon-{size}.png", media_type="image/png")


@router.get("/legal")
def legal() -> FileResponse:
    return FileResponse(_WEB / "legal.html")


@router.get("/stats")
def stats_page() -> FileResponse:
    return FileResponse(_WEB / "stats.html", headers=_NO_CACHE)


@router.get("/api/public-stats")
def public_stats() -> dict:
    """Aggregate, anonymised performance for the public marketing page —
    no per-user or dollar detail, just totals and monthly % returns."""
    s = store().platform_stats()
    return {
        "users": s["users"],
        "trades": s["trades"],
        "win_rate": s["win_rate"],
        "since": s["since"],
        "monthly": [{"month": m["month"], "roi_pct": m["roi_pct"],
                     "trades": m["trades"], "win_rate": m["win_rate"]} for m in s["monthly"]],
    }


# ── auth ────────────────────────────────────────────────────
@router.post("/api/register")
def register(body: Creds, response: Response, request: Request) -> dict:
    _rate_limit("register", request, limit=10, window=3600)
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
    if ref and ref == username.strip().lower():
        ref = None  # no self-referral
    salt, pw_hash = security.hash_password(body.password)
    user = st.create_user(email, salt, pw_hash, is_admin, username=username, referred_by=ref)
    token = security.new_token()
    st.create_session(token, user["id"])
    _set_cookie(response, token, request)
    return {"ok": True, "token": token, "is_admin": is_admin}


@router.post("/api/login")
def login(body: Creds, response: Response, request: Request) -> dict:
    _rate_limit("login", request, limit=10, window=300)
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


_recover_attempts: dict = {}  # ip -> (window_start, count), simple rate limit
_rl_buckets: dict = {}        # (name, ip) -> (window_start, count)


def _rate_limit(name: str, request: Request, limit: int, window: int) -> None:
    """Simple in-memory per-IP rate limit. Best-effort (per-process); enough to
    blunt brute force on login/register/redeem. Active only in production
    (DATABASE_URL set) so local dev and the test suite aren't throttled."""
    if not settings.database_url:
        return
    ip = request.client.host if request.client else "?"
    key = (name, ip)
    now = time.time()
    # Bound memory: drop entries whose window has fully elapsed (and hard-cap).
    if len(_rl_buckets) > 5000:
        for k, (s, _c) in list(_rl_buckets.items()):
            if now - s > window:
                _rl_buckets.pop(k, None)
        if len(_rl_buckets) > 10000:
            _rl_buckets.clear()
    start, count = _rl_buckets.get(key, (now, 0))
    if now - start > window:
        start, count = now, 0
    if count >= limit:
        raise HTTPException(429, "too many attempts — please wait a minute and try again")
    _rl_buckets[key] = (start, count + 1)


def _recover_key() -> str:
    # Prefer a dedicated recovery secret; fall back to the encryption key only
    # if no recovery key is configured (backward compatibility).
    return settings.saas_recovery_key or settings.saas_secret_key


@router.get("/recover", include_in_schema=False)
def recover_form() -> HTMLResponse:
    """A tiny form so a password reset can be done from a browser WITHOUT putting
    the secret key or new password in the URL (POSTs the values in the body)."""
    return HTMLResponse(
        """<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>body{background:#0d0e10;color:#eceef2;font-family:system-ui;max-width:420px;margin:40px auto;padding:0 18px}
input{width:100%;box-sizing:border-box;padding:12px;margin:6px 0 14px;border-radius:10px;border:1px solid #2a2c32;background:#17181c;color:#fff}
button{width:100%;padding:13px;border:0;border-radius:10px;background:#4cc08c;color:#06210f;font-weight:700}
h2{font-weight:600}.m{margin-top:14px;font-size:.9rem}</style>
<h2>Reset password</h2>
<label>Email</label><input id=email type=email>
<label>Recovery key</label><input id=key type=password>
<label>New password (8+ chars)</label><input id=pw type=password>
<button onclick="go()">Reset password</button><div class=m id=msg></div>
<script>async function go(){var m=document.getElementById('msg');m.textContent='…';
try{var r=await fetch('/app/api/recover',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({email:email.value,key:key.value,new_password:pw.value})});
var d=await r.json();m.textContent=r.ok?'✓ '+(d.message||'done'):('✕ '+(d.detail||'failed'));
}catch(e){m.textContent='✕ '+e}}</script>""")


@router.post("/api/recover")
def recover_password(body: RecoverIn, request: Request) -> dict:
    """Self-service password reset, gated by the recovery key. POST so the
    secret and new password are in the body (not the URL/logs). Rate-limited and
    returns a generic response so it can't be used to enumerate accounts."""
    import hmac

    # crude per-IP rate limit: 5 attempts / 10 min
    ip = (request.client.host if request.client else "?")
    now = time.time()
    start, count = _recover_attempts.get(ip, (now, 0))
    if now - start > 600:
        start, count = now, 0
    if count >= 5:
        raise HTTPException(429, "too many attempts — try again later")
    _recover_attempts[ip] = (start, count + 1)

    key_required = _recover_key()
    if not key_required or not hmac.compare_digest(body.key, key_required):
        raise HTTPException(403, "invalid key")
    if len(body.new_password) < 8:
        raise HTTPException(400, "new password must be at least 8 characters")
    st = store()
    user = st.get_user_by_email(body.email.strip().lower())
    # Generic success either way — don't reveal whether the email exists.
    if user:
        salt, pw_hash = security.hash_password(body.new_password)
        st.set_password(user["id"], salt, pw_hash)
        st.delete_user_sessions(user["id"])  # lock out any existing sessions
    return {"ok": True, "message": "if that email exists, its password was updated — you can now log in"}


def _is_active(user: dict) -> bool:
    if _is_admin_user(user):  # the operator is always active
        return True
    if not user["activated"]:
        return False
    if user["active_until"]:
        try:
            return dt.date.fromisoformat(user["active_until"]) >= dt.date.today()
        except ValueError:
            return False  # malformed expiry → fail closed (deny), never grant access
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
    realized_today = 0.0
    if keys:
        try:
            live_data = live_mod.positions_snapshot(uid, keys)
        except Exception as exc:  # surface, never 500 the dashboard
            live_err = f"live data unavailable: {exc}"
        try:  # banked (realised) profit from trades closed today + TP-fill counts
            hist = live_mod.history_snapshot(uid, keys)  # cached ~60s
            raw = hist.get("raw", [])
            st.add_closed_trades(uid, raw)
            today = dt.datetime.now(dt.timezone.utc).date().isoformat()
            realized_today = round(sum(
                (t.get("pnl") or 0) for t in hist.get("trades", [])
                if (t.get("closed_at") or "").startswith(today)), 4)
            # how many TPs each open position has actually hit = closing orders
            # for that symbol recorded since the position opened (authoritative,
            # unlike inferring from current price which misses brief touches).
            for p in live_data.get("positions", []):
                ot = p.get("opened_at") or ""
                p["tps_hit"] = (sum(1 for r in raw if r.get("symbol") == p["symbol"]
                                    and (r.get("closed_at") or "") >= ot) if ot else 0)
        except Exception:
            pass

    # Hide symbols Bybit doesn't list (e.g. PEPEUSDT -> 1000PEPEUSDT) from the UI.
    symbols = [s.strip() for s in cfg["symbols"].split(",") if s.strip()]
    if keys:
        try:
            avail = live_mod._exchange(keys).available_symbols()
            if avail:
                symbols = [s for s in symbols if s in avail]
        except Exception:
            pass

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
        "realized_today": realized_today,
        "open_positions": live_data["open_positions"],
        "positions": live_data["positions"],
        "signals": (res or {}).get("signals", {}),
        "market": (res or {}).get("market"),
        "error": live_err or (res or {}).get("error"),
        "symbols": symbols,
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
        data = live_mod.history_snapshot(user["id"], keys)
        store().add_closed_trades(user["id"], data.pop("raw", []))  # accrue raw fills
        return data
    except Exception as exc:
        raise HTTPException(502, f"history unavailable: {exc}")


@router.get("/api/monthly")
def monthly(request: Request) -> dict:
    """Per-month performance, built from accrued closed trades in our DB."""
    user = current_user(request)
    st = store()
    keys = st.get_keys(user["id"])
    if keys:  # opportunistically sync the latest closes before summarising
        from . import live as live_mod
        try:
            data = live_mod.history_snapshot(user["id"], keys)
            st.add_closed_trades(user["id"], data.get("raw", []))
        except Exception:
            pass
    return {"months": st.monthly_summary(user["id"])}


@router.get("/api/monthly_trades")
def monthly_trades(month: str, request: Request) -> dict:
    user = current_user(request)
    return {"trades": store().closed_by_month(user["id"], month)}


class RedeemIn(BaseModel):
    code: str


@router.post("/api/redeem")
def redeem(body: RedeemIn, request: Request) -> dict:
    """Activate the current user for free by entering the shared access code."""
    import hmac

    user = current_user(request)
    _rate_limit("redeem", request, limit=8, window=3600)  # blunt code brute force
    code = (body.code or "").strip()
    if not settings.saas_access_code or not hmac.compare_digest(code, settings.saas_access_code):
        raise HTTPException(400, "invalid access code")
    store().set_activation(user["id"], True, None)  # no expiry
    return {"ok": True}


@router.post("/api/tg-webhook")
async def tg_webhook(request: Request) -> dict:
    """Telegram webhook: when a user taps Start on the deep link (/start u<id>),
    capture their chat ID automatically. Optionally validated by a secret."""
    secret = settings.telegram_webhook_secret
    if secret and request.headers.get("X-Telegram-Bot-Api-Secret-Token") != secret:
        raise HTTPException(403, "bad secret")
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}
    msg = body.get("message") or body.get("edited_message") or {}
    text = (msg.get("text") or "").strip()
    chat = (msg.get("chat") or {}).get("id")
    if chat and text.startswith("/start"):
        parts = text.split(maxsplit=1)
        payload = parts[1].strip() if len(parts) > 1 else ""
        # Bind only on a validly-signed deep link for an existing user — never
        # trust a raw u<id> from the message text (that lets anyone redirect
        # another user's alerts).
        uid = security.verify_tg_payload(payload)
        if uid is not None and store().get_user(uid):
            st = store()
            st.set_telegram(uid, str(chat))
            from . import alerts
            s = st.platform_stats()
            track = (f"\n\nSo far: <b>{s['trades']}</b> trades · <b>{s['win_rate']}%</b> win rate"
                     f" across <b>{s['users']}</b> traders." if s["trades"] else "")
            alerts.notify(str(chat),
                "✅ <b>Welcome to ZENITH</b>\n\n"
                "I trade crypto automatically on your own exchange account — you keep full custody."
                + track +
                "\n\nFrom now you'll get:\n• every trade opened / closed / take-profit\n"
                "• a daily summary at 7pm\n• tips, offers and community updates\n\n"
                "⚠️ High-risk — you can lose money. Past results don't guarantee future ones. Not financial advice.",
                alerts.community_button())
    return {"ok": True}


@router.post("/api/profile")
def update_profile(body: ProfileIn, request: Request) -> dict:
    user = current_user(request)
    st = store()
    if body.username is not None and body.username.strip():
        import re
        uname = body.username.strip()[:30]
        # Restrict to a safe charset (defence-in-depth against stored XSS).
        if not re.fullmatch(r"[A-Za-z0-9 _.\-]+", uname):
            raise HTTPException(400, "username may only use letters, numbers, spaces, _ . -")
        st.set_username(user["id"], uname)
    if body.avatar is not None:
        av = body.avatar.strip()
        if av and len(av) > 400_000:
            raise HTTPException(400, "image too large — please pick a smaller one")
        # Strict: only raster image data URLs (NOT svg — it can carry script/CSS).
        if av and not re.fullmatch(r"data:image/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+", av):
            raise HTTPException(400, "avatar must be a PNG/JPG/WEBP/GIF image")
        st.set_avatar(user["id"], av or None)
    if body.telegram is not None:
        st.set_telegram(user["id"], body.telegram.strip() or None)
    return {"ok": True}


@router.post("/api/password")
def change_password(body: PasswordIn, request: Request, response: Response) -> dict:
    user = current_user(request)
    if len(body.new_password) < 8:
        raise HTTPException(400, "password must be at least 8 characters")
    st = store()
    salt, pw_hash = security.hash_password(body.new_password)
    st.set_password(user["id"], salt, pw_hash)
    # Invalidate every existing session (locks out anyone else), then re-issue a
    # fresh session for this user so they stay logged in on this device.
    st.delete_user_sessions(user["id"])
    token = security.new_token()
    st.create_session(token, user["id"])
    _set_cookie(response, token, request)
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


@router.get("/api/instrument")
def instrument(symbol: str, request: Request) -> dict:
    """Live max leverage + price for a symbol, for the manual trade form."""
    _, ex = _user_exchange(request)
    sym = symbol.strip().upper()
    try:
        return {"symbol": sym, "max_leverage": ex.max_leverage(sym), "last_price": ex.last_price(sym)}
    except Exception as exc:
        raise HTTPException(502, f"lookup failed: {exc}")


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
    # Manual trades may use up to the exchange's real max leverage for the symbol
    # (the user has explicitly accepted the risk); fall back to the bot cap.
    try:
        sym_max = ex.max_leverage(symbol)
    except Exception:
        sym_max = 0.0
    cap = sym_max if sym_max > 0 else float(settings.max_leverage)
    lev = max(1.0, min(float(body.leverage or 1), cap))
    try:
        price = ex.last_price(symbol)
    except Exception as exc:
        raise HTTPException(400, f"no price for {symbol}: {exc}")
    if price <= 0:
        raise HTTPException(400, f"no price for {symbol}")

    # ── risk gates (the manual path must not bypass safety) ──
    # 1. Don't stack a manual trade on a symbol that already has a position —
    #    it would fight the bot's management of that position.
    try:
        existing = ex.get_position(symbol)
        if existing.side:
            raise HTTPException(400, f"you already have an open position on {symbol}")
    except HTTPException:
        raise
    except Exception:
        pass  # if the read fails, fall through (open will still be validated)
    # 2. Affordability: required margin must fit the account balance.
    try:
        equity = ex.get_equity()
    except Exception:
        equity = 0.0
    margin = body.notional / lev
    if equity > 0 and margin > equity * 0.95:
        raise HTTPException(400, f"amount too large: needs ~{margin:.2f} USDT margin "
                                 f"but balance is {equity:.2f} USDT")
    # 3. Daily-loss circuit breaker (same rule as the automated engine).
    now = dt.datetime.now(dt.timezone.utc)
    midnight_ms = int(dt.datetime(now.year, now.month, now.day,
                                  tzinfo=dt.timezone.utc).timestamp() * 1000)
    try:
        rows = ex.closed_pnl(limit=100, start_ms=midnight_ms)
    except Exception as exc:
        # A safety control must FAIL CLOSED — if we can't read today's P&L we
        # refuse the trade rather than risk trading past the loss limit.
        raise HTTPException(503, f"can't verify today's P&L right now: {exc}")
    realized_today = sum((r.get("pnl") or 0) for r in rows)
    if equity > 0 and realized_today <= -(settings.daily_max_loss_pct / 100) * equity:
        raise HTTPException(400, "daily loss limit reached — trading paused until tomorrow")

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
    return {"ok": True, "qty": getattr(res, "qty", 0), "leverage": lev,
            "warning": getattr(res, "warning", "")}


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
        "telegram": user.get("telegram_chat_id") or "",
        "tg_link": (f"https://t.me/{settings.telegram_bot_username}"
                    f"?start={security.tg_deeplink_payload(user['id'])}"
                    if settings.telegram_bot_username else ""),
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
    import re
    user = current_user(request)
    risk = max(0.5, min(10.0, body.risk_pct))
    # Sanitise symbols to an exchange-symbol charset (uppercase A-Z0-9, comma-
    # separated). Prevents anything funky being stored and later rendered.
    syms = [s.strip().upper() for s in (body.symbols or "").split(",") if s.strip()]
    bad = [s for s in syms if not re.fullmatch(r"[A-Z0-9]{2,20}", s)]
    if bad:
        raise HTTPException(400, f"invalid symbol(s): {', '.join(bad)[:60]}")
    if len(syms) > 50:
        raise HTTPException(400, "too many symbols (max 50)")
    store().save_settings(user["id"], risk, ",".join(syms), body.enabled)
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
    st = store()
    users = st.list_users()
    for u in users:
        u.pop("pw_hash", None)
        u.pop("pw_salt", None)
        u["active"] = _is_active(u)
        # Diagnostic: whether keys are connected and the last 4 chars of the API
        # key, so two accounts sharing the SAME exchange key are obvious (the
        # cause of "two accounts show the same balance"). Secret is never shown.
        k = st.get_keys(u["id"])
        u["has_keys"] = bool(k)
        u["key_tail"] = ""
        if k:
            try:
                u["key_tail"] = "…" + security.decrypt(k["enc_key"])[-4:]
            except Exception:
                u["key_tail"] = "?"
    return {"users": users, "seats_left": st.seats_left(),
            "seat_limit": settings.saas_seat_limit}


@router.get("/api/admin/config")
def admin_config(admin: dict = Depends(require_admin)) -> dict:
    """Show the (non-secret) Telegram/marketing config the LIVE server has
    loaded, so the operator can verify env vars actually took effect. Also
    reports whether the community button would render."""
    from . import alerts
    cb = alerts.community_button()
    return {
        "community_link": settings.community_link or "(empty)",
        "community_button_will_show": bool(cb),
        "telegram_channel_id": settings.channel_chat_id or "(empty)",
        "telegram_bot_username": settings.telegram_bot_username or "(empty)",
        "broker_link": settings.broker_link or "(empty)",
        "summary_hour_utc": settings.summary_hour_utc,
        "channel_post_hour_utc": settings.channel_post_hour_utc,
        "channel_auto_post": settings.channel_auto_post,
        "saas_dry_run": settings.saas_dry_run,
        "saas_exec_enabled": settings.saas_exec_enabled,
        # Diagnostics for YOUR (admin) account — why a trade alert might not arrive:
        "your_telegram_connected": bool(admin.get("telegram_chat_id")),
        "your_closed_trades_recorded": store().count_closed(admin["id"]),
        "your_keys_connected": bool(store().get_keys(admin["id"])),
        # Notification outbox health (durable alert delivery):
        "events": store().event_counts(),
    }


# A LIGHTER scope than the full legacy run so it can't OOM/timeout a small
# instance: the traded majors on daily + 4h (daily is where the edge would show).
_BT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"]
_BT_WINDOWS = [("1d", 84), ("4h", 18)]


@router.post("/api/admin/backtest")
def admin_backtest_start(request: Request, admin: dict = Depends(require_admin)) -> dict:
    """Run the strategy backtest on REAL Bybit history (majors × daily/4h), net of
    fees/funding/slippage, vs buy-and-hold — the edge test. Background; poll GET."""
    import threading
    import traceback
    try:
        import pandas as pd
        from ..api.backtest_routes import _run, _state
        from ..backtest.data import fetch_bybit
        st = _state(request)
        if st["status"] == "running":
            return {"status": "running", "message": "a backtest is already in progress"}
        # Synchronous probe so a data-access problem returns a CLEAR reason now,
        # instead of the worker thread dying and the poll returning a blank 500.
        probe_start = (pd.Timestamp.utcnow() - pd.DateOffset(days=400)).strftime("%Y-%m-%d")
        try:
            df = fetch_bybit("BTCUSDT", "1d", start=probe_start)
        except Exception as exc:
            raise HTTPException(502, f"market-data fetch failed from the server: {exc}")
        if df is None or len(df) < 100:
            raise HTTPException(502, "the server can't pull Bybit candle history "
                                     f"(got {0 if df is None else len(df)} bars). "
                                     "Likely a region/IP block on the public data API.")
        st.update(status="running", results=[], error=None,
                  started=dt.datetime.now(dt.timezone.utc).isoformat(), finished=None)
        threading.Thread(target=_run, args=(request.app.state, _BT_SYMBOLS, _BT_WINDOWS),
                         daemon=True).start()
        return {"status": "running", "message": "backtest started"}
    except HTTPException:
        raise
    except Exception as exc:  # surface the real error instead of a blank 500
        raise HTTPException(500, f"could not start backtest: {exc} | {traceback.format_exc()[-400:]}")


@router.get("/api/admin/backtest")
def admin_backtest_status(request: Request, admin: dict = Depends(require_admin)) -> dict:
    try:
        from ..api.backtest_routes import _state
        st = _state(request)
        # Snapshot so JSON serialisation can't race the worker thread.
        return {"status": st.get("status"), "error": st.get("error"),
                "started": st.get("started"), "finished": st.get("finished"),
                "results": list(st.get("results") or [])}
    except Exception as exc:
        raise HTTPException(500, f"status read failed: {exc}")


@router.get("/api/admin/stats")
def admin_stats(admin: dict = Depends(require_admin)) -> dict:
    """Platform-wide performance + user counts (proof / marketing)."""
    st = store()
    users = st.list_users()
    active = sum(1 for u in users if _is_active(u))
    data = st.platform_stats()
    data["active_users"] = active
    return data




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
