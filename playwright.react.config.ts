import { defineConfig, devices } from "@playwright/test";

const uiPort = Number.parseInt(process.env.UI_PORT || "4173", 10);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${uiPort}`;

export default defineConfig({
  testDir: "./tests/ui-react",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `${baseURL}/app-react`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "react-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        colorScheme: "light",
      },
    },
    {
      name: "react-mobile",
      use: {
        ...devices["Pixel 7"],
        deviceScaleFactor: 1,
        colorScheme: "light",
      },
    },
  ],
  webServer: {
    command: `UI_PORT=${uiPort} node scripts/ui-static-server.mjs`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
