"""Configuration loading and validation.

Two JSON files live in ``config/`` next to the package:

* ``settings.json``  - server + behaviour settings (no secrets)
* ``accounts.json``  - one entry per MT5 account / terminal

Both are created from the ``*.example.json`` templates on first run if they do
not exist. Passwords are never written back to disk by this program.
"""

from __future__ import annotations

import json
import os
import secrets
import shutil
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

PACKAGE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PACKAGE_DIR.parent
CONFIG_DIR = PROJECT_DIR / "config"
DATA_DIR = PROJECT_DIR / "data"
LOG_DIR = PROJECT_DIR / "logs"

SETTINGS_FILE = CONFIG_DIR / "settings.json"
ACCOUNTS_FILE = CONFIG_DIR / "accounts.json"
TOKEN_FILE = CONFIG_DIR / ".api_token"

# Named accent colours the UI understands (categorical slots, fixed order).
ACCOUNT_COLORS = ("blue", "orange", "aqua", "yellow", "magenta", "violet")


class ConfigError(Exception):
    """Raised when a configuration file is missing or invalid."""


@dataclass
class ServerSettings:
    host: str = "127.0.0.1"
    port: int = 8731
    open_browser: bool = True


@dataclass
class Settings:
    server: ServerSettings = field(default_factory=ServerSettings)
    refresh_seconds: float = 2.0
    history_refresh_seconds: float = 15.0
    history_lookback_days: int = 365
    equity_sample_seconds: int = 30
    report_timezone: str = "local"
    mock_mode: bool = False
    log_level: str = "INFO"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AccountConfig:
    id: str
    label: str
    color: str = "blue"
    terminal_path: str | None = None
    portable: bool = False
    login: int | None = None
    server: str | None = None
    password: str | None = None          # discouraged - prefer password_env
    password_env: str | None = None      # name of an environment variable
    server_utc_offset_hours: float = 0.0
    timeout_ms: int = 60000
    mock: bool = False
    enabled: bool = True

    def resolved_password(self) -> str | None:
        if self.password_env:
            value = os.environ.get(self.password_env)
            return value if value else None
        return self.password or None

    def auth_mode(self) -> str:
        """How the worker will attach to the terminal."""
        if self.mock:
            return "mock"
        if self.login and self.resolved_password() and self.server:
            return "login"
        return "attach"  # use whatever account the terminal is already logged into

    def public_dict(self) -> dict[str, Any]:
        """Representation that is safe to send to the browser (no secrets)."""
        return {
            "id": self.id,
            "label": self.label,
            "color": self.color,
            "terminal_path": self.terminal_path,
            "portable": self.portable,
            "login": self.login,
            "server": self.server,
            "server_utc_offset_hours": self.server_utc_offset_hours,
            "auth_mode": self.auth_mode(),
            "password_source": (
                f"environment variable {self.password_env}" + ("" if os.environ.get(self.password_env or "") else " (not set)")
                if self.password_env
                else "accounts.json" if self.password
                else "none (terminal must already be logged in)"
            ),
            "mock": self.mock,
            "enabled": self.enabled,
        }

    def worker_dict(self) -> dict[str, Any]:
        """Everything the worker subprocess needs, including the password.

        This only ever crosses the process boundary (pipe), never the network.
        """
        d = asdict(self)
        d["password"] = self.resolved_password()
        d.pop("password_env", None)
        return d


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #

def _read_json(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8-sig") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        raise ConfigError(f"Missing configuration file: {path}")
    except json.JSONDecodeError as exc:
        raise ConfigError(f"{path.name} is not valid JSON: {exc}")
    if not isinstance(data, dict):
        raise ConfigError(f"{path.name} must contain a JSON object at the top level")
    return data


def ensure_config_files() -> list[str]:
    """Create settings/accounts from the example templates if missing.

    Returns a list of human-readable notes about what was created.
    """
    notes: list[str] = []
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    for target, example in (
        (SETTINGS_FILE, CONFIG_DIR / "settings.example.json"),
        (ACCOUNTS_FILE, CONFIG_DIR / "accounts.example.json"),
    ):
        if not target.exists():
            if example.exists():
                shutil.copyfile(example, target)
                notes.append(f"Created {target.name} from {example.name} - edit it before connecting real accounts.")
            else:
                raise ConfigError(f"Neither {target} nor {example} exists.")
    return notes


def load_settings() -> Settings:
    raw = _read_json(SETTINGS_FILE)
    srv = raw.get("server", {}) or {}
    settings = Settings(
        server=ServerSettings(
            host=str(srv.get("host", "127.0.0.1")),
            port=int(srv.get("port", 8731)),
            open_browser=bool(srv.get("open_browser", True)),
        ),
        refresh_seconds=float(raw.get("refresh_seconds", 2.0)),
        history_refresh_seconds=float(raw.get("history_refresh_seconds", 15.0)),
        history_lookback_days=int(raw.get("history_lookback_days", 365)),
        equity_sample_seconds=int(raw.get("equity_sample_seconds", 30)),
        report_timezone=str(raw.get("report_timezone", "local")),
        mock_mode=bool(raw.get("mock_mode", False)),
        log_level=str(raw.get("log_level", "INFO")).upper(),
    )
    if os.environ.get("MT5CC_MOCK") == "1":
        settings.mock_mode = True
    if settings.refresh_seconds < 0.5:
        settings.refresh_seconds = 0.5
    if settings.history_lookback_days < 1:
        settings.history_lookback_days = 1
    if not (1 <= settings.server.port <= 65535):
        raise ConfigError("server.port must be between 1 and 65535")
    return settings


def load_accounts(settings: Settings) -> list[AccountConfig]:
    raw = _read_json(ACCOUNTS_FILE)
    entries = raw.get("accounts")
    if not isinstance(entries, list) or not entries:
        raise ConfigError("accounts.json must contain a non-empty \"accounts\" list")

    accounts: list[AccountConfig] = []
    seen_ids: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ConfigError(f"accounts[{index}] must be an object")
        acc_id = str(entry.get("id") or f"account{index + 1}").strip()
        if not acc_id.replace("-", "").replace("_", "").isalnum():
            raise ConfigError(f"Account id '{acc_id}' may only contain letters, digits, '-' and '_'")
        if acc_id in seen_ids:
            raise ConfigError(f"Duplicate account id '{acc_id}'")
        seen_ids.add(acc_id)
        login = entry.get("login")
        acc = AccountConfig(
            id=acc_id,
            label=str(entry.get("label") or f"Account {index + 1}"),
            color=str(entry.get("color") or ACCOUNT_COLORS[index % len(ACCOUNT_COLORS)]),
            terminal_path=entry.get("terminal_path") or None,
            portable=bool(entry.get("portable", False)),
            login=int(login) if login not in (None, "", 0) else None,
            server=entry.get("server") or None,
            password=entry.get("password") or None,
            password_env=entry.get("password_env") or None,
            server_utc_offset_hours=float(entry.get("server_utc_offset_hours", 0.0)),
            timeout_ms=int(entry.get("timeout_ms", 60000)),
            mock=bool(entry.get("mock", False)) or settings.mock_mode,
            enabled=bool(entry.get("enabled", True)),
        )
        if acc.color not in ACCOUNT_COLORS:
            acc.color = ACCOUNT_COLORS[index % len(ACCOUNT_COLORS)]
        if not acc.mock and sys.platform != "win32":
            # MetaTrader5 python package exists only for Windows.
            acc.mock = False  # keep as configured; the worker will report a clear error
        accounts.append(acc)
    return [a for a in accounts if a.enabled]


def load_or_create_token() -> str:
    """Return the local API access token, creating it on first run."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if len(token) >= 32:
            return token
    token = secrets.token_urlsafe(32)
    TOKEN_FILE.write_text(token, encoding="utf-8")
    try:
        os.chmod(TOKEN_FILE, 0o600)
    except OSError:
        pass
    return token


def rotate_token() -> str:
    if TOKEN_FILE.exists():
        TOKEN_FILE.unlink()
    return load_or_create_token()
