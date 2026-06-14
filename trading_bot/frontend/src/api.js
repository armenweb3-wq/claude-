// Thin client for the bot's FastAPI control surface.
// In dev, Vite proxies these paths to http://localhost:8000.

async function request(path, options) {
  const res = await fetch(path, options);
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
