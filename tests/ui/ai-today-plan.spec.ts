import { expect, test, type Page, type Route } from "@playwright/test";

type TodoRecord = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  order: number;
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    order: number;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

function todayAtIso(hours: number) {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

async function installTodayPlanMockApi(page: Page) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, TodoRecord[]>();
  let userSeq = 1;
  let tokenSeq = 1;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? JSON.parse(raw) : {};
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return "user-1";
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
      const password = String(body.password || "");
      if (users.has(email)) {
        return json(route, 409, { error: "Email already registered" });
      }
      const id = `user-${userSeq++}`;
      users.set(email, { id, email, password });
      const token = `token-${tokenSeq++}`;
      accessTokens.set(token, id);
      todosByUser.set(id, [
        {
          id: "todo-1",
          title: "Prepare launch architecture review packet",
          description: "",
          completed: false,
          category: "Website",
          dueDate: todayAtIso(9),
          priority: "medium",
          notes: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          order: 1,
          subtasks: [],
        },
        {
          id: "todo-2",
          title: "Email marketing status follow-up",
          description: "",
          completed: false,
          category: "Marketing",
          dueDate: todayAtIso(11),
          priority: "low",
          notes: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          order: 2,
          subtasks: [],
        },
        {
          id: "todo-3",
          title: "Refine release notes quick pass",
          description: "",
          completed: false,
          category: "Website",
          dueDate: todayAtIso(13),
          priority: "medium",
          notes: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          order: 3,
          subtasks: [],
        },
        {
          id: "todo-4",
          title: "Close QA checklist",
          description: "",
          completed: false,
          category: "Website",
          dueDate: todayAtIso(16),
          priority: "high",
          notes: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          order: 4,
          subtasks: [],
        },
      ]);
      return json(route, 201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      return json(route, 200, {
        id: userId,
        email: "today-plan@example.com",
        name: "Today Plan Tester",
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

    if (pathname === "/auth/logout" && method === "POST") {
      return json(route, 200, { ok: true });
    }

    return route.continue();
  });
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Today Plan User");
  await page.locator("#registerEmail").fill("today-plan-user@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

async function openTodayView(page: Page) {
  await page.locator("#moreFiltersToggle").click();
  await page.locator("#dateViewToday").click();
  await expect(page.locator('[data-testid="today-plan-panel"]')).toBeVisible();
}

test.describe("AI today planner panel", () => {
  test.beforeEach(async ({ page }) => {
    await installTodayPlanMockApi(page);
    await registerAndOpenTodos(page);
    await openTodayView(page);
  });

  test("panel appears in Today view and generate shows preview", async ({
    page,
  }) => {
    await expect(
      page.locator('[data-testid="today-plan-panel"]'),
    ).toBeVisible();

    await page
      .locator('[data-testid="today-plan-goal-input"]')
      .fill("quick wins");
    await page.locator('[data-testid="today-plan-generate"]').click();

    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="today-plan-preview"] .today-plan-preview__item',
      ),
    ).toHaveCount(3);
    await expect(
      page.locator('[data-testid="today-plan-suggestion-today-unknown"]'),
    ).toHaveCount(0);
  });

  test("checkboxes filter suggestions by selected todo", async ({ page }) => {
    await page.locator('[data-testid="today-plan-goal-input"]').fill("deep");
    await page.locator('[data-testid="today-plan-generate"]').click();
    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toBeVisible();

    await page
      .locator('[data-testid="today-plan-item-checkbox-todo-1"]')
      .uncheck();

    await expect(
      page.locator(
        '[data-testid^="today-plan-suggestion-"][data-today-plan-todo-id="todo-1"]',
      ),
    ).toHaveCount(0);
  });

  test("apply selected updates local todo state and undo reverts batch", async ({
    page,
  }) => {
    await page
      .locator('[data-testid="today-plan-goal-input"]')
      .fill("deep focus");
    await page.locator('[data-testid="today-plan-generate"]').click();
    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toBeVisible();

    await page.locator('[data-testid="today-plan-apply-selected"]').click();

    await expect(page.locator('[data-todo-id="todo-1"]')).toHaveCount(0);

    await page.locator('[data-testid="today-plan-undo"]').click();
    await expect(page.locator('[data-todo-id="todo-1"]')).toHaveCount(1);
  });

  test("dismiss hides a suggestion", async ({ page }) => {
    await page.locator('[data-testid="today-plan-generate"]').click();
    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toBeVisible();

    const suggestion = page
      .locator('[data-testid^="today-plan-suggestion-"]')
      .first();
    const suggestionId = await suggestion.getAttribute("data-testid");
    await suggestion
      .locator('[data-testid^="today-plan-suggestion-dismiss-"]')
      .click();

    await expect(page.locator(`[data-testid="${suggestionId}"]`)).toHaveCount(
      0,
    );
  });

  test("must_abstain path shows no safe plan", async ({ page }) => {
    await page.locator('[data-testid="today-plan-goal-input"]').fill("abstain");
    await page.locator('[data-testid="today-plan-generate"]').click();

    await expect(
      page.locator('[data-testid="today-plan-panel"]'),
    ).toContainText("No safe plan right now.");
  });
});
