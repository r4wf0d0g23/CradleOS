import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// VITE_BASE overrides the base path (used for CradleOS Stillness deploy)
// VITE_SERVER_ENV: "utopia" (default) | "stillness"
const base = process.env.VITE_BASE
  ?? (process.env.NODE_ENV === "production" ? "/Reality_Anchor_Eve_Frontier_Hackathon_2026/" : "/");

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
