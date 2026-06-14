// Thin client for the bot's FastAPI control surface.
// In dev, Vite proxies these paths to http://localhost:8000.
//
// The control API key (if the backend requires one) is read from
// VITE_CONTROL_API_KEY at build/dev time. For a browser-exposed dashboard
// prefer a reverse proxy that injects the header instead of shipping the
// key to the client.
const API_KEY = import.meta.env.VITE_CONTROL_API_KEY || "";

async function request(path, { method = "GET" } = {}) {
  const headers = {};
  if (API_KEY && method !== "GET") {
    headers["X-API-Key"] = API_KEY;
  }
  const res = await fetch(path, { method, headers });
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}`);
  }
  return res.json();
}

export const getStatus = () => request("/status");
export const start = () => request("/control/start", { method: "POST" });
export const stop = () => request("/control/stop", { method: "POST" });
export const pause = () => request("/control/pause", { method: "POST" });
export const resume = () => request("/control/resume", { method: "POST" });
