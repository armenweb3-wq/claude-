"""Solana on-chain execution for the memecoins market (Jupiter + RPC).

Drives the user's dedicated wallet: read balance/holdings, swap SOL↔token via
Jupiter, and withdraw SOL back to the user's own wallet (cash out). The signing
keypair is reconstructed from the encrypted secret only inside this process.

IMPORTANT — verification status: this can't be exercised from CI (no Solana
network), so all HTTP/RPC goes through an injectable ``http`` callable that tests
fake, and the signing step is isolated in ``_sign_and_send`` so tests stub it.
Jupiter is **mainnet-only** — verify signing/transfers on devnet, then a TINY
mainnet swap before any client funds.
"""
from __future__ import annotations

import base64
import logging

from .solana_wallet import b58decode, b58encode

log = logging.getLogger(__name__)

SOL_MINT = "So11111111111111111111111111111111111111112"
TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"


def _default_http():
    import requests
    session = requests.Session()

    def _call(method: str, url: str, params=None, json=None):
        r = session.request(method, url, params=params, json=json, timeout=20)
        r.raise_for_status()
        return r.json() if r.content else {}
    return _call


class JupiterExecutor:
    def __init__(self, secret_key_b58: str, rpc_url: str, jupiter_url: str,
                 http=None) -> None:
        self._secret = secret_key_b58
        self.rpc_url = rpc_url
        self.jup = jupiter_url.rstrip("/")
        self._http = http or _default_http()
        # Public key is the trailing 32 bytes of the 64-byte secret — derive it
        # without needing the signing library (handy for read-only calls/tests).
        self.pubkey = b58encode(b58decode(secret_key_b58)[32:])

    # ── RPC reads ───────────────────────────────────────────
    def _rpc(self, method: str, params: list):
        return self._http("POST", self.rpc_url,
                          json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params})

    def get_balance_sol(self) -> float:
        res = self._rpc("getBalance", [self.pubkey])
        return (res.get("result") or {}).get("value", 0) / 1e9

    def get_token_balances(self) -> list[dict]:
        res = self._rpc("getTokenAccountsByOwner",
                        [self.pubkey, {"programId": TOKEN_PROGRAM}, {"encoding": "jsonParsed"}])
        out = []
        for acc in (res.get("result") or {}).get("value", []):
            try:
                info = acc["account"]["data"]["parsed"]["info"]
                amt = info["tokenAmount"]
                out.append({"mint": info["mint"],
                            "amount": float(amt.get("uiAmount") or 0),
                            "raw": int(amt.get("amount") or 0),
                            "decimals": int(amt.get("decimals") or 0)})
            except Exception:  # malformed account — skip
                continue
        return [t for t in out if t["raw"] > 0]

    # ── Jupiter swaps ───────────────────────────────────────
    def quote(self, input_mint: str, output_mint: str, amount: int, slippage_bps: int):
        return self._http("GET", f"{self.jup}/v6/quote", params={
            "inputMint": input_mint, "outputMint": output_mint,
            "amount": int(amount), "slippageBps": int(slippage_bps)})

    def swap(self, quote_response: dict) -> str:
        r = self._http("POST", f"{self.jup}/v6/swap", json={
            "quoteResponse": quote_response, "userPublicKey": self.pubkey,
            "wrapAndUnwrapSol": True})
        swap_tx = r.get("swapTransaction")
        if not swap_tx:
            raise RuntimeError("jupiter returned no transaction")
        return self._sign_and_send(swap_tx)

    def buy(self, output_mint: str, sol_amount: float, slippage_bps: int) -> str:
        q = self.quote(SOL_MINT, output_mint, int(sol_amount * 1e9), slippage_bps)
        return self.swap(q)

    def sell(self, input_mint: str, raw_amount: int, slippage_bps: int) -> str:
        q = self.quote(input_mint, SOL_MINT, int(raw_amount), slippage_bps)
        return self.swap(q)

    # ── signing (needs `solders`; isolated so tests can stub it) ──
    def _keypair(self):
        from solders.keypair import Keypair
        return Keypair.from_bytes(bytes(b58decode(self._secret)))

    def _sign_and_send(self, swap_tx_b64: str) -> str:
        from solders.transaction import VersionedTransaction
        kp = self._keypair()
        tx = VersionedTransaction.from_bytes(base64.b64decode(swap_tx_b64))
        signed = VersionedTransaction(tx.message, [kp])
        res = self._rpc("sendTransaction",
                        [base64.b64encode(bytes(signed)).decode(),
                         {"encoding": "base64", "skipPreflight": False, "maxRetries": 3}])
        if res.get("error"):
            raise RuntimeError(f"sendTransaction failed: {res['error']}")
        return res.get("result")

    def withdraw_sol(self, destination: str, sol_amount: float | None = None) -> str:
        """Cash out: send SOL from the dedicated wallet to the user's own wallet.
        ``sol_amount=None`` sends the whole balance minus a fee buffer."""
        from solders.hash import Hash
        from solders.message import MessageV0
        from solders.pubkey import Pubkey
        from solders.system_program import TransferParams, transfer
        from solders.transaction import VersionedTransaction
        kp = self._keypair()
        if sol_amount is None:
            lamports = max(0, int(self.get_balance_sol() * 1e9) - 5000)  # leave fee
        else:
            lamports = int(sol_amount * 1e9)
        if lamports <= 0:
            raise RuntimeError("nothing to withdraw")
        bh = (self._rpc("getLatestBlockhash", [{"commitment": "finalized"}])
              .get("result", {}).get("value", {}).get("blockhash"))
        ix = transfer(TransferParams(from_pubkey=kp.pubkey(),
                                     to_pubkey=Pubkey.from_string(destination), lamports=lamports))
        msg = MessageV0.try_compile(kp.pubkey(), [ix], [], Hash.from_string(bh))
        tx = VersionedTransaction(msg, [kp])
        res = self._rpc("sendTransaction",
                        [base64.b64encode(bytes(tx)).decode(), {"encoding": "base64"}])
        if res.get("error"):
            raise RuntimeError(f"withdraw failed: {res['error']}")
        return res.get("result")
