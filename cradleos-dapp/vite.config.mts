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
    // Allow tailnet, LAN, and any *.ts.net hostname for dev preview from
    // remote devices via Tailscale Serve.
    allowedHosts: [
      "agent-raw-jetson1",
      "agent-raw-jetson1.local",
      "agent-raw-jetson1.tail587192.ts.net",
      ".tail587192.ts.net",
      "localhost",
    ],
    // HMR over Tailscale HTTPS proxy: client connects to the proxy host:port
    // (4173), but websocket protocol must be wss + same host.
    hmr: {
      host: "agent-raw-jetson1.tail587192.ts.net",
      port: 4173,
      protocol: "wss",
      clientPort: 4173,
    },
  },
});
