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
  },
});
