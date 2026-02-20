import { expect, test, type Page, type Route } from "@playwright/test";

type MockApiOptions = {
  failTodoCreateAt?: number | null;
};

type MockApiState = {
  createdTodoPayloads: Array<Record<string, unknown>>;
  suggestionStatusPayloads: Array<Record<string, unknown>>;
  eventLog: string[];
};

async function installAiPlanMockApi(
  page: Page,
  options: MockApiOptions = {},
): Promise<MockApiState> {
  const state: MockApiState = {
    createdTodoPayloads: [],
    suggestionStatusPayloads: [],
    eventLog: [],
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
  let todoCreateCount = 0;

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
        name: "Plan Tester",
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

      todoCreateCount += 1;
      if (
        options.failTodoCreateAt &&
        todoCreateCount === options.failTodoCreateAt
      ) {
        return json(500, { error: "Create failed intentionally" });
      }

      const body = (await parseBody(route)) as Record<string, unknown>;
      state.createdTodoPayloads.push(body);
      state.eventLog.push("todo-create");
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
      return json(200, {
        suggestionId: "suggestion-1",
        summary: "Plan from goal",
        tasks: [
          {
            tempId: "task-1",
            title: "Draft task alpha",
            description: "Initial alpha description",
            dueDate: null,
            priority: "medium",
            projectName: null,
            subtasks: [],
          },
          {
            tempId: "task-2",
            title: "Draft task beta",
            description: "Initial beta description",
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

    if (
      pathname === "/ai/suggestions/suggestion-1/status" &&
      method === "PUT"
    ) {
      const body = (await parseBody(route)) as Record<string, unknown>;
      state.suggestionStatusPayloads.push(body);
      state.eventLog.push("suggestion-status");
      return json(200, { ok: true });
    }

    if (pathname === "/auth/logout" && method === "POST") {
      return json(200, { ok: true });
    }

    return route.continue();
  });

  return state;
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/?ai_debug=1");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Plan User");
  await page.locator("#registerEmail").fill("plan@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  const aiToggle = page.locator("#aiWorkspaceToggle");
  if ((await aiToggle.getAttribute("aria-expanded")) !== "true") {
    await aiToggle.click();
    await expect(aiToggle).toHaveAttribute("aria-expanded", "true");
  }
}

test.describe("AI plan draft apply", () => {
  test("applies edited selected task values and updates suggestion after creates", async ({
    page,
  }) => {
    const state = await installAiPlanMockApi(page);
    await registerAndOpenTodos(page);

    await page.locator("#goalInput").fill("Ship launch prep");
    await page.getByRole("button", { name: "Generate Plan" }).click();
    await expect(page.locator(".plan-draft-panel")).toBeVisible();

    await page.locator("#planDraftTitleInput-0").fill("Edited Alpha Title");
    await page
      .locator("#planDraftDescriptionInput-0")
      .fill("Edited alpha description");
    await page.locator("#planDraftDueDateInput-0").fill("2026-03-15");
    await page.locator("#planDraftProjectInput-0").fill("Launch");
    await page.locator("#planDraftPriorityInput-0").selectOption("high");

    await page.locator('input[aria-label="Include task 2"]').uncheck();
    await page.getByRole("button", { name: "Apply selected tasks" }).click();

    await expect(page.locator("#todosMessage")).toContainText(
      "Added 1 AI-planned",
    );
    expect(state.createdTodoPayloads).toHaveLength(1);
    expect(state.createdTodoPayloads[0]).toMatchObject({
      title: "Edited Alpha Title",
      description: "Edited alpha description",
      category: "Launch",
      priority: "high",
      dueDate: "2026-03-15T12:00:00.000Z",
    });
    expect(state.suggestionStatusPayloads).toHaveLength(1);
    expect(state.suggestionStatusPayloads[0]).toMatchObject({
      status: "accepted",
    });
    expect(state.eventLog).toEqual(["todo-create", "suggestion-status"]);

    await page.locator("#goalInput").fill("Zero selection check");
    await page.getByRole("button", { name: "Generate Plan" }).click();
    await expect(page.locator(".plan-draft-panel")).toBeVisible();
    await page.getByRole("button", { name: "Select none" }).click();
    await page.getByRole("button", { name: "Apply selected tasks" }).click();
    await expect(page.locator("#todosMessage")).toContainText(
      "Select at least one plan task to apply",
    );
    expect(state.createdTodoPayloads).toHaveLength(1);
  });

  test("handles partial todo-create failure without marking suggestion accepted", async ({
    page,
  }) => {
    const state = await installAiPlanMockApi(page, { failTodoCreateAt: 2 });
    await registerAndOpenTodos(page);

    await page.locator("#goalInput").fill("Partial failure path");
    await page.getByRole("button", { name: "Generate Plan" }).click();
    await expect(page.locator(".plan-draft-panel")).toBeVisible();

    await page.getByRole("button", { name: "Apply selected tasks" }).click();

    await expect(page.locator("#todosMessage")).toContainText(
      "Created 1 of 2 tasks",
    );
    expect(state.createdTodoPayloads).toHaveLength(1);
    expect(state.suggestionStatusPayloads).toHaveLength(0);
    await expect(page.locator(".plan-draft-task-row")).toHaveCount(1);
  });
});
