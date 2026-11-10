"""Guided setup: detect MT5 installations, make private terminal copies,
protect passwords with Windows DPAPI, and read/write accounts.json.

Everything here is used by the Accounts page of the dashboard so a user never
has to edit JSON by hand.
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import sys
import threading
import time
from pathlib import Path
from typing import Any

from .config import ACCOUNTS_FILE, ACCOUNT_COLORS, PROJECT_DIR, SETTINGS_FILE, ConfigError

TERMINALS_DIR = PROJECT_DIR / "terminals"
IS_WINDOWS = sys.platform == "win32"

# --------------------------------------------------------------------------- #
# Password protection (Windows DPAPI, bound to the logged-in Windows user)
# --------------------------------------------------------------------------- #

def dpapi_available() -> bool:
    return IS_WINDOWS


def protect(secret: str) -> str:
    """Encrypt with DPAPI (CryptProtectData). Returns base64 text."""
    if not IS_WINDOWS:
        raise RuntimeError("DPAPI is only available on Windows")
    import ctypes
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    raw = secret.encode("utf-8")
    blob_in = DATA_BLOB(len(raw), ctypes.cast(ctypes.create_string_buffer(raw, len(raw)), ctypes.POINTER(ctypes.c_char)))
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptProtectData(ctypes.byref(blob_in), "mt5cc", None, None, None, 1, ctypes.byref(blob_out)):
        raise RuntimeError("CryptProtectData failed")
    try:
        data = ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)
    return base64.b64encode(data).decode("ascii")


def unprotect(token: str) -> str:
    if not IS_WINDOWS:
        raise RuntimeError("DPAPI is only available on Windows")
    import ctypes
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    raw = base64.b64decode(token)
    blob_in = DATA_BLOB(len(raw), ctypes.cast(ctypes.create_string_buffer(raw, len(raw)), ctypes.POINTER(ctypes.c_char)))
    blob_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(blob_in), None, None, None, None, 1, ctypes.byref(blob_out)):
        raise RuntimeError("CryptUnprotectData failed (was the password saved by another Windows user?)")
    try:
        data = ctypes.string_at(blob_out.pbData, blob_out.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)
    return data.decode("utf-8")


# --------------------------------------------------------------------------- #
# Finding MetaTrader installations
# --------------------------------------------------------------------------- #

def detect_terminals() -> list[dict[str, Any]]:
    """Find terminal64.exe installations on this PC.

    Sources: the data folders MetaTrader keeps under %APPDATA%\\MetaQuotes
    (each has an origin.txt pointing at the install folder), the usual
    Program Files locations, and this project's own terminals/ folder."""
    found: dict[str, dict[str, Any]] = {}

    def add(exe: Path, source: str, portable: bool = False) -> None:
        try:
            if not exe.is_file():
                return
        except OSError:
            return
        key = str(exe.resolve()).lower()
        if key in found:
            return
        folder = exe.parent
        found[key] = {"path": str(exe), "folder": str(folder), "name": folder.name, "source": source,
                      "portable": portable or (folder / "MQL5").is_dir() and (folder / "config").is_dir(),
                      "managed": str(folder).lower().startswith(str(TERMINALS_DIR).lower())}

    if IS_WINDOWS:
        appdata = os.environ.get("APPDATA")
        if appdata:
            for origin in Path(appdata).joinpath("MetaQuotes", "Terminal").glob("*/origin.txt"):
                try:
                    text = origin.read_text(encoding="utf-16", errors="ignore").strip("\ufeff \r\n\t")
                except OSError:
                    continue
                if text:
                    add(Path(text) / "terminal64.exe", "MetaQuotes data folder")
        for base in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)"), os.environ.get("LOCALAPPDATA")):
            if not base:
                continue
            try:
                for child in Path(base).iterdir():
                    add(child / "terminal64.exe", "Program Files")
                    if child.name.lower() == "programs":
                        for sub in child.iterdir():
                            add(sub / "terminal64.exe", "Program Files")
            except OSError:
                continue
    if TERMINALS_DIR.is_dir():
        for child in TERMINALS_DIR.iterdir():
            add(child / "terminal64.exe", "private copy", portable=True)
    rows = list(found.values())
    rows.sort(key=lambda r: (r["managed"], r["name"].lower()))
    return rows


# --------------------------------------------------------------------------- #
# Private terminal copies (one per account)
# --------------------------------------------------------------------------- #

_copy_jobs: dict[str, dict[str, Any]] = {}
_copy_lock = threading.Lock()

IGNORE_DIRS = {"logs", "tester", "bases", "history", "profiles\\charts"}


def _ignore(src: str, names: list[str]) -> set[str]:
    out = set()
    for n in names:
        p = Path(src) / n
        if p.is_dir() and n.lower() in ("logs", "tester", "bases", "history"):
            out.add(n)
    return out


def data_folder_for(install_folder: Path) -> Path | None:
    """The %APPDATA%\\MetaQuotes\\Terminal\\<hash> data folder of a (non-portable)
    installation, found through its origin.txt."""
    appdata = os.environ.get("APPDATA")
    if not appdata:
        return None
    want = str(install_folder).rstrip("\\/").lower()
    for origin in Path(appdata).joinpath("MetaQuotes", "Terminal").glob("*/origin.txt"):
        try:
            text = origin.read_text(encoding="utf-16", errors="ignore").strip("\ufeff \r\n\t")
        except OSError:
            continue
        if text.rstrip("\\/").lower() == want:
            return origin.parent
    return None


def seed_broker_config(source_folder: Path, dest: Path) -> list[str]:
    """Copy the broker server list (and similar harmless config files) from the
    original installation's data folder into the private copy, so the copy can
    log in by server name straight away. Returns what was copied."""
    copied: list[str] = []
    candidates = [source_folder / "config"]
    data = data_folder_for(source_folder)
    if data is not None:
        candidates.insert(0, data / "config")
    (dest / "config").mkdir(parents=True, exist_ok=True)
    for cfg in candidates:
        for name in ("servers.dat", "servers.ini"):
            src = cfg / name
            if src.is_file() and not (dest / "config" / name).exists():
                try:
                    shutil.copy2(src, dest / "config" / name)
                    copied.append(name)
                except OSError:
                    pass
    return copied


def copy_terminal(source_exe: str, slot_id: str) -> dict[str, Any]:
    """Start copying an MT5 installation into terminals/<slot_id>/ in the
    background. Returns the job state (poll ``copy_status``)."""
    src = Path(source_exe)
    if src.name.lower() != "terminal64.exe" or not src.is_file():
        raise ConfigError("Pick the terminal64.exe of an installed MetaTrader 5.")
    dest = TERMINALS_DIR / slot_id
    if dest.exists() and any(dest.iterdir()):
        if (dest / "terminal64.exe").is_file():
            return {"state": "done", "dest": str(dest / "terminal64.exe"), "progress": 1.0, "message": "Copy already exists"}
        raise ConfigError(f"{dest} exists and is not a terminal copy; remove it first.")
    job = {"state": "running", "progress": 0.0, "message": "Counting files…", "dest": str(dest / "terminal64.exe"), "error": None, "started": time.time()}
    with _copy_lock:
        _copy_jobs[slot_id] = job

    def run() -> None:
        try:
            files = [p for p in src.parent.rglob("*") if p.is_file() and not any(part.lower() in ("logs", "tester", "bases", "history") for part in p.relative_to(src.parent).parts[:-1])]
            total = sum(p.stat().st_size for p in files) or 1
            done = 0
            dest.mkdir(parents=True, exist_ok=True)
            for p in files:
                rel = p.relative_to(src.parent)
                target = dest / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, target)
                done += p.stat().st_size
                job["progress"] = min(0.99, done / total)
                job["message"] = f"Copying {rel.parts[0] if rel.parts else p.name}…"
            # portable mode markers: a fresh config/ folder makes the terminal keep data here
            (dest / "config").mkdir(exist_ok=True)
            (dest / "MQL5").mkdir(exist_ok=True)
            seeded = seed_broker_config(src.parent, dest)
            job.update(state="done", progress=1.0,
                       message="Private terminal copy ready" + (f" (broker server list copied: {', '.join(seeded)})" if seeded else ""))
        except Exception as exc:  # pragma: no cover
            job.update(state="error", error=str(exc), message=f"Copy failed: {exc}")
            shutil.rmtree(dest, ignore_errors=True)

    threading.Thread(target=run, name=f"mt5cc-copy-{slot_id}", daemon=True).start()
    return job


def copy_status(slot_id: str) -> dict[str, Any] | None:
    with _copy_lock:
        return dict(_copy_jobs.get(slot_id) or {}) or None


# --------------------------------------------------------------------------- #
# accounts.json / settings.json editing
# --------------------------------------------------------------------------- #

def _read(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig") as fh:
        return json.load(fh)


def _write(path: Path, data: dict[str, Any]) -> None:
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")
    os.replace(tmp, path)


def slug(label: str, existing: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or "account"
    cand, n = base, 2
    while cand in existing:
        cand, n = f"{base}-{n}", n + 1
    return cand


def list_raw_accounts() -> list[dict[str, Any]]:
    return list(_read(ACCOUNTS_FILE).get("accounts") or [])


def save_account(entry: dict[str, Any]) -> dict[str, Any]:
    """Insert or replace an account block by id. Returns the stored block."""
    data = _read(ACCOUNTS_FILE)
    accounts = list(data.get("accounts") or [])
    for i, a in enumerate(accounts):
        if a.get("id") == entry["id"]:
            accounts[i] = entry
            break
    else:
        accounts.append(entry)
    data["accounts"] = accounts
    _write(ACCOUNTS_FILE, data)
    return entry


def delete_account(acc_id: str) -> bool:
    data = _read(ACCOUNTS_FILE)
    before = len(data.get("accounts") or [])
    data["accounts"] = [a for a in (data.get("accounts") or []) if a.get("id") != acc_id]
    _write(ACCOUNTS_FILE, data)
    return len(data["accounts"]) != before


def update_settings(changes: dict[str, Any]) -> dict[str, Any]:
    data = _read(SETTINGS_FILE)
    data.update(changes)
    _write(SETTINGS_FILE, data)
    return data


def build_account_entry(form: dict[str, Any], existing_ids: set[str], current: dict[str, Any] | None = None) -> dict[str, Any]:
    """Validate the Accounts-page form and produce an accounts.json block."""
    label = str(form.get("label") or "").strip()
    if not label:
        raise ConfigError("Give the account a name.")
    login_raw = str(form.get("login") or "").strip()
    if not login_raw.isdigit():
        raise ConfigError("Login must be the account number (digits only).")
    server = str(form.get("server") or "").strip()
    if not server:
        raise ConfigError("Server name is required (as shown in the MT5 login window).")
    terminal_path = str(form.get("terminal_path") or "").strip()
    if not terminal_path:
        raise ConfigError("Choose the MetaTrader 5 installation to use.")
    entry: dict[str, Any] = dict(current or {})
    acc_id = entry.get("id") or slug(label, existing_ids)
    entry.update({
        "id": acc_id,
        "label": label,
        "color": str(form.get("color") or entry.get("color") or ACCOUNT_COLORS[len(existing_ids) % len(ACCOUNT_COLORS)]),
        "terminal_path": terminal_path,
        "portable": bool(form.get("portable", entry.get("portable", False))),
        "login": int(login_raw),
        "server": server,
        "server_utc_offset_hours": float(form.get("server_utc_offset_hours") or entry.get("server_utc_offset_hours") or 0),
        "enabled": True,
    })
    if entry["color"] not in ACCOUNT_COLORS:
        entry["color"] = ACCOUNT_COLORS[0]
    password = str(form.get("password") or "")
    if password:
        entry.pop("password", None)
        entry.pop("password_env", None)
        if dpapi_available():
            entry["password_dpapi"] = protect(password)
            entry.pop("password_plain", None)
        else:
            entry["password"] = password   # non-Windows (development only)
    elif not any(entry.get(k) for k in ("password", "password_env", "password_dpapi")):
        raise ConfigError("Enter the account password (master password to trade, investor password to only monitor).")
    t = dict(entry.get("trading") or {})
    tf = form.get("trading") or {}
    if isinstance(tf, dict):
        t.update({
            "enabled": bool(tf.get("enabled", t.get("enabled", False))),
            "max_risk_percent": float(tf.get("max_risk_percent", t.get("max_risk_percent", 1.0))),
            "max_lots": float(tf.get("max_lots", t.get("max_lots", 1.0))),
            "max_open_positions": int(tf.get("max_open_positions", t.get("max_open_positions", 10))),
            "allowed_symbols": [s.strip().upper() for s in (tf.get("allowed_symbols") if isinstance(tf.get("allowed_symbols"), list) else str(tf.get("allowed_symbols") or "").split(",")) if s.strip()],
            "magic": int(t.get("magic") or 710000 + (int(login_raw) % 1000)),
            "deviation_points": int(tf.get("deviation_points", t.get("deviation_points", 20))),
        })
        if not (0 < t["max_risk_percent"] <= 100) or t["max_lots"] <= 0:
            raise ConfigError("Trading limits must be positive (max risk between 0 and 100).")
    entry["trading"] = t
    entry.pop("mock", None)
    return entry
