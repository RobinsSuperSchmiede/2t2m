import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const backend = "http://localhost:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Backend läuft auf eigenem Port; über den Proxy sind Cookies same-origin.
    proxy: {
      "/api": backend,
      "/socket.io": { target: backend, ws: true },
    },
  },
});
