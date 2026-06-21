"""Provision client MT5 accounts on MetaApi on the operator's behalf.

This is what makes Indices usable by non-technical clients: instead of each
client creating their own MetaApi account + token, the platform holds ONE MetaApi
token (``METAAPI_TOKEN``) and provisions each client's Equiti login under it via
MetaApi's provisioning API. The client only enters their MT5 login/password/server
in our app; we forward those to MetaApi (which holds them) and store back only the
returned account id — never the MT5 password.

HTTP goes through an injectable transport so the request shape is unit-tested;
live verification happens on the deploy.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def _default_transport(token: str):
    import requests
    s = requests.Session()
    s.headers.update({"auth-token": token, "Content-Type": "application/json"})

    def _call(method: str, url: str, json=None):
        r = s.request(method, url, json=json, timeout=30)
        r.raise_for_status()
        return r.json() if r.content else {}
    return _call


class MetaApiProvisioner:
    def __init__(self, token: str, provisioning_url: str, region: str, transport=None) -> None:
        self.url = provisioning_url.rstrip("/")
        self.region = region
        self._req = transport or _default_transport(token)

    def create_account(self, login: str, password: str, server: str,
                       name: str | None = None) -> str:
        """Create + (auto-)deploy a cloud MT5 account. Returns the account id."""
        body = {
            "name": name or f"equiti-{login}",
            "type": "cloud-g2",
            "login": str(login),
            "password": password,
            "server": server,
            "platform": "mt5",
            "region": self.region,
            "magic": 0,
            "application": "MetaApi",
            "reliability": "high",
        }
        r = self._req("POST", f"{self.url}/users/current/accounts", json=body)
        return r.get("id") or r.get("_id") or ""

    def deploy(self, account_id: str) -> None:
        """Best-effort deploy (cloud-g2 usually auto-deploys; harmless if already)."""
        try:
            self._req("POST", f"{self.url}/users/current/accounts/{account_id}/deploy", json={})
        except Exception as exc:  # pragma: no cover - network path
            log.warning("metaapi deploy %s: %s", account_id, exc)
