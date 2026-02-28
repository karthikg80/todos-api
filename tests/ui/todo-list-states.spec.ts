import { expect, test, type Page, type Route } from "@playwright/test";
import { ensureAllTasksListActive } from "./helpers/todos-view";

type TodoSeed = {
  id: string;
  title: string;
  description?: string | null;
  completed?: boolean;
  category?: string | null;
  dueDate?: string | null;
  priority?: "low" | "medium" | "high";
  notes?: string | null;
};

type TodosResponse = {
  status: number;
  body: unknown;
};

function mapTodosForUser(
  todos: TodoSeed[],
  userId: string,
  nowIso: string,
): Array<Record<string, unknown>> {
  return todos.map((todo, index) => ({
    id: todo.id,
    title: todo.title,
    description: todo.description ?? null,
    completed: todo.completed ?? false,
    category: todo.category ?? null,
    dueDate: todo.dueDate ?? null,
    priority: todo.priority ?? "medium",
    notes: todo.notes ?? null,
    userId,
    order: index,
    createdAt: nowIso,
    updatedAt: nowIso,
    subtasks: [],
  }));
}

async function installMockApi(
  page: Page,
  resolveTodos: (callCount: number, userId: string) => Promise<TodosResponse>,
) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  let userSeq = 1;
  let tokenSeq = 1;
  let todosCallCount = 0;

  const nowIso = () => new Date().toISOString();
  const nextUserId = () => `user-${userSeq++}`;
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
      if (users.has(email)) {
        return json(409, { error: "Email already registered" });
      }

      const id = nextUserId();
      users.set(email, { id, email, password });
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
        name: "List State Tester",
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
      todosCallCount += 1;
      const response = await resolveTodos(todosCallCount, userId);
      return json(response.status, response.body);
    }

    if (pathname === "/ai/suggestions" && method === "GET") {
      return json(200, []);
    }

    if (pathname === "/ai/usage" && method === "GET") {
      return json(200, {
        plan: "free",
        used: 0,
        limit: 10,
        remaining: 10,
        resetAt: nowIso(),
      });
    }

    if (pathname === "/ai/insights" && method === "GET") {
      return json(200, {
        generatedCount: 0,
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

    return route.continue();
  });
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("List States User");
  await page.locator("#registerEmail").fill("list-states@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

test.describe("Todo list states", () => {
  test("shows empty state when API returns []", async ({ page }) => {
    await installMockApi(page, async () => ({
      status: 200,
      body: [],
    }));

    await registerAndOpenTodos(page);

    await expect(page.locator("#todosEmptyState")).toBeVisible();
    await expect(page.locator("#todosEmptyState h3")).toHaveText(
      "No tasks yet",
    );
    await expect(page.locator("#todosEmptyState")).toContainText(
      "Ctrl/Cmd + N",
    );
  });

  test("shows error state and Retry reloads into populated list", async ({
    page,
  }) => {
    await installMockApi(page, async (callCount, userId) => {
      if (callCount === 1) {
        return {
          status: 500,
          body: { error: "temporary failure" },
        };
      }

      return {
        status: 200,
        body: mapTodosForUser(
          [{ id: "todo-retry-1", title: "Recovered task", priority: "medium" }],
          userId,
          new Date().toISOString(),
        ),
      };
    });

    await registerAndOpenTodos(page);

    await expect(page.locator("#todosErrorState")).toBeVisible();
    await expect(page.locator("#todosRetryLoadButton")).toBeVisible();

    await page.locator("#todosRetryLoadButton").click();

    await expect(page.locator("#todosErrorState")).toBeHidden();
    await expect(page.locator("#todosLoadingState")).toBeHidden();
    await expect(page.locator(".todo-item .todo-title")).toHaveText(
      "Recovered task",
    );
    await expect(page.locator(".todo-skeleton-row")).toHaveCount(0);
  });

  test("shows skeleton rows while todos request is in-flight", async ({
    page,
  }) => {
    let resolveTodosRequest: ((value: TodosResponse) => void) | null = null;
    const todosPromise = new Promise<TodosResponse>((resolve) => {
      resolveTodosRequest = resolve;
    });

    await installMockApi(page, async () => todosPromise);

    await registerAndOpenTodos(page);

    await expect(page.locator("#todosLoadingState")).toBeVisible();
    await expect(page.locator(".todo-skeleton-row")).toHaveCount(6);

    resolveTodosRequest?.({
      status: 200,
      body: [],
    });

    await expect(page.locator("#todosLoadingState")).toBeHidden();
    await expect(page.locator("#todosEmptyState")).toBeVisible();
  });
});
