import { useCallback, useEffect, useState } from "react";
import { getStatus, start, stop, pause, resume } from "./api.js";

const POLL_MS = 4000;

export default function App() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getStatus());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const live = status?.is_live;

  return (
    <div className="app">
      <header>
        <h1>crypto-trading-bot</h1>
        <span className={`badge ${live ? "live" : "dry"}`}>
          {live ? "LIVE" : "DRY-RUN"}
        </span>
      </header>

      {error && <div className="error">⚠️ {error} — is the API running on :8000?</div>}

      {!status ? (
        <p className="muted">Loading status…</p>
      ) : (
        <>
          <div className={`safety ${live ? "live" : "dry"}`}>{status.safety}</div>

          <section className="grid">
            <Stat label="Running" value={status.running ? "yes" : "no"} />
            <Stat label="Paused" value={status.paused ? "yes" : "no"} />
            <Stat label="Exchange" value={status.exchange} />
            <Stat label="Strategy" value={status.strategy} />
            <Stat label="Timeframe" value={`${status.timeframe}m`} />
            <Stat label="Symbols" value={(status.symbols || []).join(", ")} />
            <Stat label="Last run" value={status.last_run || "—"} />
            <Stat label="Error" value={status.error || "none"} />
          </section>

          <section className="controls">
            <button disabled={busy || status.running} onClick={() => act(start)}>
              Start
            </button>
            <button disabled={busy || !status.running} onClick={() => act(stop)}>
              Stop
            </button>
            <button disabled={busy || !status.running || status.paused} onClick={() => act(pause)}>
              Pause
            </button>
            <button disabled={busy || !status.paused} onClick={() => act(resume)}>
              Resume
            </button>
          </section>

          <section>
            <h2>Latest signals</h2>
            {status.last_signals && Object.keys(status.last_signals).length ? (
              <table>
                <thead>
                  <tr><th>Symbol</th><th>Signal</th></tr>
                </thead>
                <tbody>
                  {Object.entries(status.last_signals).map(([sym, sig]) => (
                    <tr key={sym}><td>{sym}</td><td>{sig}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No signals yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
