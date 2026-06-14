"""Auth + secret handling for the multi-user beta.

- Passwords: PBKDF2-HMAC-SHA256 (stdlib), per-user salt.
- Exchange API keys: encrypted at rest with Fernet (AES-128-CBC + HMAC),
  using a key derived from SAAS_SECRET_KEY. Keys are only ever decrypted in
  memory at trade time.
"""
from __future__ import annotations

import base64
import hashlib
import logging
import secrets

from cryptography.fernet import Fernet

from ..config import settings

log = logging.getLogger(__name__)

_PBKDF2_ROUNDS = 200_000


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
