"""Backtest status endpoint must survive numpy / inf / NaN in results (no 500)."""
from __future__ import annotations

import pathlib
import sys

import numpy as np
import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.config import settings  # noqa: E402


@pytest.fixture()
def client(tmp_path):
    for k, v in {"saas_db_path": str(tmp_path / "t.db"), "saas_secret_key": "test-secret",
                 "saas_seat_limit": 5, "saas_admin_email": "admin@z.com"}.items():
        object.__setattr__(settings, k, v)
    import app.saas.routes as r
    r._store = None
    from fastapi.testclient import TestClient
    import app.main as m
    return TestClient(m.app)


def test_backtest_status_survives_inf_nan_numpy(client):
    client.post("/app/api/register", json={"email": "admin@z.com", "password": "password1"})
    # The exact shape that 500'd: infinite profit factor, NaN win-rate, numpy scalars.
    client.app.state.backtest = {
        "status": "done", "error": None, "started": "a", "finished": "b",
        "results": [{
            "symbol": "BTCUSDT", "timeframe": "1d",
            "profit_factor": np.float64("inf"), "win_rate_pct": float("nan"),
            "final_equity": np.float64(595.29), "beats_buy_hold": np.bool_(True),
            "tp_hits": np.int64(4), "total_return_pct": np.float64(14.08),
        }],
    }
    r = client.get("/app/api/admin/backtest")
    assert r.status_code == 200, r.text          # was a bare 500 before the fix
    res = r.json()["results"][0]
    assert res["profit_factor"] is None and res["win_rate_pct"] is None   # inf/nan -> None
    assert res["beats_buy_hold"] is True and res["tp_hits"] == 4
    assert res["final_equity"] == 595.29
