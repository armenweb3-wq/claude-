import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxies API calls to the FastAPI backend during `npm run dev`,
// so the frontend can call /status, /control/* with no CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/status": "http://localhost:8000",
      "/health": "http://localhost:8000",
      "/control": "http://localhost:8000",
    },
  },
});
