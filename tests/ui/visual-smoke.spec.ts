import { test, expect } from "@playwright/test";
import { openTodosViewWithStorageState } from "./helpers/todos-view";

/**
 * Visual smoke tests — screenshot-based regression for key UI surfaces.
 * These are tagged @visual and excluded from the fast CI suite.
 *
 * NOTE: First run generates baselines. Run `npm run test:ui:update` to regenerate
 * after intentional UI changes. Use Docker for cross-platform baseline consistency.
 */
test.describe("@visual smoke", () => {
  test.skip(({ isMobile }) => isMobile, "Visual tests for desktop only");

  test("@visual landing page renders correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toBeVisible();

    await expect(page).toHaveScreenshot("landing-page.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });
  });

  test("@visual auth page renders correctly", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator(".auth-card")).toBeVisible();

    await expect(page).toHaveScreenshot("auth-page.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });
  });

  test("@visual desktop app shell renders correctly", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    await expect(page.locator("aside.app-sidebar")).toBeVisible();
    await expect(page.locator(".app-main")).toBeVisible();

    await expect(page).toHaveScreenshot("app-shell-desktop.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });

    await context.close();
  });

  test("@visual command palette renders correctly", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();

    await expect(page).toHaveScreenshot("command-palette.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });

    await context.close();
  });
});
