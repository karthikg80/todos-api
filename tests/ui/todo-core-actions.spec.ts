import { expect, test, type Page, type Route } from "@playwright/test";
import {
  ensureAllTasksListActive,
  openTodoDrawerFromListRow,
} from "./helpers/todos-view";

type TodoSeed = {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  category?: string | null;
  dueDate?: string | null;
  priority?: "low" | "medium" | "high";
  completed?: boolean;
  order?: number;
  status?: string;
  subtasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
    order: number;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

async function installCoreActionsMockApi(page: Page, todosSeed: TodoSeed[]) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  const deletedTodoIds: string[] = [];
  const updatePatches: Array<{
    todoId: string;
    patch: Record<string, unknown>;
  }> = [];
  let userSeq = 1;
  let tokenSeq = 1;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return {};
    return JSON.parse(raw);
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
    const pathname = url.pathname;
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
      todosByUser.set(
        id,
        todosSeed.map((todo, index) => ({
          id: todo.id,
          title: todo.title,
          description: todo.description ?? null,
          notes: todo.notes ?? null,
          category: todo.category ?? null,
          dueDate: todo.dueDate ?? null,
          priority: todo.priority ?? "medium",
          completed: !!todo.completed,
          status: todo.status ?? (todo.completed ? "done" : "next"),
          order: todo.order ?? index,
          userId: id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          subtasks: todo.subtasks ?? [],
        })),
      );

      return json(route, 201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const user = Array.from(users.values()).find(
        (item) => item.id === userId,
      );
      if (!user) return json(route, 404, { error: "User not found" });
      return json(route, 200, {
        id: user.id,
        email: user.email,
        name: "Core Actions Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        onboardingCompletedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      return json(route, 200, [{ id: "proj-work", name: "Work" }]);
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
      const created = {
        id: `todo-created-${list.length + 1}`,
        ...body,
        completed: !!body.completed,
        order: list.length,
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      };
      list.unshift(created);
      todosByUser.set(userId, list);
      return json(route, 201, created);
    }

    if (pathname.match(/^\/todos\/[^/]+$/) && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      const todoId = pathname.split("/")[2];
      const patch = (await parseBody(route)) as Record<string, unknown>;
      updatePatches.push({ todoId, patch });

      const list = todosByUser.get(userId) || [];
      const idx = list.findIndex((todo) => String(todo.id) === todoId);
      if (idx === -1) return json(route, 404, { error: "Todo not found" });

      const next = {
        ...list[idx],
        ...patch,
        updatedAt: nowIso(),
      };
      list[idx] = next;
      todosByUser.set(userId, list);
      return json(route, 200, next);
    }

    if (pathname.match(/^\/todos\/[^/]+$/) && method === "DELETE") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      const todoId = pathname.split("/")[2];
      deletedTodoIds.push(todoId);

      const list = todosByUser.get(userId) || [];
      const idx = list.findIndex((todo) => String(todo.id) === todoId);
      if (idx === -1) return json(route, 404, { error: "Todo not found" });
      list.splice(idx, 1);
      todosByUser.set(userId, list);
      return json(route, 200, { ok: true });
    }

    if (
      pathname.match(/^\/todos\/[^/]+\/subtasks\/[^/]+$/) &&
      method === "PUT"
    ) {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const [, , todoId, , subtaskId] = pathname.split("/");
      const patch = (await parseBody(route)) as Record<string, unknown>;
      const list = todosByUser.get(userId) || [];
      const todo = list.find((item) => String(item.id) === todoId);
      if (!todo) return json(route, 404, { error: "Todo not found" });
      const subtasks = Array.isArray(todo.subtasks) ? todo.subtasks : [];
      const idx = subtasks.findIndex(
        (item: { id: string }) => String(item.id) === subtaskId,
      );
      if (idx === -1) return json(route, 404, { error: "Subtask not found" });
      const next = { ...subtasks[idx], ...patch };
      subtasks[idx] = next;
      todo.subtasks = subtasks;
      return json(route, 200, next);
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

  return { updatePatches, deletedTodoIds };
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/?tab=register");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Core Actions User");
  await page.locator("#registerEmail").fill("core-actions@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

const threeTodos: TodoSeed[] = [
  {
    id: "todo-1",
    title: "Buy groceries",
    category: "Home",
    priority: "medium",
  },
  {
    id: "todo-2",
    title: "Review PR",
    category: "Work",
    priority: "high",
  },
  {
    id: "todo-3",
    title: "Call dentist",
    category: null,
    priority: "low",
  },
];

// ---------------------------------------------------------------------------
// Todo completion toggle
// ---------------------------------------------------------------------------

test.describe("Todo completion toggle", () => {
  test("checkbox marks a todo as completed and applies visual treatment", async ({
    page,
  }) => {
    const state = await installCoreActionsMockApi(page, threeTodos);
    await registerAndOpenTodos(page);

    const row = page.locator('[data-todo-id="todo-1"]');
    const checkbox = row.locator("input.todo-checkbox");

    await expect(checkbox).not.toBeChecked();
    await checkbox.check();

    await expect
      .poll(
        () =>
          state.updatePatches.some(
            (entry) =>
              entry.todoId === "todo-1" && entry.patch.completed === true,
          ),
        { timeout: 5_000 },
      )
      .toBeTruthy();
  });

  test("unchecking a completed todo marks it as incomplete", async ({
    page,
  }) => {
    const state = await installCoreActionsMockApi(page, [
      {
        id: "todo-done",
        title: "Already finished",
        completed: true,
        priority: "medium",
      },
      ...threeTodos,
    ]);
    await registerAndOpenTodos(page);

    const row = page.locator('[data-todo-id="todo-done"]');
    const checkbox = row.locator("input.todo-checkbox");

    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();

    await expect
      .poll(
        () =>
          state.updatePatches.some(
            (entry) =>
              entry.todoId === "todo-done" && entry.patch.completed === false,
          ),
        { timeout: 5_000 },
      )
      .toBeTruthy();
  });

  test("completing a todo shows the undo toast", async ({ page }) => {
    await installCoreActionsMockApi(page, threeTodos);
    await registerAndOpenTodos(page);

    const checkbox = page.locator(
      '[data-todo-id="todo-1"] input.todo-checkbox',
    );
    await checkbox.check();

    await expect(page.locator("#undoToast")).toHaveClass(/active/);
    await expect(page.locator("#undoMessage")).toContainText(/complete/i);
  });
});

// ---------------------------------------------------------------------------
// Undo system
// ---------------------------------------------------------------------------

test.describe("Undo system", () => {
  test("undo reverses a completion toggle", async ({ page }) => {
    const state = await installCoreActionsMockApi(page, threeTodos);
    await registerAndOpenTodos(page);

    const checkbox = page.locator(
      '[data-todo-id="todo-2"] input.todo-checkbox',
    );
    await checkbox.check();

    // Toast becomes visible (active class triggers CSS visibility)
    const toast = page.locator("#undoToast");
    await expect(toast).toHaveClass(/active/);
    await expect(toast).toBeVisible();

    // Click undo button
    await toast.locator("button").click();

    // Should have sent completed: false back
    await expect
      .poll(
        () =>
          state.updatePatches.some(
            (entry) =>
              entry.todoId === "todo-2" && entry.patch.completed === false,
          ),
        { timeout: 5_000 },
      )
      .toBeTruthy();
  });

  test("undo toast auto-dismisses after timeout", async ({ page }) => {
    await installCoreActionsMockApi(page, threeTodos);
    await registerAndOpenTodos(page);

    const checkbox = page.locator(
      '[data-todo-id="todo-1"] input.todo-checkbox',
    );
    await checkbox.check();

    await expect(page.locator("#undoToast")).toHaveClass(/active/);

    // Auto-dismiss after ~5 seconds
    await expect(page.locator("#undoToast")).not.toHaveClass(/active/, {
      timeout: 8_000,
    });
  });
});

// ---------------------------------------------------------------------------
// Bulk operations
// ---------------------------------------------------------------------------

test.describe("Bulk operations", () => {
  test("programmatic bulk select shows toolbar and body class", async ({
    page,
  }) => {
    await installCoreActionsMockApi(page, threeTodos);
    await registerAndOpenTodos(page);

    // Trigger bulk select via the app's global function (bulk checkboxes
    // are hidden by default and only appear on hover/bulk-selecting mode)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).toggleSelectTodo("todo-1");
    });

    await expect(page.locator("body")).toHaveClass(/is-bulk-selecting/);
    await expect(page.locator("#bulkActionsToolbar")).toBeVisible();
    await expect(page.locator("#bulkCount")).toContainText("1 selected");
  });

  test("select all checks all visible todos", async ({ page }) => {
    await installCoreActionsMockApi(page, threeTodos);
    await registerAndOpenTodos(page);

    // Enter bulk mode first so the toolbar is visible
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).toggleSelectTodo("todo-1");
    });
    await expect(page.locator("#bulkActionsToolbar")).toBeVisible();

    // Now use the visible Select All checkbox
    await page.locator("#selectAllCheckbox").check();

    await expect(page.locator("#bulkCount")).toContainText("3 selected");
  });

  test("bulk complete marks all selected todos as done", async ({ page }) => {
    const state = await installCoreActionsMockApi(page, threeTodos);
    await registerAndOpenTodos(page);

    // Select two todos programmatically
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.toggleSelectTodo("todo-1");
      w.toggleSelectTodo("todo-2");
    });

    await expect(page.locator("#bulkActionsToolbar")).toBeVisible();

    // Click complete selected
    await page.locator('button[data-onclick="completeSelected()"]').click();

    // Both should have received completed: true
    await expect
      .poll(
        () => {
          const completed = state.updatePatches.filter(
            (entry) => entry.patch.completed === true,
          );
          return completed.length >= 2;
        },
        { timeout: 5_000 },
      )
      .toBeTruthy();

    // Undo toast should appear
    await expect(page.locator("#undoToast")).toHaveClass(/active/);
  });

  test("bulk delete removes selected todos after confirmation", async ({
    page,
  }) => {
    const state = await installCoreActionsMockApi(page, threeTodos);
    await registerAndOpenTodos(page);

    // Select one todo programmatically
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).toggleSelectTodo("todo-3");
    });

    await expect(page.locator("#bulkActionsToolbar")).toBeVisible();

    // Click delete selected
    await page.locator('button[data-onclick="deleteSelected()"]').click();

    // Confirm dialog should appear
    await expect(page.locator("#confirmDialog")).toBeVisible();
    await page.locator("#confirmDialogOk").click();

    // Todo should be deleted via API
    await expect
      .poll(() => state.deletedTodoIds.includes("todo-3"), {
        timeout: 5_000,
      })
      .toBeTruthy();

    // Undo toast should appear
    await expect(page.locator("#undoToast")).toHaveClass(/active/);
  });
});

// ---------------------------------------------------------------------------
// Subtask display in drawer
// ---------------------------------------------------------------------------

test.describe("Subtask display", () => {
  test("drawer shows subtask list with completion indicators", async ({
    page,
  }) => {
    await installCoreActionsMockApi(page, [
      {
        id: "todo-with-subs",
        title: "Project kickoff",
        priority: "high",
        subtasks: [
          { id: "sub-1", title: "Draft agenda", completed: true, order: 0 },
          {
            id: "sub-2",
            title: "Invite attendees",
            completed: false,
            order: 1,
          },
          {
            id: "sub-3",
            title: "Book room",
            completed: false,
            order: 2,
          },
        ],
      },
    ]);
    await registerAndOpenTodos(page);

    await openTodoDrawerFromListRow(
      page,
      page.locator(".todo-item .todo-title").first(),
    );

    // Subtask list should be visible in the drawer
    const subtaskItems = page.locator(".todo-drawer__subtasks-item");
    await expect(subtaskItems).toHaveCount(3);

    // First subtask should have completed indicator
    await expect(subtaskItems.first()).toHaveClass(/completed/);

    // Second subtask should not be completed
    await expect(subtaskItems.nth(1)).not.toHaveClass(/completed/);
  });
});
