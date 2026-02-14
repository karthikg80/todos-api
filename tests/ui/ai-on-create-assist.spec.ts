import { expect, test, type Page, type Route } from "@playwright/test";

type TodoRecord = {
  id: string;
  title: string;
  completed: boolean;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function installOnCreateMockApi(page: Page) {
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
      todosByUser.set(id, []);
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
        email: "on-create@example.com",
        name: "On Create Tester",
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
      const created: TodoRecord = {
        id: `todo-${existing.length + 1}`,
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
  await page.locator("#registerName").fill("On Create User");
  await page.locator("#registerEmail").fill("on-create-user@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

test.describe("AI on-create assist chips", () => {
  test.beforeEach(async ({ page }) => {
    await installOnCreateMockApi(page);
    await registerAndOpenTodos(page);
  });

  test("shows assist row when title is non-empty and caps chips with expand", async ({
    page,
  }) => {
    await page
      .locator("#todoInput")
      .fill("urgent tomorrow website marketing email stuff personal unknown");

    const assistRow = page.locator('[data-testid="ai-on-create-row"]');
    await expect(assistRow).toBeVisible();

    const chipCount = await page.locator(".ai-create-chip").count();
    expect(chipCount).toBeLessThanOrEqual(4);

    await expect(
      page.locator('[data-testid="ai-chip-oc-unknown-type"]'),
    ).toHaveCount(0);

    await page.locator('[data-testid="ai-chip-expand-more"]').click();
    const expandedChipCount = await page.locator(".ai-create-chip").count();
    expect(expandedChipCount).toBeLessThanOrEqual(6);
    expect(expandedChipCount).toBeGreaterThan(4);
  });

  test("apply rewrite_title updates input and undo restores", async ({
    page,
  }) => {
    await page.locator("#todoInput").fill("email follow up");

    await page
      .locator('[data-testid="ai-chip-apply-oc-rewrite-vague"]')
      .click();
    await expect(page.locator("#todoInput")).toHaveValue(
      "Email stakeholder with specific next step and deadline",
    );

    await page.locator('[data-testid="ai-chip-undo-oc-rewrite-vague"]').click();
    await expect(page.locator("#todoInput")).toHaveValue("email follow up");
  });

  test("apply set_priority updates active priority control", async ({
    page,
  }) => {
    await page.locator("#todoInput").fill("urgent task to finish");

    await page
      .locator('[data-testid="ai-chip-apply-oc-set-priority-urgent"]')
      .click();
    await expect(page.locator("#priorityHigh")).toHaveClass(/active/);
  });

  test("apply set_due_date updates due input", async ({ page }) => {
    await page.locator("#todoInput").fill("finish report tomorrow");

    await page
      .locator('[data-testid="ai-chip-apply-oc-set-due-tomorrow"]')
      .click();
    await expect(page.locator("#todoDueDateInput")).not.toHaveValue("");
  });

  test("dismiss hides chip", async ({ page }) => {
    await page.locator("#todoInput").fill("website update");

    await expect(
      page.locator('[data-testid="ai-chip-oc-set-project-website"]'),
    ).toBeVisible();
    await page
      .locator('[data-testid="ai-chip-dismiss-oc-set-project-website"]')
      .click();
    await expect(
      page.locator('[data-testid="ai-chip-oc-set-project-website"]'),
    ).toHaveCount(0);
  });

  test("requiresConfirmation enforces confirm step", async ({ page }) => {
    await page.locator("#todoInput").fill("asap yesterday fix bug");

    await page.locator('[data-testid="ai-chip-apply-oc-set-due-past"]').click();
    await expect(
      page.locator('[data-testid="ai-chip-confirm-oc-set-due-past"]'),
    ).toBeVisible();

    await page
      .locator('[data-testid="ai-chip-confirm-oc-set-due-past"]')
      .click();
    await expect(page.locator("#todoDueDateInput")).not.toHaveValue("");
  });

  test("ask_clarification choice updates project draft and marks answered", async ({
    page,
  }) => {
    await page.locator("#todoInput").fill("website marketing follow up");

    await page
      .locator('[data-testid="ai-chip-apply-oc-clarify-project"]')
      .click();
    await page
      .locator(
        '[data-ai-create-action="choose"][data-ai-create-choice-value="Website"]',
      )
      .click();

    await expect(page.locator("#todoProjectSelect")).toHaveValue("Website");
    await expect(
      page.locator('[data-testid="ai-chip-oc-clarify-project"]'),
    ).toContainText("Thanks");
  });
});
