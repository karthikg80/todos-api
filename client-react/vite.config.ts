import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const localAllowedHosts = ["dev.todos.karthikg.in"];

export default defineConfig({
  plugins: [react()],
  base: "/app/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  preview: {
    host: "127.0.0.1",
    allowedHosts: localAllowedHosts,
    port: 4173,
    strictPort: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    allowedHosts: localAllowedHosts,
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
