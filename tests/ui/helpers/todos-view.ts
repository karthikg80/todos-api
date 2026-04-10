import { type BrowserContext, type Page } from "@playwright/test";

/** Seeded user object that the mock API will return for /users/me. */
export const MOCK_USER = {
  id: "e2e-test-user",
  name: "E2E Tester",
  email: "e2e@example.com",
  onboardingCompletedAt: new Date().toISOString(),
  onboardingStep: 4,
};

/** Seeded auth token (opaque string — the mock API doesn't validate it). */
export const MOCK_AUTH_TOKEN = "e2e-mock-auth-token";

/**
 * Bootstrap an authenticated context by seeding localStorage with auth tokens and user.
 *
 * After calling this, navigate to `/app/` and the app will render
 * as if the user is logged in with empty data. The static server mocks API responses.
 */
export async function bootstrapTodosContext(context: BrowserContext): Promise<void> {
  // Seed localStorage before any page load.
  await context.addInitScript(() => {
    window.localStorage.setItem("authToken", "e2e-mock-auth-token");
    window.localStorage.setItem(
      "user",
      JSON.stringify({
        id: "e2e-test-user",
        name: "E2E Tester",
        email: "e2e@example.com",
        onboardingCompletedAt: new Date().toISOString(),
        onboardingStep: 4,
      })
    );
    // Skip mobile onboarding carousel.
    window.localStorage.setItem("mobile:onboardingDone", "1");
  });
}

/**
 * Open the todos app with a bootstrapped context.
 * Convenience wrapper that calls `bootstrapTodosContext` then navigates to `/app/`.
 */
export async function openTodosViewWithStorageState(context: BrowserContext): Promise<Page> {
  await bootstrapTodosContext(context);
  const page = await context.newPage();
  await page.goto("/app/");
  await waitForTodosViewIdle(page);
  return page;
}

/**
 * Wait for the app shell to be fully rendered.
 * Uses deterministic DOM selectors instead of arbitrary timeouts.
 *
 * Checks for desktop (sidebar or app-main) or mobile (m-shell or m-tab-bar).
 */
export async function waitForTodosViewIdle(page: Page, timeoutMs = 8000): Promise<void> {
  // Wait for either desktop or mobile shell indicators.
  const desktopPromise = page.waitForSelector("aside.app-sidebar", { state: "visible", timeout: timeoutMs }).catch(() => null);
  const mobilePromise = page.waitForSelector(".m-shell", { state: "visible", timeout: timeoutMs }).catch(() => null);
  const mainPromise = page.waitForSelector(".app-main", { state: "visible", timeout: timeoutMs }).catch(() => null);
  const tabBarPromise = page.waitForSelector(".m-tab-bar", { state: "visible", timeout: timeoutMs }).catch(() => null);

  await Promise.race([desktopPromise, mobilePromise, mainPromise, tabBarPromise]);

  // Small yield to let React state settle (no arbitrary sleep — just microtask drain).
  await page.waitForFunction(() => document.readyState === "complete", undefined, { timeout: timeoutMs }).catch(() => {});
}
