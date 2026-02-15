import { expect, test, type Page, type Route } from "@playwright/test";

type SuggestionItem = {
  type: string;
  suggestionId: string;
  confidence: number;
  rationale: string;
  payload: Record<string, unknown>;
  requiresConfirmation?: boolean;
};

type DecisionRecord = {
  aiSuggestionId: string;
  todoId: string;
  status: "pending" | "accepted" | "rejected";
  outputEnvelope: {
    surface: string;
    requestId: string;
    contractVersion: number;
    generatedAt: string;
    must_abstain: boolean;
    suggestions: SuggestionItem[];
  };
};

async function installOnCreateLiveMockApi(page: Page) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  const aiByUser = new Map<string, Array<DecisionRecord>>();
  let userSeq = 1;
  let tokenSeq = 1;
  let todoSeq = 1;
  let aiSeq = 1;
  let suggestionSeq = 1;

  const nowIso = () => new Date().toISOString();
  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? JSON.parse(raw) : {};
  };
  const authUserId = (route: Route) => {
    const authHeader = route.request().headers()["authorization"] || "";
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
      if (users.has(email))
        return json(route, 409, { error: "Email already registered" });
      const userId = `user-${userSeq++}`;
      users.set(email, {
        id: userId,
        email,
        password: String(body.password || ""),
      });
      const token = `token-${tokenSeq++}`;
      accessTokens.set(token, userId);
      todosByUser.set(userId, []);
      aiByUser.set(userId, []);
      return json(route, 201, {
        user: { id: userId, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, {
        id: userId,
        email: "on-create-live@example.com",
        name: "On Create Live Tester",
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

    if (pathname === "/todos" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const body = (await parseBody(route)) as Record<string, unknown>;
      const list = todosByUser.get(userId) || [];
      const todoId = `todo-${todoSeq++}`;
      const todo = {
        id: todoId,
        title: String(body.title || "").trim(),
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
      list.unshift(todo);
      todosByUser.set(userId, list);
      return json(route, 201, todo);
    }

    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const todoId = searchParams.get("todoId") || "";
      const surface = searchParams.get("surface") || "";
      const records = aiByUser.get(userId) || [];
      const latest = records.find(
        (record) =>
          record.status === "pending" &&
          record.todoId === todoId &&
          record.outputEnvelope.surface === surface,
      );
      if (!latest) return route.fulfill({ status: 204, body: "" });
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
      const surface = String(body.surface || "");
      if (surface !== "on_create") {
        return json(route, 400, { error: "surface must be on_create" });
      }
      const todoId = String(body.todoId || "");
      const aiSuggestionId = `ai-${aiSeq++}`;
      const rewriteId = `s-${suggestionSeq++}`;
      const priorityId = `s-${suggestionSeq++}`;
      const record: DecisionRecord = {
        aiSuggestionId,
        todoId,
        status: "pending",
        outputEnvelope: {
          surface: "on_create",
          requestId: `request-${aiSuggestionId}`,
          contractVersion: 1,
          generatedAt: nowIso(),
          must_abstain: false,
          suggestions: [
            {
              type: "rewrite_title",
              suggestionId: rewriteId,
              confidence: 0.82,
              rationale: "Title is vague",
              payload: {
                todoId,
                title: "Define next step for email follow-up",
              },
            },
            {
              type: "set_priority",
              suggestionId: priorityId,
              confidence: 0.78,
              rationale: "Urgency keyword detected",
              requiresConfirmation: true,
              payload: {
                todoId,
                priority: "high",
              },
            },
          ],
        },
      };
      const records = aiByUser.get(userId) || [];
      records.unshift(record);
      aiByUser.set(userId, records);
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
      const suggestionId = String(body.suggestionId || "");
      const records = aiByUser.get(userId) || [];
      const record = records.find(
        (item) => item.aiSuggestionId === aiSuggestionId,
      );
      if (!record || record.status !== "pending") {
        return json(route, 404, { error: "Suggestion not found" });
      }
      const primitive = record.outputEnvelope.suggestions.find(
        (item) => item.suggestionId === suggestionId,
      );
      if (!primitive)
        return json(route, 404, { error: "Suggestion item not found" });

      const todos = todosByUser.get(userId) || [];
      const todo = todos.find((item) => item.id === primitive.payload.todoId);
      if (!todo) return json(route, 404, { error: "Target todo not found" });

      if (primitive.type === "set_priority" && body.confirmed !== true) {
        return json(route, 400, {
          error: "Setting high priority requires confirmation",
        });
      }

      if (primitive.type === "rewrite_title") {
        todo.title = String(primitive.payload.title || todo.title);
      }
      if (primitive.type === "set_priority") {
        todo.priority = String(primitive.payload.priority || todo.priority);
      }
      todo.updatedAt = nowIso();
      record.status = "accepted";

      return json(route, 200, {
        todo,
        suggestion: {
          id: record.aiSuggestionId,
          status: "accepted",
        },
        appliedSuggestionId: suggestionId,
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
      const records = aiByUser.get(userId) || [];
      const record = records.find(
        (item) => item.aiSuggestionId === aiSuggestionId,
      );
      if (record) record.status = "rejected";
      return route.fulfill({ status: 204, body: "" });
    }

    if (pathname === "/ai/suggestions" && method === "GET") {
      return json(route, 200, []);
    }

    if (pathname === "/ai/usage" && method === "GET") {
      return json(route, 200, {
        plan: "free",
        used: 1,
        limit: 10,
        remaining: 9,
        resetAt: nowIso(),
      });
    }

    if (pathname === "/ai/insights" && method === "GET") {
      return json(route, 200, {
        generatedCount: 1,
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
  await page.locator("#registerEmail").fill("oncreate-live@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

test.describe("On-create decision assist live", () => {
  test("shows server-backed chips after create, applies rewrite, and persists after reload", async ({
    page,
  }) => {
    await installOnCreateLiveMockApi(page);
    await registerAndOpenTodos(page);

    await page.locator("#todoInput").fill("email follow up");
    await page.getByRole("button", { name: "Add Task" }).click();

    await expect(
      page.locator('[data-testid="ai-on-create-row"]'),
    ).toBeVisible();
    await expect(page.locator(".ai-create-chip")).toHaveCount(2);

    const rewriteCard = page
      .locator(".ai-create-chip")
      .filter({ hasText: "Rewrite title" })
      .first();
    await rewriteCard.getByRole("button", { name: "Apply" }).click();

    await expect(page.locator(".todo-title").first()).toContainText(
      "Define next step for email follow-up",
    );

    await page.reload();
    await expect(page.locator(".todo-title").first()).toContainText(
      "Define next step for email follow-up",
    );
    await expect(page.locator(".ai-create-chip")).toHaveCount(0);
  });

  test("dismisses on-create suggestions and keeps empty state after reload", async ({
    page,
  }) => {
    await installOnCreateLiveMockApi(page);
    await registerAndOpenTodos(page);

    await page.locator("#todoInput").fill("urgent website fix");
    await page.getByRole("button", { name: "Add Task" }).click();

    const firstCard = page.locator(".ai-create-chip").first();
    await firstCard.getByRole("button", { name: "Dismiss" }).click();

    await expect(page.locator(".ai-create-chip")).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".ai-create-chip")).toHaveCount(0);
  });
});
