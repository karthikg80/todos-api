import { expect, test, type Page, type Route } from "@playwright/test";
import {
  ensureAllTasksListActive,
  openTaskComposerSheet,
} from "./helpers/todos-view";

type TodoRecord = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  notes: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    order: number;
  }>;
};

type DrawerSuggestionRecord = {
  id: string;
  userId: string;
  todoId: string;
  status: "pending" | "accepted" | "rejected";
  outputEnvelope: {
    requestId: string;
    contractVersion: number;
    generatedAt: string;
    surface: "task_drawer";
    must_abstain: boolean;
    suggestions: Array<{
      suggestionId: string;
      type: string;
      confidence: number;
      rationale: string;
      payload: Record<string, unknown>;
      requiresConfirmation?: boolean;
    }>;
  };
  createdAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function installTaskDrawerLiveMockApi(page: Page) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, TodoRecord[]>();
  const drawerSuggestions = new Map<string, DrawerSuggestionRecord[]>();
  let userSeq = 1;
  let tokenSeq = 1;
  let todoSeq = 1;
  let suggestionSeq = 1;

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
    const { pathname, searchParams } = url;
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
      const userId = `user-${userSeq++}`;
      users.set(email, {
        id: userId,
        email,
        password: String(body.password || ""),
      });
      const token = `token-${tokenSeq++}`;
      accessTokens.set(token, userId);
      todosByUser.set(userId, []);
      drawerSuggestions.set(userId, []);
      return json(route, 201, {
        user: { id: userId, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      return json(route, 200, {
        id: userId,
        email: "drawer-live@example.com",
        name: "Drawer Live Tester",
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
      const list = todosByUser.get(userId) || [];
      const created: TodoRecord = {
        id: `todo-${todoSeq++}`,
        title: String(body.title || "").trim() || "Untitled",
        description: String(body.description || ""),
        completed: false,
        category: body.category ? String(body.category) : null,
        dueDate: body.dueDate ? String(body.dueDate) : null,
        priority:
          body.priority === "low" || body.priority === "high"
            ? body.priority
            : "medium",
        notes: body.notes ? String(body.notes) : null,
        order: list.length,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      };
      list.unshift(created);
      todosByUser.set(userId, list);
      return json(route, 201, created);
    }

    if (pathname.startsWith("/todos/") && method === "PUT") {
      const userId = authUserId(route);
      const todoId = pathname.split("/")[2] || "";
      const body = await parseBody(route);
      const list = todosByUser.get(userId) || [];
      const index = list.findIndex((item) => item.id === todoId);
      if (index === -1) return json(route, 404, { error: "Todo not found" });
      const existing = list[index];
      const updated: TodoRecord = {
        ...existing,
        ...("title" in body ? { title: String(body.title || "") } : {}),
        ...("description" in body
          ? { description: String(body.description || "") }
          : {}),
        ...("completed" in body ? { completed: !!body.completed } : {}),
        ...("category" in body
          ? { category: body.category ? String(body.category) : null }
          : {}),
        ...("dueDate" in body
          ? { dueDate: body.dueDate ? String(body.dueDate) : null }
          : {}),
        ...("priority" in body &&
        (body.priority === "low" ||
          body.priority === "medium" ||
          body.priority === "high")
          ? { priority: body.priority }
          : {}),
        ...("notes" in body
          ? { notes: body.notes ? String(body.notes) : null }
          : {}),
        updatedAt: nowIso(),
      };
      list[index] = updated;
      todosByUser.set(userId, list);
      return json(route, 200, updated);
    }

    if (pathname === "/ai/decision-assist/stub" && method === "POST") {
      const userId = authUserId(route);
      const body = await parseBody(route);
      if (body.surface !== "task_drawer") {
        return json(route, 400, { error: "Unsupported surface" });
      }
      const todoId = String(body.todoId || "");
      const list = todosByUser.get(userId) || [];
      const todo = list.find((item) => item.id === todoId);
      if (!todo) {
        return json(route, 404, { error: "Todo not found" });
      }

      const suggestionId = `drawer-suggestion-${suggestionSeq++}`;
      const record: DrawerSuggestionRecord = {
        id: suggestionId,
        userId,
        todoId,
        status: "pending",
        createdAt: nowIso(),
        outputEnvelope: {
          requestId: `req-${suggestionId}`,
          contractVersion: 1,
          generatedAt: nowIso(),
          surface: "task_drawer",
          must_abstain: false,
          suggestions: [
            {
              suggestionId: `${suggestionId}-rewrite`,
              type: "rewrite_title",
              confidence: 0.82,
              rationale: "Title can be sharpened for actionability.",
              payload: {
                todoId,
                title: `Draft ${todo.title}`,
              },
            },
          ],
        },
      };
      const suggestionList = drawerSuggestions.get(userId) || [];
      suggestionList.unshift(record);
      drawerSuggestions.set(userId, suggestionList);

      return json(route, 200, {
        ...record.outputEnvelope,
        suggestionId,
      });
    }

    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      const userId = authUserId(route);
      const todoId = String(searchParams.get("todoId") || "");
      const surface = String(searchParams.get("surface") || "");
      if (surface !== "task_drawer") {
        return json(route, 400, { error: "surface must be task_drawer" });
      }
      const suggestionList = drawerSuggestions.get(userId) || [];
      const latest = suggestionList.find(
        (item) => item.todoId === todoId && item.status === "pending",
      );
      if (!latest) {
        return route.fulfill({ status: 204 });
      }
      return json(route, 200, {
        aiSuggestionId: latest.id,
        status: latest.status,
        outputEnvelope: latest.outputEnvelope,
      });
    }

    if (
      pathname.startsWith("/ai/suggestions/") &&
      pathname.endsWith("/apply") &&
      method === "POST"
    ) {
      const userId = authUserId(route);
      const aiSuggestionId = pathname.split("/")[3] || "";
      const body = await parseBody(route);
      const suggestionList = drawerSuggestions.get(userId) || [];
      const record = suggestionList.find((item) => item.id === aiSuggestionId);
      if (!record) {
        return json(route, 404, { error: "Suggestion not found" });
      }
      const matched = record.outputEnvelope.suggestions.find(
        (item) => item.suggestionId === body.suggestionId,
      );
      if (!matched) {
        return json(route, 404, { error: "Suggestion item not found" });
      }
      const list = todosByUser.get(userId) || [];
      const todoIndex = list.findIndex((item) => item.id === record.todoId);
      if (todoIndex === -1) {
        return json(route, 404, { error: "Todo not found" });
      }

      if (matched.type === "rewrite_title") {
        list[todoIndex] = {
          ...list[todoIndex],
          title: String(matched.payload.title || list[todoIndex].title),
          updatedAt: nowIso(),
        };
      }
      todosByUser.set(userId, list);
      record.status = "accepted";

      return json(route, 200, {
        todo: list[todoIndex],
        appliedSuggestionId: matched.suggestionId,
        suggestion: {
          id: record.id,
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
      const aiSuggestionId = pathname.split("/")[3] || "";
      const suggestionList = drawerSuggestions.get(userId) || [];
      const record = suggestionList.find((item) => item.id === aiSuggestionId);
      if (!record) {
        return json(route, 404, { error: "Suggestion not found" });
      }
      record.status = "rejected";
      return route.fulfill({ status: 204 });
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
  await page.addInitScript(() => {
    window.localStorage.setItem("feature.taskDrawerDecisionAssist", "1");
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Drawer Live User");
  await page.locator("#registerEmail").fill("drawer-live-user@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

test.describe("AI task drawer decision assist live flow", () => {
  test.beforeEach(async ({ page }) => {
    await installTaskDrawerLiveMockApi(page);
    await registerAndOpenTodos(page);
  });

  test("renders server-backed drawer suggestions, applies rewrite title, and persists after reload", async ({
    page,
  }) => {
    await openTaskComposerSheet(page);
    await page.locator("#todoInput").fill("do thing");
    await page.locator("#taskComposerAddButton").click();

    const row = page.locator(".todo-item").first();
    await row.click();

    await page
      .locator(
        "#todoDetailsDrawer .ai-lint-chip__action[data-ai-lint-action='fix']",
      )
      .click();
    await expect(
      page.locator('[data-testid^="task-drawer-ai-card-"]'),
    ).toHaveCount(1);

    await page
      .locator('[data-testid^="task-drawer-ai-apply-"]')
      .first()
      .click();

    await expect(page.locator(".todo-item .todo-title").first()).toContainText(
      "Draft do thing",
    );

    await page.reload();
    await ensureAllTasksListActive(page);
    await expect(page.locator(".todo-item .todo-title").first()).toContainText(
      "Draft do thing",
    );
  });

  test("dismiss hides suggestions and keeps drawer empty after reload", async ({
    page,
  }) => {
    await openTaskComposerSheet(page);
    await page.locator("#todoInput").fill("do follow up");
    await page.locator("#taskComposerAddButton").click();

    const row = page.locator(".todo-item").first();
    await row.click();
    await page
      .locator(
        "#todoDetailsDrawer .ai-lint-chip__action[data-ai-lint-action='fix']",
      )
      .click();
    await expect(
      page.locator('[data-testid^="task-drawer-ai-card-"]'),
    ).toHaveCount(1);

    await page
      .locator('[data-testid^="task-drawer-ai-dismiss-"]')
      .first()
      .click();
    await expect(page.locator("#todoDetailsDrawer")).toContainText(
      "No suggestions right now.",
    );

    await page.reload();
    await ensureAllTasksListActive(page);
    await page.locator(".todo-item").first().click();
    await page
      .locator(
        "#todoDetailsDrawer .ai-lint-chip__action[data-ai-lint-action='fix']",
      )
      .click();
    await expect(page.locator("#todoDetailsDrawer")).toContainText(
      "No suggestions right now.",
    );
  });
});
