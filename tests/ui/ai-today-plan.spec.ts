import { expect, test, type Page, type Route } from "@playwright/test";

type TodoRecord = {
  id: string;
  title: string;
  description: string | null;
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

type SuggestionItem = {
  type: string;
  suggestionId: string;
  confidence: number;
  rationale: string;
  payload: Record<string, unknown>;
};

type TodayPlanRecord = {
  aiSuggestionId: string;
  status: "pending" | "accepted" | "rejected";
  outputEnvelope: {
    surface: "today_plan";
    requestId: string;
    contractVersion: number;
    generatedAt: string;
    must_abstain: boolean;
    planPreview: {
      topN: number;
      items: Array<{
        todoId: string;
        rank: number;
        timeEstimateMin: number;
        rationale: string;
      }>;
    };
    suggestions: SuggestionItem[];
  };
};

function nowIso() {
  return new Date().toISOString();
}

function todayAtIso(hours: number) {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

async function installTodayPlanLiveMockApi(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("feature.taskDrawerDecisionAssist", "true");
  });

  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, TodoRecord[]>();
  const plansByUser = new Map<string, TodayPlanRecord[]>();
  let userSeq = 1;
  let tokenSeq = 1;
  let aiSeq = 1;
  let suggestionSeq = 1;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? JSON.parse(raw) : {};
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return accessTokens.get(token) || null;
  };

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const { pathname, searchParams } = url;
    const method = route.request().method();

    if (pathname === "/auth/bootstrap-admin/status" && method === "GET") {
      return json(route, 200, {
        enabled: false,
        reason: "already_provisioned",
      });
    }

    if (pathname === "/auth/register" && method === "POST") {
      const body = (await parseBody(route)) as Record<string, unknown>;
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
          description: null,
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
          description: null,
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
          description: null,
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
      ]);
      plansByUser.set(id, []);
      return json(route, 201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
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
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, todosByUser.get(userId) || []);
    }

    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const surface = searchParams.get("surface") || "";
      if (surface !== "today_plan") {
        return route.fulfill({ status: 204, body: "" });
      }
      const plans = plansByUser.get(userId) || [];
      const latest = plans.find((item) => item.status === "pending") || null;
      if (!latest) {
        return route.fulfill({ status: 204, body: "" });
      }
      return json(route, 200, {
        aiSuggestionId: latest.aiSuggestionId,
        status: latest.status,
        outputEnvelope: latest.outputEnvelope,
      });
    }

    if (pathname === "/ai/decision-assist/stub" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const body = (await parseBody(route)) as Record<string, unknown>;
      if (String(body.surface || "") !== "today_plan") {
        return json(route, 400, { error: "surface must be today_plan" });
      }
      const todos = todosByUser.get(userId) || [];
      const goal = String(body.goal || "").toLowerCase();
      if (goal.includes("abstain")) {
        const aiSuggestionId = `ai-${aiSeq++}`;
        const abstainRecord: TodayPlanRecord = {
          aiSuggestionId,
          status: "pending",
          outputEnvelope: {
            surface: "today_plan",
            requestId: `today-plan-${aiSuggestionId}`,
            contractVersion: 1,
            generatedAt: nowIso(),
            must_abstain: true,
            planPreview: { topN: 3, items: [] },
            suggestions: [],
          },
        };
        plansByUser.set(userId, [abstainRecord]);
        return json(route, 200, {
          ...abstainRecord.outputEnvelope,
          suggestionId: aiSuggestionId,
        });
      }

      const top = todos.slice(0, 3);
      const aiSuggestionId = `ai-${aiSeq++}`;
      const suggestions: SuggestionItem[] = [];
      const previewItems = top.map((todo, index) => ({
        todoId: todo.id,
        rank: index + 1,
        timeEstimateMin: index === 0 ? 45 : 30,
        rationale:
          index === 0 ? "Primary focus block." : "Quick execution pass.",
      }));

      for (const item of previewItems) {
        suggestions.push({
          type: "set_due_date",
          suggestionId: `s-${suggestionSeq++}`,
          confidence: 0.74,
          rationale: "Assign concrete deadline for execution.",
          payload: {
            todoId: item.todoId,
            dueDateISO: todayAtIso(16 + item.rank),
          },
        });
      }
      if (previewItems[0]) {
        suggestions.push({
          type: "set_priority",
          suggestionId: `s-${suggestionSeq++}`,
          confidence: 0.8,
          rationale: "Top item should be high priority.",
          payload: {
            todoId: previewItems[0].todoId,
            priority: "high",
          },
        });
      }
      if (previewItems[0]) {
        suggestions.push({
          type: "unknown_type",
          suggestionId: "today-unknown",
          confidence: 0.4,
          rationale: "ignored",
          payload: { todoId: previewItems[0].todoId },
        });
      }

      const record: TodayPlanRecord = {
        aiSuggestionId,
        status: "pending",
        outputEnvelope: {
          surface: "today_plan",
          requestId: `today-plan-${aiSuggestionId}`,
          contractVersion: 1,
          generatedAt: nowIso(),
          must_abstain: false,
          planPreview: {
            topN: previewItems.length,
            items: previewItems,
          },
          suggestions,
        },
      };
      plansByUser.set(userId, [record]);
      return json(route, 200, {
        ...record.outputEnvelope,
        suggestionId: aiSuggestionId,
      });
    }

    if (
      pathname.startsWith("/ai/suggestions/") &&
      pathname.endsWith("/apply") &&
      method === "POST"
    ) {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const aiSuggestionId = pathname.split("/")[3] || "";
      const body = (await parseBody(route)) as Record<string, unknown>;
      const selectedTodoIds = Array.isArray(body.selectedTodoIds)
        ? new Set(body.selectedTodoIds.map((item) => String(item)))
        : null;
      const plans = plansByUser.get(userId) || [];
      const record = plans.find(
        (item) => item.aiSuggestionId === aiSuggestionId,
      );
      if (!record || record.status !== "pending") {
        return json(route, 404, { error: "Suggestion not found" });
      }

      const plannedIds = new Set(
        record.outputEnvelope.planPreview.items.map((item) => item.todoId),
      );
      const allowedIds = selectedTodoIds
        ? new Set(
            [...selectedTodoIds].filter((todoId) => plannedIds.has(todoId)),
          )
        : plannedIds;

      const todos = todosByUser.get(userId) || [];
      const updatedTodos: TodoRecord[] = [];
      for (const suggestion of record.outputEnvelope.suggestions) {
        const todoId = String(suggestion.payload.todoId || "");
        if (!todoId || !allowedIds.has(todoId)) continue;
        const todo = todos.find((item) => item.id === todoId);
        if (!todo) continue;
        if (suggestion.type === "set_priority") {
          todo.priority = String(
            suggestion.payload.priority || todo.priority,
          ) as "low" | "medium" | "high";
        }
        if (suggestion.type === "set_due_date") {
          todo.dueDate = String(suggestion.payload.dueDateISO || todo.dueDate);
        }
        todo.updatedAt = nowIso();
        const existingIndex = updatedTodos.findIndex(
          (item) => item.id === todo.id,
        );
        if (existingIndex >= 0) {
          updatedTodos[existingIndex] = { ...todo };
        } else {
          updatedTodos.push({ ...todo });
        }
      }

      record.status = "accepted";
      return json(route, 200, {
        updatedCount: updatedTodos.length,
        todos: updatedTodos,
        suggestion: {
          id: record.aiSuggestionId,
          status: "accepted",
        },
      });
    }

    if (
      pathname.startsWith("/ai/suggestions/") &&
      pathname.endsWith("/dismiss") &&
      method === "POST"
    ) {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const aiSuggestionId = pathname.split("/")[3] || "";
      const plans = plansByUser.get(userId) || [];
      const record = plans.find(
        (item) => item.aiSuggestionId === aiSuggestionId,
      );
      if (record) {
        record.status = "rejected";
      }
      return route.fulfill({ status: 204, body: "" });
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
    await installTodayPlanLiveMockApi(page);
    await registerAndOpenTodos(page);
    await openTodayView(page);
  });

  test("generate persists across reload and unknown suggestion types are ignored", async ({
    page,
  }) => {
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

    await page.reload();
    await openTodayView(page);
    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="today-plan-preview"] .today-plan-preview__item',
      ),
    ).toHaveCount(3);
  });

  test("checkboxes filter which suggestion cards are shown", async ({
    page,
  }) => {
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

  test("apply selected updates chosen todo, undo is local, reload restores persisted server state", async ({
    page,
  }) => {
    await page.locator('[data-testid="today-plan-generate"]').click();
    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toBeVisible();

    await page
      .locator('[data-testid="today-plan-item-checkbox-todo-2"]')
      .uncheck();

    await page.locator('[data-testid="today-plan-apply-selected"]').click();

    await page.locator('[data-todo-id="todo-1"] .todo-content').click();
    await expect(page.locator("#drawerPrioritySelect")).toHaveValue("high");

    await page.keyboard.press("Escape");
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await page.locator('[data-testid="today-plan-undo"]').click();
    await page.locator('[data-todo-id="todo-1"] .todo-content').click();
    await expect(page.locator("#drawerPrioritySelect")).toHaveValue("medium");

    await page.reload();
    await openTodayView(page);
    await page.locator('[data-todo-id="todo-1"] .todo-content').click();
    await expect(page.locator("#drawerPrioritySelect")).toHaveValue("high");
  });

  test("dismiss persists and clears plan after reload", async ({ page }) => {
    await page.locator('[data-testid="today-plan-generate"]').click();
    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toBeVisible();

    await page
      .locator('[data-testid^="today-plan-suggestion-dismiss-"]')
      .first()
      .click();

    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toHaveCount(0);

    await page.reload();
    await openTodayView(page);
    await expect(
      page.locator('[data-testid="today-plan-preview"]'),
    ).toHaveCount(0);
  });

  test("must_abstain path shows no safe plan", async ({ page }) => {
    await page.locator('[data-testid="today-plan-goal-input"]').fill("abstain");
    await page.locator('[data-testid="today-plan-generate"]').click();

    await expect(
      page.locator('[data-testid="today-plan-panel"]'),
    ).toContainText("No safe plan right now.");
  });
});
