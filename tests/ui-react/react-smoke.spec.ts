import { test, expect, type Page } from "@playwright/test";

/**
 * Mirrors the classic waitForTodosViewIdle() contract:
 * 1. #todosView has class "active"
 * 2. #todosContent has no .loading children
 * 3. #todosContent is visible
 */
async function waitForTodosViewIdle(page: Page) {
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await page.waitForFunction(() => {
    const content = document.getElementById("todosContent");
    if (!content) return false;
    const loading = content.querySelector(".loading");
    return !loading;
  });
  await expect(page.locator("#todosContent")).toBeVisible();
}

test.describe("React preview – smoke", () => {
  test("readiness contract: todosView idle with auth token", async ({
    page,
  }) => {
    // Inject a fake auth token so the React app does not redirect to /auth
    await page.addInitScript(() => {
      localStorage.setItem("authToken", "smoke-test-token");
      localStorage.setItem("refreshToken", "smoke-test-refresh");
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: "smoke-user",
          email: "smoke@test.com",
          name: "Smoke",
        }),
      );
    });

    await page.goto("/");
    await waitForTodosViewIdle(page);
  });

  test("unauthenticated redirects to /auth with next param", async ({
    page,
  }) => {
    // Ensure no auth token is present
    await page.addInitScript(() => {
      localStorage.removeItem("authToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    });

    await page.goto("/");

    // The React app should redirect to /auth?next=/app-react
    await page.waitForURL(/\/auth\?next=\/app-react/);
  });
});
