import { expect, type Page } from "@playwright/test";

type RegisterOptions = {
  name: string;
  email: string;
  password?: string;
};

export async function registerAndOpenTodosView(
  page: Page,
  { name, email, password = "Password123!" }: RegisterOptions,
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill(name);
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await waitForTodosViewIdle(page);
}

export async function bootstrapAndOpenTodosView(
  page: Page,
  { name, email, password = "Password123!" }: RegisterOptions,
) {
  await page.goto("/");
  await page.evaluate(
    async ({ name, email, password }) => {
      window.localStorage.clear();

      const response = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = (await response.json()) as {
        token?: string;
        refreshToken?: string;
        user?: unknown;
        error?: string;
      };

      if (!response.ok || !data.token || !data.user) {
        throw new Error(data.error || "Failed to bootstrap auth session");
      }

      window.localStorage.setItem("authToken", data.token);
      window.localStorage.setItem("refreshToken", data.refreshToken || "");
      window.localStorage.setItem("user", JSON.stringify(data.user));
    },
    { name, email, password },
  );

  await page.goto("/");
  await waitForTodosViewIdle(page);
}

export async function waitForTodosViewIdle(page: Page) {
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await page.waitForFunction(() => {
    const content = document.getElementById("todosContent");
    if (!content) return false;
    const loading = content.querySelector(".loading");
    return !loading;
  });
  await expect(page.locator("#todosContent")).toBeVisible();
}
