import { chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const AUTH_DIR =
  process.env.PLAYWRIGHT_AUTH_DIR || path.join(".playwright", ".auth");
// Each Playwright worker process gets a unique PW_TEST_WORKER_INDEX env var
// (set before any module is imported). Using it here avoids concurrent
// read/write races when multiple workers call ensureTodosStorageState()
// simultaneously on a cold cache.
const WORKER_INDEX = process.env.PW_TEST_WORKER_INDEX ?? "0";
const STORAGE_STATE_FILE = path.join(
  AUTH_DIR,
  `todos-user-${WORKER_INDEX}.json`,
);
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const AUTH_TOKEN = "cached-ui-auth-token";
const REFRESH_TOKEN = "cached-ui-refresh-token";
const DEFAULT_BASE_URL = "http://127.0.0.1:4173";

function nowIso() {
  return new Date().toISOString();
}

function randomEmail() {
  return `ui_cached_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function setupAuthRoutes(page: Page) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  let userSeq = 1;

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();

    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (pathname === "/auth/bootstrap-admin/status" && method === "GET") {
      return json(200, { enabled: false, reason: "already_provisioned" });
    }

    if (pathname === "/auth/register" && method === "POST") {
      const body = JSON.parse(route.request().postData() || "{}") as {
        email?: string;
        password?: string;
        name?: string;
      };
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      if (users.has(email))
        return json(409, { error: "Email already registered" });

      const id = `cached-user-${userSeq++}`;
      users.set(email, { id, email, password });
      accessTokens.set(AUTH_TOKEN, id);

      return json(201, {
        user: { id, email, name: body.name || "Cached UI User" },
        token: AUTH_TOKEN,
        refreshToken: REFRESH_TOKEN,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const authHeader = route.request().headers().authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      const userId = accessTokens.get(token);
      if (!userId) return json(401, { error: "Unauthorized" });
      const user = Array.from(users.values()).find(
        (entry) => entry.id === userId,
      );
      if (!user) return json(404, { error: "User not found" });
      return json(200, {
        id: user.id,
        email: user.email,
        name: "Cached UI User",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") return json(200, []);
    if (pathname === "/todos" && method === "GET") return json(200, []);
    if (pathname === "/ai/suggestions" && method === "GET")
      return json(200, []);
    if (pathname === "/ai/usage" && method === "GET") {
      return json(200, {
        plan: "free",
        used: 0,
        limit: 10,
        remaining: 10,
        resetAt: nowIso(),
      });
    }
    if (pathname === "/ai/insights" && method === "GET") {
      return json(200, {
        generatedCount: 0,
        ratedCount: 0,
        acceptanceRate: null,
        recommendation: "",
      });
    }
    if (pathname === "/ai/feedback-summary" && method === "GET") {
      return json(200, {
        totalRated: 0,
        acceptedCount: 0,
        rejectedCount: 0,
      });
    }

    return route.continue();
  });
}

async function createContextAndRegister(outPath: string) {
  const browser = await chromium.launch();
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE_URL,
    });
    const page = await context.newPage();
    await setupAuthRoutes(page);

    await page.goto("/");
    await page.getByRole("button", { name: "Register" }).click();
    await page.locator("#registerName").fill("Cached UI User");
    await page.locator("#registerEmail").fill(randomEmail());
    await page.locator("#registerPassword").fill("Password123!");
    await page.getByRole("button", { name: "Create Account" }).click();

    await page.waitForSelector("#todosView.active");
    await page.waitForSelector("#todoInput");

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await context.storageState({ path: outPath });
  } finally {
    await context?.close();
    await browser.close();
  }
}

export async function createTodosStorageState(outPath: string): Promise<void> {
  await createContextAndRegister(outPath);
}

export async function ensureTodosStorageState(): Promise<string> {
  const resolvedPath = path.resolve(STORAGE_STATE_FILE);
  try {
    const stats = await fs.stat(resolvedPath);
    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs <= MAX_AGE_MS) {
      return resolvedPath;
    }
  } catch {
    // File missing or unreadable: regenerate.
  }

  await createTodosStorageState(resolvedPath);
  return resolvedPath;
}
