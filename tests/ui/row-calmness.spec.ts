import { expect, test, type Page, type Route } from "@playwright/test";
import { bootstrapAndOpenTodosView } from "./helpers/todos-view";

type TodoSeed = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  completed?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

async function installRowCalmnessMockApi(page: Page, todosSeed: TodoSeed[]) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  let userSeq = 1;
  let tokenSeq = 1;

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
          order: index,
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
        name: "Row Calmness Tester",
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

    if (pathname.startsWith("/todos/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const todoId = pathname.split("/").pop() || "";
      const body = await parseBody(route);
      const todoList = todosByUser.get(userId) || [];
      const index = todoList.findIndex((todo) => String(todo.id) === todoId);
      if (index === -1) return json(route, 404, { error: "Todo not found" });
      const updatedTodo = {
        ...todoList[index],
        ...body,
        updatedAt: nowIso(),
      };
      todoList[index] = updatedTodo;
      todosByUser.set(userId, todoList);
      return json(route, 200, updatedTodo);
    }

    if (pathname === "/ai/suggestions" && method === "GET")
      return json(route, 200, []);
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
}

test.describe("Todo row calmness", () => {
  test.beforeEach(async ({ page }) => {
    await installRowCalmnessMockApi(page, [
      {
        id: "todo-due-project-medium",
        title: "Due + project + medium",
        description:
          "This description should clamp to one muted line in preview.",
        notes: null,
        category: "Work",
        dueDate: "2026-03-01T09:00:00.000Z",
        priority: "medium",
      },
      {
        id: "todo-due-project-high",
        title: "Due + project + high",
        description:
          "High priority should still hide when two chips already exist.",
        notes: null,
        category: "Home",
        dueDate: "2026-03-02T09:00:00.000Z",
        priority: "high",
      },
      {
        id: "todo-due-high-only",
        title: "Due + high without project",
        description: "This row should render due and high chips only.",
        notes: null,
        category: null,
        dueDate: "2026-03-03T09:00:00.000Z",
        priority: "high",
      },
    ]);

    await bootstrapAndOpenTodosView(page, {
      name: "Row Calmness User",
      email: "row-calmness@example.com",
    });
  });

  test("desktop hides kebab by default and reveals on hover/focus-within", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only hover/focus behavior");

    const row = page.locator(
      '.todo-item[data-todo-id="todo-due-project-medium"]',
    );
    const kebab = row.locator(".todo-kebab");

    await expect(kebab).toHaveCSS("opacity", "0");
    await expect(kebab).toHaveCSS("pointer-events", "none");

    await row.hover();
    await expect(kebab).toHaveCSS("opacity", "1");
    await expect(kebab).toHaveCSS("pointer-events", "auto");

    await page.mouse.move(0, 0);
    await row.focus();
    await expect(kebab).toHaveCSS("opacity", "1");
  });

  test("mobile keeps kebab visible without hover", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile-only visibility assertion");

    const kebab = page
      .locator('.todo-item[data-todo-id="todo-due-project-medium"] .todo-kebab')
      .first();
    await expect(kebab).toHaveCSS("opacity", "1");
    await expect(kebab).toHaveCSS("pointer-events", "auto");
  });

  test("chip density enforces strict max two with due/project/high ordering", async ({
    page,
  }) => {
    const mediumRow = page.locator(
      '.todo-item[data-todo-id="todo-due-project-medium"]',
    );
    await expect(mediumRow.locator(".todo-chip")).toHaveCount(2);
    await expect(mediumRow.locator(".todo-chip--due")).toHaveCount(1);
    await expect(mediumRow.locator(".todo-chip--project")).toHaveCount(1);
    await expect(mediumRow.locator(".todo-chip--priority.high")).toHaveCount(0);

    const highWithProjectRow = page.locator(
      '.todo-item[data-todo-id="todo-due-project-high"]',
    );
    await expect(highWithProjectRow.locator(".todo-chip")).toHaveCount(2);
    await expect(highWithProjectRow.locator(".todo-chip--due")).toHaveCount(1);
    await expect(highWithProjectRow.locator(".todo-chip--project")).toHaveCount(
      1,
    );
    await expect(
      highWithProjectRow.locator(".todo-chip--priority.high"),
    ).toHaveCount(0);

    const dueHighOnlyRow = page.locator(
      '.todo-item[data-todo-id="todo-due-high-only"]',
    );
    await expect(dueHighOnlyRow.locator(".todo-chip")).toHaveCount(2);
    await expect(dueHighOnlyRow.locator(".todo-chip--due")).toHaveCount(1);
    await expect(
      dueHighOnlyRow.locator(".todo-chip--priority.high"),
    ).toHaveCount(1);
  });

  test("completed row remains calm and readable", async ({ page }) => {
    const row = page.locator(
      '.todo-item[data-todo-id="todo-due-project-medium"]',
    );
    await row.locator(".todo-checkbox").click();

    await expect(row).toHaveClass(/completed/);
    await expect(row).toHaveCSS("opacity", "0.92");
  });

  test("row click opens drawer and kebab interaction stays isolated", async ({
    page,
  }) => {
    const row = page.locator(
      '.todo-item[data-todo-id="todo-due-project-medium"]',
    );
    await row.locator(".todo-title").click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.locator("#todoDrawerClose").click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await row.locator(".todo-kebab").click();
    await expect(row.locator(".todo-kebab-menu")).toBeVisible();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await page.keyboard.press("Escape");
    await expect(row.locator(".todo-kebab-menu")).toBeHidden();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
