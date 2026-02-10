import { expect, test, type Page, type Route } from "@playwright/test";

type MockState = {
  planFromGoalBodies: Array<Record<string, unknown>>;
};

type MockOptions = {
  planDelayMs?: number;
};

async function installBrainDumpMockApi(
  page: Page,
  options: MockOptions = {},
): Promise<MockState> {
  const state: MockState = {
    planFromGoalBodies: [],
  };

  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  const accessTokens = new Map<string, string>();
  let userSeq = 1;
  let todoSeq = 1;
  let tokenSeq = 1;

  const nowIso = () => new Date().toISOString();
  const nextUserId = () => `user-${userSeq++}`;
  const nextTodoId = () => `todo-${todoSeq++}`;
  const nextToken = () => `token-${tokenSeq++}`;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return {};
    return JSON.parse(raw);
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers()["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return accessTokens.get(token) || null;
  };

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
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
      const body = await parseBody(route);
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const existing = users.get(email);
      if (existing) return json(409, { error: "Email already registered" });
      const id = nextUserId();
      users.set(email, { id, email, password });
      todosByUser.set(id, []);
      const token = nextToken();
      const refreshToken = nextToken();
      accessTokens.set(token, id);
      return json(201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      const user = Array.from(users.values()).find(
        (item) => item.id === userId,
      );
      if (!user) return json(404, { error: "User not found" });
      return json(200, {
        id: user.id,
        email: user.email,
        name: "Brain Dump Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      return json(200, []);
    }

    if (pathname === "/todos" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      return json(200, todosByUser.get(userId) || []);
    }

    if (pathname === "/todos" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      const body = (await parseBody(route)) as Record<string, unknown>;
      const list = todosByUser.get(userId) || [];
      const todo = {
        id: nextTodoId(),
        title: String(body.title || ""),
        description: body.description ?? null,
        completed: false,
        category: body.category ?? null,
        dueDate: body.dueDate ?? null,
        order: list.length,
        priority: body.priority || "medium",
        notes: body.notes ?? null,
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      };
      list.push(todo);
      todosByUser.set(userId, list);
      return json(201, todo);
    }

    if (pathname === "/ai/plan-from-goal" && method === "POST") {
      const body = (await parseBody(route)) as Record<string, unknown>;
      state.planFromGoalBodies.push(body);
      if (options.planDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, options.planDelayMs),
        );
      }
      return json(200, {
        suggestionId: "brain-dump-suggestion-1",
        summary: "Draft from brain dump",
        tasks: [
          {
            tempId: "task-1",
            title: "First drafted task",
            description: "Drafted from freeform text",
            dueDate: null,
            priority: "medium",
            projectName: null,
            subtasks: [],
          },
          {
            tempId: "task-2",
            title: "Second drafted task",
            description: "Second drafted result",
            dueDate: null,
            priority: "high",
            projectName: null,
            subtasks: [],
          },
        ],
      });
    }

    if (pathname === "/ai/suggestions" && method === "GET") {
      return json(200, []);
    }

    if (pathname === "/ai/usage" && method === "GET") {
      return json(200, {
        plan: "free",
        used: 1,
        limit: 10,
        remaining: 9,
        resetAt: nowIso(),
      });
    }

    if (pathname === "/ai/insights" && method === "GET") {
      return json(200, {
        generatedCount: 1,
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

    if (pathname === "/auth/logout" && method === "POST") {
      return json(200, { ok: true });
    }

    if (
      pathname.startsWith("/ai/suggestions/") &&
      pathname.endsWith("/status")
    ) {
      return json(200, { ok: true });
    }

    return route.continue();
  });

  return state;
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Brain Dump User");
  await page.locator("#registerEmail").fill("brain-dump@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

test.describe("AI brain dump drafting", () => {
  test("blocks empty input and does not call plan endpoint", async ({
    page,
  }) => {
    const state = await installBrainDumpMockApi(page);
    await registerAndOpenTodos(page);

    await page
      .getByRole("button", { name: "Draft tasks from brain dump" })
      .click();

    await expect(page.locator("#todosMessage")).toContainText(
      "Enter a brain dump to draft tasks",
    );
    expect(state.planFromGoalBodies).toHaveLength(0);
  });

  test("uses brain dump text for /ai/plan-from-goal and renders selected tasks", async ({
    page,
  }) => {
    const state = await installBrainDumpMockApi(page);
    await registerAndOpenTodos(page);

    const brainDumpText =
      "Launch notes: finalize onboarding copy, align QA, prepare support handoff.";
    await page.locator("#brainDumpInput").fill(brainDumpText);
    await page
      .getByRole("button", { name: "Draft tasks from brain dump" })
      .click();

    await expect(page.locator(".plan-draft-panel")).toBeVisible();
    await expect(page.locator(".plan-draft-count")).toHaveText("2/2 selected");
    await expect(
      page.locator('input[aria-label="Include task 1"]'),
    ).toBeChecked();
    await expect(
      page.locator('input[aria-label="Include task 2"]'),
    ).toBeChecked();

    expect(state.planFromGoalBodies).toHaveLength(1);
    expect(state.planFromGoalBodies[0]).toMatchObject({
      goal: brainDumpText,
    });
  });

  test("disables draft button in-flight and prevents double submit", async ({
    page,
  }) => {
    const state = await installBrainDumpMockApi(page, { planDelayMs: 300 });
    await registerAndOpenTodos(page);

    await page
      .locator("#brainDumpInput")
      .fill("Draft this plan from rough text");

    await page.locator("#brainDumpPlanButton").dblclick();
    await expect(page.locator("#brainDumpPlanButton")).toBeDisabled();
    await expect(page.locator("#brainDumpPlanButton")).toContainText(
      "Drafting...",
    );

    await expect(page.locator(".plan-draft-panel")).toBeVisible();
    await expect(page.locator("#brainDumpPlanButton")).toBeEnabled();
    expect(state.planFromGoalBodies).toHaveLength(1);
  });
});
