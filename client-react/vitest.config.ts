import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: {
      url: "http://localhost:3000",
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test-setup.ts",
        "src/vite-env.d.ts",
        "src/agents/avatarEngine.ts",
      ],
      thresholds: {
        lines: 15,
        functions: 10,
        branches: 10,
        statements: 15,
      },
    },
  },
});
