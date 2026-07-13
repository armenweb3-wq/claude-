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
from app.saas.memestrategy import SafetyScreen
from app.saas.sniper import PumpFeed, SniperProvider, SniperService
from app.saas.store import Store

log = logging.getLogger("sniper")


# How many tokens to keep subscribed to for TRADES at once. subscribeNewToken/
# subscribeMigration only stream events — without also subscribing to each
# token's trades the feed never gets a price, so nothing is ever screened. We
# keep trade subscriptions for the most recent N tokens (FIFO) so prices flow
# while the memory/socket load stays bounded on a small worker.
_TRADE_SUB_CAP = 200


def _is_migration(data: dict) -> bool:
    tx = (data.get("txType") or "").lower()
    return ("migrat" in tx) or bool(data.get("migration")) \
        or (str(data.get("pool") or "").lower() in ("raydium", "pump-amm", "pumpswap"))


async def ws_loop(feed: PumpFeed, mig_feed: PumpFeed) -> None:
    """Keep a PumpPortal subscription alive forever (reconnect with backoff).

    Routes events to two feeds: new-token creates + their trades -> ``feed``
    (fresh-mint strategy); migration/graduation events + those tokens' trades ->
    ``mig_feed`` (migration strategy). Dynamically subscribes to each token's
    trades (FIFO-bounded) so both feeds actually receive prices."""
    import collections
    import websockets  # provided by uvicorn[standard]; worker-only dependency

    backoff = 1.0
    while True:
        try:
            async with websockets.connect(settings.pumpportal_ws_url,
                                          ping_interval=20) as ws:
                subbed: "collections.deque[str]" = collections.deque()
                subbed_set: set[str] = set()

                async def sub_trades(mint):
                    if not isinstance(mint, str) or not mint or mint in subbed_set:
                        return
                    if len(subbed) >= _TRADE_SUB_CAP:
                        old = subbed.popleft(); subbed_set.discard(old)
                        try:
                            await ws.send(json.dumps({"method": "unsubscribeTokenTrade",
                                                      "keys": [old]}))
                        except Exception:
                            pass
                    subbed.append(mint); subbed_set.add(mint)
                    try:
                        await ws.send(json.dumps({"method": "subscribeTokenTrade",
                                                  "keys": [mint]}))
                    except Exception:
                        pass

                await ws.send(json.dumps({"method": "subscribeNewToken"}))
                if settings.sniper_migration_enabled:
                    try:
                        await ws.send(json.dumps({"method": "subscribeMigration"}))
                    except Exception:
                        pass
                if settings.sniper_tracked_wallets:
                    await ws.send(json.dumps({"method": "subscribeAccountTrade",
                                              "keys": settings.sniper_tracked_wallets}))
                log.warning("PumpPortal connected (migration=%s, %d tracked wallets)",
                            settings.sniper_migration_enabled,
                            len(settings.sniper_tracked_wallets))
                backoff = 1.0
                async for msg in ws:
                    try:
                        data = json.loads(msg)
                    except Exception:  # one bad frame must not drop the socket
                        continue
                    if not isinstance(data, dict):
                        continue
                    try:
                        tx = (data.get("txType") or "").lower()
                        if _is_migration(data):
                            mig_feed.handle(data)          # register graduated token
                            await sub_trades(data.get("mint"))
                        elif tx == "create":
                            feed.handle(data)
                            await sub_trades(data.get("mint"))
                        elif tx in ("buy", "sell"):
                            feed.handle(data)              # updates whichever feed
                            mig_feed.handle(data)          # knows this mint
                        else:
                            feed.handle(data)
                    except Exception:
                        log.debug("bad frame skipped", exc_info=True)
        except Exception as exc:
            log.warning("PumpPortal disconnected (%s) — retry in %.0fs", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60.0)


async def strategy_loop(service: SniperService, feed: PumpFeed) -> None:
    while True:
        try:
            feed.prune()
            # cycle() does blocking HTTP (enrichment) — run it OFF the event loop
            # so it can never stall the websocket read in ws_loop.
            stats = await asyncio.to_thread(service.cycle)
            if stats["opened_now"] or stats["exits_now"]:
                log.warning("[%s] cycle: %s", service.strategy, stats)
        except Exception:  # a bad cycle must not kill the worker
            log.exception("sniper cycle failed")
        await asyncio.sleep(max(2, settings.sniper_cycle_seconds))


def main() -> int:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(name)s %(levelname)s %(message)s")
    if not settings.sniper_enabled:
        log.warning("SNIPER_ENABLED is not set — sniper worker exiting (dormant).")
        return 0
    from app.saas.enricher import make_enricher
    enricher = make_enricher(settings)
    store = Store()
    feed = PumpFeed(tracked_wallets=settings.sniper_tracked_wallets)
    mig_feed = PumpFeed(tracked_wallets=settings.sniper_tracked_wallets)
    # Fresh-mint strategy: relaxed holder gate (default screen).
    fresh = SniperService(store, SniperProvider(feed, enricher=enricher))
    # Migration strategy: STRICT screen (migrated tokens are distributed), its
    # own ledger/scoreboard; min_age 0 because graduation itself is the signal.
    services = [(fresh, feed)]
    if settings.sniper_migration_enabled:
        mig = SniperService(store, SniperProvider(mig_feed, enricher=enricher, min_age_s=0),
                            strategy="migration", screen=SafetyScreen())
        services.append((mig, mig_feed))
    log.warning("sniper worker starting — SHADOW MODE (paper only) — enricher=%s, "
                "strategies=%s", settings.meme_enricher or "none",
                [s.strategy for s, _ in services])

    async def _run() -> None:
        await asyncio.gather(ws_loop(feed, mig_feed),
                             *(strategy_loop(s, f) for s, f in services))

    asyncio.run(_run())
    return 1  # loops are infinite; returning means something died


if __name__ == "__main__":
    raise SystemExit(main())
