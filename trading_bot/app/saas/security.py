"""Auth + secret handling for the multi-user beta.

- Passwords: PBKDF2-HMAC-SHA256 (stdlib), per-user salt.
- Exchange API keys: encrypted at rest with Fernet (AES-128-CBC + HMAC),
  using a key derived from SAAS_SECRET_KEY. Keys are only ever decrypted in
  memory at trade time.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import secrets

from cryptography.fernet import Fernet

from ..config import settings

log = logging.getLogger(__name__)

_PBKDF2_ROUNDS = 200_000


# ── signed Telegram deep-link tokens ────────────────────────
# The deep link a user taps to connect Telegram carries their user id. Signing
# it (HMAC) stops anyone forging a link for another user's id and hijacking
# their trade alerts via the webhook.
def _sign(msg: str) -> str:
    key = (settings.saas_secret_key or "DEV-ONLY-INSECURE-KEY").encode()
    return hmac.new(key, msg.encode(), hashlib.sha256).hexdigest()[:16]


def tg_deeplink_payload(uid: int) -> str:
    return f"u{uid}_{_sign('tg:' + str(uid))}"


def verify_tg_payload(payload: str) -> int | None:
    """Return the uid if the payload is a validly-signed deep link, else None."""
    if not payload or not payload.startswith("u") or "_" not in payload:
        return None
    body, _, sig = payload[1:].partition("_")
    if not body.isdigit():
        return None
    if not hmac.compare_digest(sig, _sign("tg:" + body)):
        return None
    return int(body)


# ── passwords ───────────────────────────────────────────────
def hash_password(password: str) -> tuple[str, str]:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return salt.hex(), dk.hex()


def verify_password(password: str, salt_hex: str, hash_hex: str) -> bool:
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return secrets.compare_digest(dk.hex(), hash_hex)


def new_token() -> str:
    return secrets.token_urlsafe(32)


# ── exchange-key encryption ─────────────────────────────────
def _fernet() -> Fernet:
    secret = settings.saas_secret_key
    if not secret:
        # Ephemeral key: works for local testing but does NOT survive restart.
        # Production MUST set SAAS_SECRET_KEY so stored keys remain decryptable.
        secret = "DEV-ONLY-INSECURE-KEY"
        log.warning("SAAS_SECRET_KEY not set — using an ephemeral dev key; "
                    "stored exchange keys will not survive a restart.")
    # Derive a valid 32-byte urlsafe-base64 Fernet key from the secret.
    digest = hashlib.sha256(secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
