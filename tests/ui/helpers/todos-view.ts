import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import fs from "node:fs/promises";
import { ensureTodosStorageState } from "./storage-state";

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

type StorageStatePayload = {
  origins?: Array<{
    origin?: string;
    localStorage?: Array<{ name: string; value: string }>;
  }>;
};

function getBaseOrigin() {
  return new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173")
    .origin;
}

async function applyCachedLocalStorage(page: Page, storageStatePath: string) {
  const raw = await fs.readFile(storageStatePath, "utf8");
  const state = JSON.parse(raw) as StorageStatePayload;
  const baseOrigin = getBaseOrigin();
  const originEntry =
    state.origins?.find((entry) => entry.origin === baseOrigin) ||
    state.origins?.find((entry) => entry.origin?.includes("127.0.0.1:4173")) ||
    state.origins?.[0];

  const entries = originEntry?.localStorage || [];
  await page.addInitScript((localStorageEntries) => {
    window.localStorage.clear();
    for (const entry of localStorageEntries) {
      window.localStorage.setItem(entry.name, entry.value);
    }
  }, entries);
}

export async function openTodosViewWithStorageState(
  page: Page,
  options: RegisterOptions,
) {
  const storageStatePath = await ensureTodosStorageState();
  await applyCachedLocalStorage(page, storageStatePath);
  await page.goto("/");

  try {
    await waitForTodosViewIdle(page);
    return;
  } catch {
    // Fallback keeps tests deterministic when a spec uses strict auth token mocks.
    await bootstrapAndOpenTodosView(page, options);
  }
}

export async function bootstrapTodosContext(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
  storageStatePath: string;
}> {
  const storageStatePath = await ensureTodosStorageState();
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173",
    storageState: storageStatePath,
  });
  const page = await context.newPage();
  await page.goto("/");
  return { context, page, storageStatePath };
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
