import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/app-react/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/auth": "http://localhost:3000",
      "/todos": "http://localhost:3000",
      "/projects": "http://localhost:3000",
      "/users": "http://localhost:3000",
      "/ai": "http://localhost:3000",
    },
  },
});
