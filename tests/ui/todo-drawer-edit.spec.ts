import { expect, test, type Page, type Route } from "@playwright/test";
import { ensureAllTasksListActive } from "./helpers/todos-view";

type TodoSeed = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  completed?: boolean;
  order?: number;
};

type MockOptions = {
  failFirstUpdate?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

async function installDrawerEditMockApi(
  page: Page,
  todosSeed: TodoSeed[],
  options: MockOptions = {},
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
  let failedUpdate = false;

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
          ...todo,
          completed: !!todo.completed,
          order: Number.isInteger(todo.order) ? todo.order : index,
          userId: id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          subtasks: [],
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
        name: "Drawer Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
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

      if (options.failFirstUpdate && !failedUpdate) {
        failedUpdate = true;
        return json(route, 500, { error: "Save failed from mock" });
      }

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

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Drawer User");
  await page.locator("#registerEmail").fill("drawer@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

async function openFirstTodoDrawer(page: Page) {
  await page.locator(".todo-item .todo-title").first().click();
  await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(page.locator("#drawerTitleInput")).toBeVisible();
}

test.describe("Todo drawer essentials editing", () => {
  test("saves title via blur using shared update path", async ({ page }) => {
    const state = await installDrawerEditMockApi(page, [
      {
        id: "todo-1",
        title: "Original title",
        description: "Description",
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "medium",
      },
    ]);

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerTitleInput").fill("Updated title");
    await page.locator("#drawerPrioritySelect").focus();

    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) => entry.patch.title === "Updated title",
        ),
      )
      .toBeTruthy();

    await expect(page.locator("#drawerSaveStatus")).toContainText("Saved");
    await expect(page.getByText("Updated title")).toBeVisible();
  });

  test("saves due date, priority, and project on change", async ({ page }) => {
    const state = await installDrawerEditMockApi(page, [
      {
        id: "todo-1",
        title: "Task one",
        description: "Description",
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-2",
        title: "Task two",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerPrioritySelect").selectOption("high");
    await page.locator("#drawerProjectSelect").selectOption("Work");
    await page.locator("#drawerDueDateInput").fill("2026-05-01");

    await expect
      .poll(() =>
        state.updatePatches.some((entry) => entry.patch.priority === "high"),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some((entry) => entry.patch.category === "Work"),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) =>
            typeof entry.patch.dueDate === "string" &&
            String(entry.patch.dueDate).startsWith("2026-05-01"),
        ),
      )
      .toBeTruthy();

    await expect(page.locator("#drawerSaveStatus")).toContainText("Saved");
  });

  test("keeps focus and active-row highlight stable after save rerender", async ({
    page,
  }) => {
    const state = await installDrawerEditMockApi(page, [
      {
        id: "todo-focus-1",
        title: "Focus task",
        description: "Description",
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-focus-2",
        title: "Other task",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerTitleInput").fill("Focus task updated");
    await page.locator("#drawerTitleInput").press("Control+Enter");

    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) => entry.patch.title === "Focus task updated",
        ),
      )
      .toBeTruthy();

    await expect(page.locator("#drawerTitleInput")).toBeFocused();
    await expect(
      page.locator('.todo-item[data-todo-id="todo-focus-1"]'),
    ).toHaveClass(/todo-item--active/);
  });

  test("shows save error and preserves unsaved title on API failure", async ({
    page,
  }) => {
    await installDrawerEditMockApi(
      page,
      [
        {
          id: "todo-1",
          title: "Original title",
          description: "Description",
          notes: null,
          category: "Home",
          dueDate: null,
          priority: "medium",
        },
      ],
      { failFirstUpdate: true },
    );

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerTitleInput").fill("Unsaved local title");
    await page.locator("#drawerPrioritySelect").focus();

    await expect(page.locator("#drawerSaveStatus")).toContainText(
      "Save failed from mock",
    );
    await expect(page.locator("#drawerTitleInput")).toHaveValue(
      "Unsaved local title",
    );
  });
});
