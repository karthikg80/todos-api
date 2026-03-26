import { test, expect } from "@playwright/test";

function authSnapshotName(baseName: string, projectName: string): string {
  const isMobileProject = projectName.includes("mobile");
  if (!isMobileProject) {
    return `${baseName}.png`;
  }
  return `${baseName}-${process.platform}.png`;
}

test.describe("Auth UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: `
        *,
        *::before,
        *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `,
    });
  });

  test("login tab baseline @visual", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.locator("#authView")).toHaveClass(/active/);
    await expect(page.locator("#loginForm")).toBeVisible();
    await expect(page.locator("#registerForm")).toBeHidden();

    await expect(page).toHaveScreenshot(
      authSnapshotName("auth-login", testInfo.project.name),
      {
        fullPage: true,
      },
    );
  });

  test("register tab baseline @visual", async ({ page }, testInfo) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Register" }).click();
    await expect(page.locator("#registerForm")).toBeVisible();
    await expect(page.locator("#loginForm")).toBeHidden();

    await expect(page).toHaveScreenshot(
      authSnapshotName("auth-register", testInfo.project.name),
      {
        fullPage: true,
      },
    );
  });

  test("forgot password link opens reset form", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Forgot Password?" }).click();

    await expect(page.locator("#forgotPasswordForm")).toBeVisible();
    await expect(page.locator("#loginForm")).toBeHidden();
  });

  test("resend verification click shows response message", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("authToken", "test-token");
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          id: "user-1",
          email: "user@example.com",
          name: "Test User",
          role: "user",
          isVerified: false,
          createdAt: "2026-02-09T00:00:00.000Z",
        }),
      );
    });

    await page.goto("/");
    // The Settings rail button is visible on desktop; on mobile the sheet is
    // closed so no Settings button is reachable via role. Use evaluate fallback.
    const settingsButton = page.getByRole("button", { name: "Settings" });
    if (await settingsButton.first().isVisible()) {
      await settingsButton.first().click();
    } else {
      await page.evaluate(() =>
        (window as Window & { switchView: (v: string) => void }).switchView(
          "settings",
        ),
      );
    }
    await expect(page.locator("#verificationBanner")).toBeVisible();

    await page.getByRole("button", { name: "Resend Email" }).click();
    await expect(page.locator("#profileMessage")).toHaveClass(/show/);
  });

  test("forgot password still works with corrupted stored user state", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("authToken", "stale-token");
      window.localStorage.setItem("user", "{invalid-json");
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Forgot Password?" }).click();
    await expect(page.locator("#forgotPasswordForm")).toBeVisible();
  });
});
