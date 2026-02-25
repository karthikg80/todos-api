import { expect, test, type Page, type Route } from "@playwright/test";
import {
  ensureAllTasksListActive,
  openTaskComposerSheet,
} from "./helpers/todos-view";

type UserRecord = {
  id: string;
  email: string;
  password: string;
  name: string | null;
  isVerified: boolean;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
};

type TodoRecord = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  category: string | null;
  dueDate: string | null;
  order: number;
  priority: "low" | "medium" | "high";
  notes: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    order: number;
    todoId: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

async function installMockApi(page: Page) {
  const users = new Map<string, UserRecord>();
  const todosByUserId = new Map<string, TodoRecord[]>();
  const accessTokens = new Map<string, string>();
  const refreshTokens = new Map<string, string>();

  let userSeq = 1;
  let todoSeq = 1;
  let tokenSeq = 1;

  const now = () => new Date().toISOString();
  const mkUserId = () => `user-${userSeq++}`;
  const mkTodoId = () => `todo-${todoSeq++}`;
  const mkToken = (prefix: string) => `${prefix}-${tokenSeq++}`;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return {};
    return JSON.parse(raw);
  };

  const bearerUserId = (route: Route) => {
    const auth = route.request().headers()["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    return accessTokens.get(token) || null;
  };

  const userDto = (user: UserRecord) => ({
    id: user.id,
    email: user.email,
    name: user.name,
  });
  const profileDto = (user: UserRecord) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    isVerified: user.isVerified,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

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
      const name =
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : null;

      if (users.has(email))
        return json(409, { error: "Email already registered" });

      const user: UserRecord = {
        id: mkUserId(),
        email,
        password,
        name,
        isVerified: false,
        role: "user",
        createdAt: now(),
        updatedAt: now(),
      };
      users.set(email, user);
      todosByUserId.set(user.id, []);

      const token = mkToken("access");
      const refreshToken = mkToken("refresh");
      accessTokens.set(token, user.id);
      refreshTokens.set(refreshToken, user.id);

      return json(201, { user: userDto(user), token, refreshToken });
    }

    if (pathname === "/auth/login" && method === "POST") {
      const body = await parseBody(route);
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const user = users.get(email);
      if (!user || user.password !== password)
        return json(401, { error: "Invalid credentials" });

      const token = mkToken("access");
      const refreshToken = mkToken("refresh");
      accessTokens.set(token, user.id);
      refreshTokens.set(refreshToken, user.id);
      return json(200, { user: userDto(user), token, refreshToken });
    }

    if (pathname === "/auth/refresh" && method === "POST") {
      const body = await parseBody(route);
      const userId = refreshTokens.get(String(body.refreshToken || ""));
      if (!userId) return json(401, { error: "Invalid refresh token" });
      const token = mkToken("access");
      const refreshToken = mkToken("refresh");
      accessTokens.set(token, userId);
      refreshTokens.set(refreshToken, userId);
      return json(200, { token, refreshToken });
    }

    if (pathname === "/auth/logout" && method === "POST") {
      const body = await parseBody(route);
      refreshTokens.delete(String(body.refreshToken || ""));
      return json(200, { message: "Logged out successfully" });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = bearerUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      const user = Array.from(users.values()).find(
        (candidate) => candidate.id === userId,
      );
      if (!user) return json(404, { error: "User not found" });
      return json(200, profileDto(user));
    }

    if (pathname === "/todos" && method === "GET") {
      const userId = bearerUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      const todos = (todosByUserId.get(userId) || [])
        .slice()
        .sort((a, b) => a.order - b.order);
      return json(200, todos);
    }

    if (pathname === "/todos" && method === "POST") {
      const userId = bearerUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });

      const body = await parseBody(route);
      const list = todosByUserId.get(userId) || [];
      const todo: TodoRecord = {
        id: mkTodoId(),
        title: String(body.title || ""),
        description: body.description ?? null,
        completed: false,
        category: body.category ?? null,
        dueDate: body.dueDate ?? null,
        order: list.length,
        priority: body.priority || "medium",
        notes: body.notes ?? null,
        userId,
        createdAt: now(),
        updatedAt: now(),
        subtasks: [],
      };
      list.push(todo);
      todosByUserId.set(userId, list);
      return json(201, todo);
    }

    if (pathname.startsWith("/todos/") && method === "DELETE") {
      const userId = bearerUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });

      const todoId = pathname.split("/")[2];
      const list = todosByUserId.get(userId) || [];
      const next = list
        .filter((todo) => todo.id !== todoId)
        .map((todo, idx) => ({ ...todo, order: idx }));
      const deleted = next.length !== list.length;
      todosByUserId.set(userId, next);
      if (!deleted) return json(404, { error: "Todo not found" });
      return route.fulfill({ status: 204, body: "" });
    }

    return route.continue();
  });
}

async function openMoreFilters(page: Page) {
  const toggle = page.locator("#moreFiltersToggle");
  await toggle.click();
  const panel = page.locator("#moreFiltersPanel");
  if (!(await panel.isVisible())) {
    await page.evaluate(() => {
      document
        .getElementById("moreFiltersPanel")
        ?.classList.add("more-filters--open");
    });
  }
  await expect(panel).toBeVisible();
}

test.describe("App smoke flows", () => {
  test("login/register/logout/account-switch/delete/reload consistency", async ({
    page,
  }) => {
    await installMockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Register" }).click();
    await page.locator("#registerName").fill("User One");
    await page.locator("#registerEmail").fill("user1@example.com");
    await page.locator("#registerPassword").fill("Password123!");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.locator("#todosView")).toHaveClass(/active/);

    await ensureAllTasksListActive(page);
    await openTaskComposerSheet(page);
    await page.locator("#todoInput").fill("Smoke Todo A");
    await page.locator("#taskComposerAddButton").click();
    await expect(
      page.locator(".todo-item .todo-title", { hasText: "Smoke Todo A" }),
    ).toBeVisible();

    await page.reload();
    await ensureAllTasksListActive(page);
    await expect(
      page.locator(".todo-item .todo-title", { hasText: "Smoke Todo A" }),
    ).toBeVisible();

    const firstRow = page.locator(".todo-item").first();
    await firstRow.hover();
    await firstRow.locator(".todo-kebab").click();
    await firstRow.locator(".todo-kebab-item--danger").click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#drawerDeleteTodoButton").click();
    await expect(
      page.locator(".todo-item .todo-title", { hasText: "Smoke Todo A" }),
    ).toHaveCount(0);

    await page.reload();
    await ensureAllTasksListActive(page);
    await expect(
      page.locator(".todo-item .todo-title", { hasText: "Smoke Todo A" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.locator("#authView")).toHaveClass(/active/);

    await page.getByRole("button", { name: "Register" }).click();
    await page.locator("#registerName").fill("User Two");
    await page.locator("#registerEmail").fill("user2@example.com");
    await page.locator("#registerPassword").fill("Password123!");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.locator("#todosView")).toHaveClass(/active/);
    await expect(page.getByText("Smoke Todo A")).toHaveCount(0);
  });

  test("logout resets date view filter for next session", async ({ page }) => {
    await installMockApi(page);
    await page.goto("/");

    await page.getByRole("button", { name: "Register" }).click();
    await page.locator("#registerName").fill("Date View User One");
    await page.locator("#registerEmail").fill("date-view-one@example.com");
    await page.locator("#registerPassword").fill("Password123!");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.locator("#todosView")).toHaveClass(/active/);
    await openMoreFilters(page);
    await page.locator("#dateViewSomeday").click();
    await expect(page.locator("#dateViewSomeday")).toHaveClass(/active/);

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.locator("#authView")).toHaveClass(/active/);

    await page.getByRole("button", { name: "Register" }).click();
    await page.locator("#registerName").fill("Date View User Two");
    await page.locator("#registerEmail").fill("date-view-two@example.com");
    await page.locator("#registerPassword").fill("Password123!");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.locator("#dateViewAll")).toHaveClass(/active/);
    await expect(page.locator("#dateViewSomeday")).not.toHaveClass(/active/);
  });
});
