import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// VITE_BASE MUST be set explicitly for production builds:
//   CradleOS (Stillness): VITE_BASE=/CradleOS/
//   Hackathon (Utopia):   VITE_BASE=/Reality_Anchor_Eve_Frontier_Hackathon_2026/
// VITE_SERVER_ENV: "utopia" | "stillness"
const base = process.env.VITE_BASE
  ?? (process.env.NODE_ENV === "production"
    ? (() => { throw new Error("VITE_BASE must be set for production builds"); })()
    : "/");

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Allow LAN + tailnet dev preview hosts. Customize VITE_DEV_HOSTS in env
    // (comma-separated) when running the dev server behind a remote proxy.
    allowedHosts: (process.env.VITE_DEV_HOSTS ?? "localhost").split(",")
      .map((h) => h.trim())
      .filter(Boolean),
    // HMR over a remote HTTPS proxy: set VITE_HMR_HOST to the public
    // hostname terminating the proxy (e.g. via Tailscale Serve). Default
    // assumes local dev so HMR uses the vite default.
    hmr: process.env.VITE_HMR_HOST
      ? {
          host: process.env.VITE_HMR_HOST,
          port: Number(process.env.VITE_HMR_PORT ?? 4173),
          protocol: "wss",
          clientPort: Number(process.env.VITE_HMR_CLIENT_PORT ?? 4173),
        }
      : undefined,
  },
});
