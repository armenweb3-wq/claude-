"""Start-with-Windows support and a desktop shortcut to the dashboard.

Implemented with a Startup-folder shortcut (per user, no admin rights), created
through PowerShell's WScript.Shell COM object so no extra Python packages are
needed. Nothing here runs on non-Windows systems.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from .config import PROJECT_DIR

IS_WINDOWS = sys.platform == "win32"
SHORTCUT_NAME = "MT5 Control Center.lnk"
DESKTOP_NAME = "MT5 Control Center.url"


def _startup_dir() -> Path | None:
    appdata = os.environ.get("APPDATA")
    return Path(appdata) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup" if appdata else None


def _desktop_dir() -> Path | None:
    home = os.environ.get("USERPROFILE")
    if not home:
        return None
    d = Path(home) / "Desktop"
    if not d.is_dir():
        # OneDrive-redirected desktops
        od = os.environ.get("OneDrive")
        if od and (Path(od) / "Desktop").is_dir():
            return Path(od) / "Desktop"
    return d


def _ps(script: str) -> None:
    subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
                   check=True, capture_output=True, text=True, timeout=30)


def status() -> dict[str, Any]:
    sd, dd = _startup_dir(), _desktop_dir()
    return {
        "supported": IS_WINDOWS and sd is not None,
        "enabled": bool(IS_WINDOWS and sd and (sd / SHORTCUT_NAME).exists()),
        "startup_path": str(sd / SHORTCUT_NAME) if sd else None,
        "desktop_shortcut": bool(IS_WINDOWS and dd and (dd / DESKTOP_NAME).exists()),
        "desktop_path": str(dd / DESKTOP_NAME) if dd else None,
    }


def enable() -> dict[str, Any]:
    sd = _startup_dir()
    if not IS_WINDOWS or sd is None:
        raise RuntimeError("Start with Windows is only available on Windows.")
    sd.mkdir(parents=True, exist_ok=True)
    bat = PROJECT_DIR / "start.bat"
    lnk = sd / SHORTCUT_NAME
    script = (
        "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('" + str(lnk).replace("'", "''") + "'); "
        "$s.TargetPath = '" + str(bat).replace("'", "''") + "'; "
        "$s.Arguments = '--no-browser'; "
        "$s.WorkingDirectory = '" + str(PROJECT_DIR).replace("'", "''") + "'; "
        "$s.WindowStyle = 7; "
        "$s.Description = 'MT5 Trading Control Center (starts minimized)'; "
        "$s.Save()"
    )
    _ps(script)
    return status()


def disable() -> dict[str, Any]:
    sd = _startup_dir()
    if sd and (sd / SHORTCUT_NAME).exists():
        (sd / SHORTCUT_NAME).unlink()
    return status()


def create_desktop_shortcut(url: str) -> dict[str, Any]:
    dd = _desktop_dir()
    if not IS_WINDOWS or dd is None:
        raise RuntimeError("Desktop shortcuts are only created on Windows.")
    icon = PROJECT_DIR / "mt5cc" / "static" / "favicon.ico"
    text = f"[InternetShortcut]\r\nURL={url}\r\n"
    if icon.exists():
        text += f"IconFile={icon}\r\nIconIndex=0\r\n"
    (dd / DESKTOP_NAME).write_text(text, encoding="utf-8")
    return status()
