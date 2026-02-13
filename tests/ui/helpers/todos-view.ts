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
