"""API-key authentication for the control surface.

A shared secret (CONTROL_API_KEY) is checked against the `X-API-Key`
request header using a constant-time comparison. When no key is configured
the dependency allows the request but the app logs a loud warning on
startup (see main.py) so unprotected exposure is never silent.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from ..config import settings


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not settings.auth_enabled:
        # No key configured: allow (local/dry-run convenience).
        return
    if not x_api_key or not hmac.compare_digest(x_api_key, settings.control_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
