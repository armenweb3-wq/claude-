"""Security for a *local* web application.

Threat model: another program or web page on the same machine (or a page you
visit in your browser) trying to read your trading data through the local
server. Mitigations:

* the server binds to the loopback address by default (settings.json),
* every ``/api`` request needs a random per-installation token, delivered to
  the browser once via the launcher link and then kept in an HttpOnly cookie,
* the ``Host`` header must match the configured bind address (stops DNS
  rebinding attacks from the open internet),
* cross-site requests are rejected via ``Sec-Fetch-Site`` / ``Origin`` checks,
* strict security headers (CSP allows only same-origin assets, no inline
  scripts, no framing),
* the API is read-only except for "reconnect", which is harmless.
"""

from __future__ import annotations

import hmac
import logging
from typing import Awaitable, Callable

from starlette.requests import Request
from starlette.responses import JSONResponse, Response

log = logging.getLogger("mt5cc.security")

COOKIE_NAME = "mt5cc_session"
HEADER_NAME = "x-api-token"

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
        "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}


def _token_ok(presented: str | None, expected: str) -> bool:
    if not presented:
        return False
    return hmac.compare_digest(presented.encode("utf-8"), expected.encode("utf-8"))


def _host_ok(request: Request, allowed_hosts: set[str]) -> bool:
    host = (request.headers.get("host") or "").lower()
    return host in allowed_hosts


def _same_site(request: Request) -> bool:
    site = request.headers.get("sec-fetch-site")
    if site is not None:
        return site in ("same-origin", "none")
    origin = request.headers.get("origin")
    if origin:
        host = request.headers.get("host") or ""
        return origin.lower().endswith("//" + host.lower())
    return True  # non-browser clients (curl, scripts) must present the header token anyway


def build_middleware(token: str, allowed_hosts: set[str]) -> Callable[[Request, Callable[[Request], Awaitable[Response]]], Awaitable[Response]]:
    async def middleware(request: Request, call_next):
        path = request.url.path
        if not _host_ok(request, allowed_hosts):
            log.warning("Rejected request with unexpected Host header: %s", request.headers.get("host"))
            return JSONResponse({"error": "invalid host"}, status_code=421)

        if path.startswith("/api/"):
            if not _same_site(request):
                return JSONResponse({"error": "cross-site request blocked"}, status_code=403)
            presented = request.cookies.get(COOKIE_NAME) or request.headers.get(HEADER_NAME)
            if not _token_ok(presented, token):
                return JSONResponse({"error": "unauthorized", "hint": "Open the dashboard through the link printed by the launcher."}, status_code=401)

        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        return response

    return middleware
