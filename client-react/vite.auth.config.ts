import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Auth page build: base "/" outputs to dist-auth/
// Served at GET /auth by Express
export default defineConfig({
  plugins: [
    react(),
    {
      name: "fix-auth-favicon",
      transformIndexHtml(html) {
        // Vite prefixes all paths with base="/auth/", but favicon should stay at root
        return html.replace('href="/auth/favicon.svg"', 'href="/favicon.svg"');
      },
    },
  ],
  base: "/auth/",
  root: ".",
  build: {
    outDir: "dist-auth",
    emptyOutDir: true,
    rollupOptions: {
      input: "auth.html",
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
