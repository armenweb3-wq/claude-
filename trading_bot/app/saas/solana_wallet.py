"""Solana dedicated-wallet generation (no heavy SDK dependency).

For the memecoins market the bot generates a FRESH, dedicated Solana wallet per
user (BonkBot/Trojan model). We never touch the user's main wallet — they fund
this one with only what they're willing to trade, and can export it into their
own Solflare to keep ultimate control / withdraw at any time.

A Solana wallet is an ed25519 keypair:
- address   = base58(public key, 32 bytes)
- secret    = base58(seed 32B + public 32B)  ← the 64-byte form Phantom/Solflare
              accept when you "import private key"

The secret is generated here and immediately encrypted at rest by the caller
(``saas.security``); it is never logged or stored in the clear.
"""
from __future__ import annotations

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(raw: bytes) -> str:
    n = int.from_bytes(raw, "big")
    out = ""
    while n > 0:
        n, r = divmod(n, 58)
        out = _B58[r] + out
    pad = 0
    for byte in raw:
        if byte == 0:
            pad += 1
        else:
            break
    return _B58[0] * pad + out


def b58decode(s: str) -> bytes:
    n = 0
    for ch in s:
        n = n * 58 + _B58.index(ch)
    full = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    pad = 0
    for ch in s:
        if ch == _B58[0]:
            pad += 1
        else:
            break
    return b"\x00" * pad + full


def generate_wallet() -> dict:
    """Return a fresh wallet: {address, secret_key} both base58."""
    sk = Ed25519PrivateKey.generate()
    seed = sk.private_bytes(serialization.Encoding.Raw,
                            serialization.PrivateFormat.Raw,
                            serialization.NoEncryption())          # 32 bytes
    pub = sk.public_key().public_bytes(serialization.Encoding.Raw,
                                       serialization.PublicFormat.Raw)  # 32 bytes
    return {"address": b58encode(pub), "secret_key": b58encode(seed + pub)}
