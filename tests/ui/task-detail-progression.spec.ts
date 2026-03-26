import { expect, test, type Page, type Route } from "@playwright/test";
import { openTodosViewWithStorageState } from "./helpers/todos-view";

type TodoSeed = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  completed?: boolean;
  status?: string;
  order?: number;
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

async function installTaskDetailProgressionMockApi(
  page: Page,
  todosSeed: TodoSeed[],
) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  const updatePatches: Array<{
    todoId: string;
    patch: Record<string, unknown>;
  }> = [];
  let userSeq = 1;
  let tokenSeq = 1;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? JSON.parse(raw) : {};
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const knownUserId = accessTokens.get(token);
    if (knownUserId) return knownUserId;
    if (!token) return null;

    const id = `cached-user-${userSeq++}`;
    accessTokens.set(token, id);
    users.set(`cached-${id}@example.com`, {
      id,
      email: `cached-${id}@example.com`,
      password: "",
    });
    todosByUser.set(
      id,
      todosSeed.map((todo, index) => ({
        ...todo,
        completed: !!todo.completed,
        status: todo.status || (todo.completed ? "done" : "next"),
        order: Number.isInteger(todo.order) ? todo.order : index,
        userId: id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
      })),
    );
    return id;
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

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, {
        id: userId,
        email: `${userId}@example.com`,
        name: "Task Progression User",
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

    if (pathname.startsWith("/todos/") && method === "PUT") {
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

    if (pathname.includes("/subtasks/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const [, , todoId, , subtaskId] = pathname.split("/");
      const patch = (await parseBody(route)) as Record<string, unknown>;
      const list = todosByUser.get(userId) || [];
      const todo = list.find((item) => String(item.id) === todoId);
      if (!todo) return json(route, 404, { error: "Todo not found" });
      const subtasks = Array.isArray(todo.subtasks) ? todo.subtasks : [];
      const idx = subtasks.findIndex((item) => String(item.id) === subtaskId);
      if (idx === -1) return json(route, 404, { error: "Subtask not found" });
      const next = {
        ...subtasks[idx],
        ...patch,
      };
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

    return route.continue();
  });

  return { updatePatches };
}

test.describe("Task detail progression", () => {
  async function openTaskProgressionPage(page: Page) {
    return installTaskDetailProgressionMockApi(page, [
      {
        id: "todo-1",
        title: "Plan launch messaging",
        description: "Draft a cleaner rollout note for the launch.",
        notes: null,
        category: "Work",
        dueDate: "2026-05-01T12:00:00.000Z",
        priority: "high",
        status: "next",
        subtasks: [
          {
            id: "subtask-1",
            title: "Review current draft",
            completed: false,
            order: 0,
          },
        ],
      },
    ]);
  }

  test("description opens inline editor and saves in place", async ({
    page,
  }) => {
    const state = await openTaskProgressionPage(page);

    await openTodosViewWithStorageState(page, {
      name: "Task Progression User",
      email: "task-progression-inline@example.com",
    });

    await page
      .getByRole("button", { name: "Edit note for Plan launch messaging" })
      .click();

    await expect(
      page.locator('[data-inline-editor-for="todo-1"]'),
    ).toBeVisible();

    const inlineInput = page.locator(
      '[data-inline-description-input="todo-1"]',
    );
    await inlineInput.fill("Updated inline context for the launch note");
    await inlineInput.blur();

    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) =>
            entry.todoId === "todo-1" &&
            entry.patch.description ===
              "Updated inline context for the launch note",
        ),
      )
      .toBeTruthy();

    await expect(
      page.locator('.todo-item[data-todo-id="todo-1"] .todo-description'),
    ).toContainText("Updated inline context for the launch note");
  });

  test("inline editor escalates into the drawer with the draft preserved", async ({
    page,
  }) => {
    await openTaskProgressionPage(page);
    await openTodosViewWithStorageState(page, {
      name: "Task Progression User",
      email: "task-progression-drawer@example.com",
    });

    await page
      .getByRole("button", { name: "Edit note for Plan launch messaging" })
      .click();

    const inlineInput = page.locator(
      '[data-inline-description-input="todo-1"]',
    );
    await inlineInput.fill("Escalate this into the quick panel");

    await page.getByRole("button", { name: "More details" }).click();

    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.locator("#drawerDetailsToggle").click();
    await expect(page.locator("#drawerDescriptionTextarea")).toHaveValue(
      "Escalate this into the quick panel",
    );
  });

  test("drawer escalates into the full task page", async ({ page }) => {
    await openTaskProgressionPage(page);
    await openTodosViewWithStorageState(page, {
      name: "Task Progression User",
      email: "task-progression-page@example.com",
    });

    await page.locator('.todo-item[data-todo-id="todo-1"] .todo-title').click();

    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.getByRole("button", { name: "Open full task" }).click();

    await expect(page.locator("#taskPageTitleInput")).toBeVisible();
    await expect(page.locator("#taskPageTitleInput")).toHaveValue(
      "Plan launch messaging",
    );
    await expect(page.locator("#taskPageDescriptionTextarea")).toContainText(
      "Draft a cleaner rollout note for the launch.",
    );
    await expect
      .poll(() => page.evaluate(() => window.location.hash))
      .toBe("#task/todo-1");
  });
});
