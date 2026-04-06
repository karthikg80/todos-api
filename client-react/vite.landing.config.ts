import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Landing page build: base "/" outputs to dist-landing/
// Served at GET / by Express
export default defineConfig({
  plugins: [react()],
  base: "/",
  root: ".",
  build: {
    outDir: "dist-landing",
    emptyOutDir: true,
    rollupOptions: {
      input: "landing.html",
    },
  },
  server: {
    proxy: {
      "/auth": "http://localhost:3000",
      "/todos": "http://localhost:3000",
      "/projects": "http://localhost:3000",
      "/users": "http://localhost:3000",
      "/ai": "http://localhost:3000",
      "/admin": "http://localhost:3000",
      "/api": "http://localhost:3000",
      "/agent": "http://localhost:3000",
    },
  },
});
