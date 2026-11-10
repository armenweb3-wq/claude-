"""Guided setup: form validation, config writing and private terminal copies."""
import json
import time
from pathlib import Path

import pytest

from mt5cc import setup as S
from mt5cc.config import ConfigError


@pytest.fixture
def cfg_files(tmp_path, monkeypatch):
    acc = tmp_path / "accounts.json"; acc.write_text('{"accounts": []}')
    st = tmp_path / "settings.json"; st.write_text(json.dumps({"mock_mode": False, "trading_enabled": False}))
    monkeypatch.setattr(S, "ACCOUNTS_FILE", acc)
    monkeypatch.setattr(S, "SETTINGS_FILE", st)
    monkeypatch.setattr(S, "TERMINALS_DIR", tmp_path / "terminals")
    monkeypatch.setattr(S, "IS_WINDOWS", False)
    return tmp_path


def test_build_entry_validates(cfg_files):
    base = {"label": "Main", "login": "123", "server": "Srv", "terminal_path": "C:/t/terminal64.exe", "password": "x"}
    e = S.build_account_entry(base, set())
    assert e["id"] == "main" and e["login"] == 123 and e["trading"]["enabled"] is False and "password" in e
    with pytest.raises(ConfigError, match="Login"):
        S.build_account_entry({**base, "login": "abc"}, set())
    with pytest.raises(ConfigError, match="password"):
        S.build_account_entry({**base, "password": ""}, set())
    with pytest.raises(ConfigError, match="name"):
        S.build_account_entry({**base, "label": " "}, set())
    with pytest.raises(ConfigError, match="limits"):
        S.build_account_entry({**base, "trading": {"max_risk_percent": 0}}, set())


def test_edit_keeps_password_and_id(cfg_files):
    current = {"id": "main", "label": "Main", "login": 123, "server": "Srv", "terminal_path": "p", "password_dpapi": "enc", "trading": {"enabled": True, "magic": 5}}
    e = S.build_account_entry({"label": "Renamed", "login": "123", "server": "Srv", "terminal_path": "p", "password": "", "trading": {"max_lots": 3}}, {"main"}, current)
    assert e["id"] == "main" and e["label"] == "Renamed" and e["password_dpapi"] == "enc"
    assert e["trading"]["enabled"] is True and e["trading"]["max_lots"] == 3.0 and e["trading"]["magic"] == 5


def test_slug_and_save_delete(cfg_files):
    assert S.slug("Exness Main!", set()) == "exness-main"
    assert S.slug("Exness Main", {"exness-main"}) == "exness-main-2"
    S.save_account({"id": "a", "label": "A"})
    S.save_account({"id": "b", "label": "B"})
    S.save_account({"id": "a", "label": "A2"})
    assert [x["label"] for x in S.list_raw_accounts()] == ["A2", "B"]
    assert S.delete_account("a") and [x["id"] for x in S.list_raw_accounts()] == ["b"]
    assert not S.delete_account("zzz")
    assert S.update_settings({"trading_enabled": True})["trading_enabled"] is True


def test_copy_terminal_skips_logs_and_marks_portable(cfg_files):
    src = cfg_files / "Broker MT5"
    (src / "MQL5" / "Experts").mkdir(parents=True)
    (src / "logs").mkdir()
    (src / "terminal64.exe").write_bytes(b"x" * 10000)
    (src / "MQL5" / "Experts" / "ea.ex5").write_bytes(b"y")
    (src / "logs" / "big.log").write_bytes(b"z" * 10000)
    job = S.copy_terminal(str(src / "terminal64.exe"), "acc1")
    for _ in range(100):
        if S.copy_status("acc1")["state"] in ("done", "error"):
            break
        time.sleep(0.05)
    st = S.copy_status("acc1")
    assert st["state"] == "done", st
    dest = cfg_files / "terminals" / "acc1"
    assert (dest / "terminal64.exe").is_file() and (dest / "MQL5" / "Experts" / "ea.ex5").is_file()
    assert not (dest / "logs").exists() and (dest / "config").is_dir()
    # second call is idempotent
    assert S.copy_terminal(str(src / "terminal64.exe"), "acc1")["state"] == "done"
    with pytest.raises(ConfigError):
        S.copy_terminal(str(src / "nope.exe"), "acc2")
