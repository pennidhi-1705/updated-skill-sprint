import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend calls its API with same-origin relative paths (/api/harry/chat
// for Harry's AI layer, /api/matching for the server-side matcher). In dev the
// app is served from :5173 while the Express API runs on :3001, so without
// this proxy every /api request is answered by Vite's own SPA handler instead
// of the backend. Harry's AI call then fails silently and he falls back to his
// canned deterministic replies for every single message - which is exactly the
// "Sorry, I can help with the Skill Gap Radar" behaviour. Keep this in sync
// with backend/server.js's PORT.
const API_TARGET = process.env.VITE_API_TARGET || "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true }
    }
  }
});
