"""Entry point: ``python -m mt5cc``"""

from __future__ import annotations

import logging
import multiprocessing as mp
import signal
import sys
import threading
import webbrowser
from logging.handlers import RotatingFileHandler

import uvicorn

from . import __version__
from .config import (DATA_DIR, LOG_DIR, ConfigError, ensure_config_files, load_accounts,
                     load_or_create_token, load_settings)
from .server import create_app
from .store import EquityStore
from .supervisor import Supervisor


def setup_logging(level: str) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s")
    root = logging.getLogger()
    root.setLevel(getattr(logging, level, logging.INFO))
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    root.addHandler(sh)
    fh = RotatingFileHandler(LOG_DIR / "control-center.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(fh)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def main() -> int:
    print(f"MT5 Trading Control Center v{__version__}")
    try:
        for note in ensure_config_files():
            print("  *", note)
        settings = load_settings()
        accounts = load_accounts(settings)
    except ConfigError as exc:
        print(f"\nConfiguration problem: {exc}")
        return 2

    setup_logging(settings.log_level)
    log = logging.getLogger("mt5cc")
    token = load_or_create_token()

    if sys.platform != "win32" and not all(a.mock for a in accounts):
        log.warning("Not running on Windows: real MT5 connections are impossible here. "
                    "Set \"mock_mode\": true in settings.json for a demo.")

    store = EquityStore(DATA_DIR / "equity.sqlite")
    store.prune()
    supervisor = Supervisor(accounts, settings)
    app = create_app(supervisor, settings, token, store)

    url = f"http://{settings.server.host}:{settings.server.port}/auth?token={token}"
    print("\n" + "=" * 72)
    print("  Open this link in your browser (it carries your private access key):")
    print(f"  {url}")
    print("=" * 72 + "\n")
    for a in accounts:
        print(f"  Account slot '{a.id}' ({a.label}): mode={a.auth_mode()}"
              + (" [DEMO DATA]" if a.mock else f" -> {a.terminal_path}"))
    if all(a.mock for a in accounts):
        print("\n  Demo mode is ON: all numbers are synthetic. To connect real terminals, edit")
        print("  config\\accounts.json and set \"mock_mode\": false in config\\settings.json.")
    print("\n  Press Ctrl+C to stop.\n")

    supervisor.start()

    if settings.server.open_browser:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()

    config = uvicorn.Config(app, host=settings.server.host, port=settings.server.port,
                            log_level="warning", access_log=False)
    server = uvicorn.Server(config)
    try:
        server.run()
    finally:
        log.info("Shutting down workers")
        supervisor.stop()
        store.close()
    return 0


if __name__ == "__main__":
    mp.freeze_support()
    sys.exit(main())
