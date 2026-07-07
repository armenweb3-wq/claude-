"""Sniper worker — SEPARATE process from the web app (Render background worker).

Run with:  python sniper_worker.py

Subscribes to PumpPortal (new pump.fun mints + tracked-wallet trades) and runs
the shadow-mode sniper cycle (`app.saas.sniper`) every few seconds. SHADOW MODE
ONLY: it paper-trades into the `sniper_paper` ledger and never places an order.

Exits immediately unless SNIPER_ENABLED=true — safe to deploy dormant.
"""
from __future__ import annotations

import asyncio
import json
import logging

from app.config import settings
from app.saas.sniper import PumpFeed, SniperProvider, SniperService
from app.saas.store import Store

log = logging.getLogger("sniper")


async def ws_loop(feed: PumpFeed) -> None:
    """Keep a PumpPortal subscription alive forever (reconnect with backoff)."""
    import websockets  # provided by uvicorn[standard]; worker-only dependency

    backoff = 1.0
    while True:
        try:
            async with websockets.connect(settings.pumpportal_ws_url,
                                          ping_interval=20) as ws:
                await ws.send(json.dumps({"method": "subscribeNewToken"}))
                if settings.sniper_tracked_wallets:
                    await ws.send(json.dumps({
                        "method": "subscribeAccountTrade",
                        "keys": settings.sniper_tracked_wallets}))
                log.warning("PumpPortal connected (%d tracked wallets)",
                            len(settings.sniper_tracked_wallets))
                backoff = 1.0
                async for msg in ws:
                    try:
                        feed.handle(json.loads(msg))
                    except Exception:  # one bad frame must not drop the socket
                        log.debug("bad frame skipped", exc_info=True)
        except Exception as exc:
            log.warning("PumpPortal disconnected (%s) — retry in %.0fs", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60.0)


async def strategy_loop(service: SniperService, feed: PumpFeed) -> None:
    while True:
        try:
            feed.prune()
            stats = service.cycle()
            if stats["opened_now"] or stats["exits_now"]:
                log.warning("cycle: %s", stats)
        except Exception:  # a bad cycle must not kill the worker
            log.exception("sniper cycle failed")
        await asyncio.sleep(max(2, settings.sniper_cycle_seconds))


def main() -> int:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(name)s %(levelname)s %(message)s")
    if not settings.sniper_enabled:
        log.warning("SNIPER_ENABLED is not set — sniper worker exiting (dormant).")
        return 0
    feed = PumpFeed(tracked_wallets=settings.sniper_tracked_wallets)
    service = SniperService(Store(), SniperProvider(feed))
    log.warning("sniper worker starting — SHADOW MODE (paper ledger only)")

    async def _run() -> None:
        await asyncio.gather(ws_loop(feed), strategy_loop(service, feed))

    asyncio.run(_run())
    return 1  # loops are infinite; returning means something died


if __name__ == "__main__":
    raise SystemExit(main())
