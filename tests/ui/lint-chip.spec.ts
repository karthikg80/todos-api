import { expect, test, type Page, type Route } from "@playwright/test";
import {
  ensureAllTasksListActive,
  openTaskComposerSheet,
} from "./helpers/todos-view";

// ---------------------------------------------------------------------------
// Minimal mock API — covers auth, todos, and the AI endpoints that the full
// assist row calls so Fix/Review tests don't hit the real network.
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

async function installMockApi(page: Page) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  let userSeq = 1;
  let tokenSeq = 1;
  let todoSeq = 1;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? JSON.parse(raw) : {};
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return accessTokens.get(token) || "user-1";
  };

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const method = route.request().method();

    if (pathname === "/auth/bootstrap-admin/status" && method === "GET") {
      return json(route, 200, {
        enabled: false,
        reason: "already_provisioned",
      });
    }
    if (pathname === "/auth/register" && method === "POST") {
      const body = await parseBody(route);
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      if (users.has(email)) {
        return json(route, 409, { error: "Email already registered" });
      }
      const id = `user-${userSeq++}`;
      users.set(email, { id, email, password: String(body.password || "") });
      const token = `token-${tokenSeq++}`;
      accessTokens.set(token, id);
      todosByUser.set(id, []);
      return json(route, 201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }
    if (pathname === "/auth/login" && method === "POST") {
      const body = await parseBody(route);
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const user = users.get(email);
      if (!user) return json(route, 401, { error: "Invalid credentials" });
      const token = `token-${tokenSeq++}`;
      accessTokens.set(token, user.id);
      return json(route, 200, {
        user: { id: user.id, email, name: null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }
    if (pathname === "/auth/logout" && method === "POST") {
      return json(route, 200, { ok: true });
    }
    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      return json(route, 200, {
        id: userId,
        email: "lint-test@example.com",
        name: "Lint Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    if (pathname === "/projects" && method === "GET") {
      return json(route, 200, []);
    }
    if (pathname === "/todos" && method === "GET") {
      const userId = authUserId(route);
      return json(route, 200, todosByUser.get(userId) || []);
    }
    if (pathname === "/todos" && method === "POST") {
      const userId = authUserId(route);
      const body = await parseBody(route);
      const existing = todosByUser.get(userId) || [];
      const created = {
        id: `todo-${todoSeq++}`,
        title: String(body.title || "").trim() || "Untitled",
        completed: false,
        category: body.category ? String(body.category) : null,
        dueDate: body.dueDate ? String(body.dueDate) : null,
        priority:
          body.priority === "low" || body.priority === "high"
            ? body.priority
            : "medium",
        notes: body.notes ? String(body.notes) : null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      existing.unshift(created);
      todosByUser.set(userId, existing);
      return json(route, 201, created);
    }
    if (pathname.startsWith("/todos/") && method === "PUT") {
      const userId = authUserId(route);
      const body = await parseBody(route);
      const id = pathname.split("/")[2];
      const existing = todosByUser.get(userId) || [];
      const idx = existing.findIndex((t) => t.id === id);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...body, updatedAt: nowIso() };
        todosByUser.set(userId, existing);
        return json(route, 200, existing[idx]);
      }
      return json(route, 404, { error: "Not found" });
    }
    if (pathname === "/ai/suggestions" && method === "GET") {
      return json(route, 200, []);
    }
    if (pathname === "/ai/usage" && method === "GET") {
      return json(route, 200, {
        plan: "free",
        used: 0,
        limit: 10,
        remaining: 10,
        resetAt: nowIso(),
      });
    }
    if (pathname === "/ai/insights" && method === "GET") {
      return json(route, 200, {
        generatedCount: 0,
        ratedCount: 0,
        acceptanceRate: null,
        recommendation: "",
      });
    }
    if (pathname === "/ai/feedback-summary" && method === "GET") {
      return json(route, 200, {
        totalRated: 0,
        acceptedCount: 0,
        rejectedCount: 0,
      });
    }
    // AI decision-assist: return empty suggestions so the full assist row
    // renders (without chips), confirming the transition from lint to full UI.
    if (pathname === "/ai/decision-assist/stub" && method === "POST") {
      return json(route, 200, { ok: true });
    }
    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      return json(route, 200, null);
    }

    return route.continue();
  });
}

async function registerAndOpen(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Lint Test User");
  await page.locator("#registerEmail").fill("lint-test@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

// ---------------------------------------------------------------------------
// On-create surface
// ---------------------------------------------------------------------------

test.describe("Lint-first on-create chip", () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await registerAndOpen(page);
    await openTaskComposerSheet(page);
  });

  test("vague title shows lint chip; full assist chips are hidden", async ({
    page,
  }) => {
    await page.locator("#todoInput").fill("do stuff");
    await expect(page.locator(".ai-lint-chip")).toBeVisible();
    await expect(page.locator(".ai-create-assist__chips")).toBeHidden();
  });

  test("urgency language without due date shows missing_due_date chip", async ({
    page,
  }) => {
    await page.locator("#todoInput").fill("Submit the quarterly report today");
    await expect(
      page.locator(".ai-lint-chip[data-lint-code='missing_due_date']"),
    ).toBeVisible();
  });

  test("Fix button reveals full assist row", async ({ page }) => {
    await page.locator("#todoInput").fill("do stuff");
    await expect(page.locator(".ai-lint-chip")).toBeVisible();
    await page
      .locator(".ai-lint-chip__action[data-ai-lint-action='fix']")
      .click();
    // After Fix the lint chip should be gone and the assist header should appear
    await expect(page.locator(".ai-lint-chip")).toBeHidden();
    await expect(page.locator(".ai-create-assist__header")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Task drawer surface
// ---------------------------------------------------------------------------

test.describe("Lint-first task drawer chip", () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page);
    await registerAndOpen(page);
    await openTaskComposerSheet(page);
  });

  test("drawer shows lint chip for vague task title; full AI list hidden", async ({
    page,
  }) => {
    // Create a todo with a vague title
    await page.locator("#todoInput").fill("do stuff");
    await page.locator("#todoInput").press("Enter");
    // Wait for it to appear in the list
    await expect(page.locator(".todo-item").first()).toBeVisible();
    // Open drawer
    await page.locator(".todo-item").first().click();
    await expect(page.locator("#todoDetailsDrawer")).toBeVisible();
    // Lint chip should be in the AI section
    await expect(
      page.locator("#todoDetailsDrawer .ai-lint-chip"),
    ).toBeVisible();
    // Full AI list should not be rendered
    await expect(
      page.locator("#todoDetailsDrawer .todo-drawer-ai-list"),
    ).toBeHidden();
  });

  test("Fix in drawer reveals full AI suggestions section", async ({
    page,
  }) => {
    await page.locator("#todoInput").fill("handle things");
    await page.locator("#todoInput").press("Enter");
    await expect(page.locator(".todo-item").first()).toBeVisible();
    await page.locator(".todo-item").first().click();
    await expect(page.locator("#todoDetailsDrawer")).toBeVisible();
    await expect(
      page.locator("#todoDetailsDrawer .ai-lint-chip"),
    ).toBeVisible();
    await page
      .locator(
        "#todoDetailsDrawer .ai-lint-chip__action[data-ai-lint-action='fix']",
      )
      .click();
    // Lint chip should be gone; the AI Suggestions section title should appear
    await expect(page.locator("#todoDetailsDrawer .ai-lint-chip")).toBeHidden();
    await expect(
      page.locator("#todoDetailsDrawer .todo-drawer__section-title", {
        hasText: "AI Suggestions",
      }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// AI Plan not in nav (Task 102 already merged — verify here too)
// ---------------------------------------------------------------------------

test.describe("AI Plan excluded from nav surfaces", () => {
  test.beforeEach(async ({ page }) => {
    // Register the AI Plan todos override AFTER installMockApi so it runs
    // FIRST (Playwright routes are LIFO). Use route.fallback() — not
    // route.continue() — so unmatched requests fall through to installMockApi
    // instead of going to the network.
    await installMockApi(page);
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.pathname === "/todos" &&
        route.request().method() === "GET" &&
        route.request().headers().authorization
      ) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "todo-ai-plan-1",
              title: "AI generated task",
              completed: false,
              category: "AI Plan",
              dueDate: null,
              priority: "medium",
              notes: null,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            },
          ]),
        });
      }
      // Fall through to the installMockApi handler for all other routes.
      await route.fallback();
    });
    await registerAndOpen(page);
  });

  test("AI Plan is hidden from nav surfaces while its todos remain visible", async ({
    page,
  }) => {
    await expect(page.locator("[data-project-key='AI Plan']")).toHaveCount(0);
    await expect(
      page.locator("#categoryFilter option[value='AI Plan']"),
    ).toHaveCount(0);
    await expect(
      page.locator(".todo-item", { hasText: "AI generated task" }),
    ).toBeVisible();
  });
});
