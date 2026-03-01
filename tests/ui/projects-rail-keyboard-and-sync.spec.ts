import { expect, test, type Page, type Route } from "@playwright/test";
import { registerAndOpenTodosView } from "./helpers/todos-view";

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

type ProjectRecord = {
  id: string;
  name: string;
};

const LONG_PROJECT =
  "Project Name With A Very Long Context That Should Never Cause Horizontal Overflow In Todos";

function nowIso() {
  return new Date().toISOString();
}

function normalizeProjectName(value: unknown) {
  return String(value || "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
}

async function installRailSyncMockApi(page: Page, todosSeed: TodoSeed[]) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  const projectsByUser = new Map<string, ProjectRecord[]>();
  let userSeq = 1;
  let tokenSeq = 1;
  let projectSeq = 1;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return {};
    return JSON.parse(raw);
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return null;
    return accessTokens.get(token) || "user-1";
  };

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  const upsertProjectsFromTodos = (userId: string) => {
    const todoList = todosByUser.get(userId) || [];
    const discovered = new Set<string>();
    for (const todo of todoList) {
      const normalized = normalizeProjectName(todo.category);
      if (!normalized) continue;
      const parts = normalized.split(" / ");
      for (let i = 1; i <= parts.length; i += 1) {
        discovered.add(parts.slice(0, i).join(" / "));
      }
    }

    const existing = projectsByUser.get(userId) || [];
    const next = [...existing];
    for (const projectName of discovered) {
      if (!next.some((item) => item.name === projectName)) {
        next.push({ id: `project-${projectSeq++}`, name: projectName });
      }
    }

    next.sort((a, b) => a.name.localeCompare(b.name));
    projectsByUser.set(userId, next);
  };

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

      const seededTodos = todosSeed.map((todo, index) => ({
        ...todo,
        completed: !!todo.completed,
        order: Number.isInteger(todo.order) ? todo.order : index,
        userId: id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      }));
      todosByUser.set(id, seededTodos);
      upsertProjectsFromTodos(id);

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
        email: "rail-sync@example.com",
        name: "Rail Sync Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      upsertProjectsFromTodos(userId);
      return json(route, 200, projectsByUser.get(userId) || []);
    }

    if (pathname === "/projects" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const body = await parseBody(route);
      const name = normalizeProjectName(body.name);
      if (!name) return json(route, 400, { error: "Project name is required" });

      const existing = projectsByUser.get(userId) || [];
      if (existing.some((item) => item.name === name)) {
        return json(route, 409, { error: "Project already exists" });
      }

      const record = { id: `project-${projectSeq++}`, name };
      projectsByUser.set(userId, [...existing, record]);
      return json(route, 201, record);
    }

    if (pathname.startsWith("/projects/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const projectId = pathname.split("/")[2];
      const body = await parseBody(route);
      const name = normalizeProjectName(body.name);
      const projects = projectsByUser.get(userId) || [];
      const targetIndex = projects.findIndex((item) => item.id === projectId);
      if (targetIndex === -1)
        return json(route, 404, { error: "Project not found" });
      if (!name) return json(route, 400, { error: "Project name is required" });

      const fromName = projects[targetIndex].name;
      const fromPrefix = `${fromName} / `;
      projects[targetIndex] = { ...projects[targetIndex], name };
      projectsByUser.set(userId, projects);

      const todoList = todosByUser.get(userId) || [];
      todosByUser.set(
        userId,
        todoList.map((todo) => {
          const current = normalizeProjectName(todo.category);
          if (!current) return todo;
          if (current === fromName) {
            return { ...todo, category: name, updatedAt: nowIso() };
          }
          if (current.startsWith(fromPrefix)) {
            return {
              ...todo,
              category: `${name}${current.slice(fromName.length)}`,
              updatedAt: nowIso(),
            };
          }
          return todo;
        }),
      );
      upsertProjectsFromTodos(userId);

      return json(route, 200, projects[targetIndex]);
    }

    if (pathname.startsWith("/projects/") && method === "DELETE") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const projectId = pathname.split("/")[2];
      const projects = projectsByUser.get(userId) || [];
      const target = projects.find((item) => item.id === projectId);
      if (!target) return json(route, 404, { error: "Project not found" });

      projectsByUser.set(
        userId,
        projects.filter((item) => item.id !== projectId),
      );

      const deletedPrefix = `${target.name} / `;
      const todoList = todosByUser.get(userId) || [];
      todosByUser.set(
        userId,
        todoList.map((todo) => {
          const projectName = normalizeProjectName(todo.category);
          if (!projectName) return todo;
          if (
            projectName === target.name ||
            projectName.startsWith(deletedPrefix)
          ) {
            return {
              ...todo,
              category: null,
              updatedAt: nowIso(),
            };
          }
          return todo;
        }),
      );
      upsertProjectsFromTodos(userId);
      return json(route, 204, null);
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
      const list = todosByUser.get(userId) || [];
      const idx = list.findIndex((todo) => String(todo.id) === todoId);
      if (idx === -1) return json(route, 404, { error: "Todo not found" });
      const next = { ...list[idx], ...patch, updatedAt: nowIso() };
      list[idx] = next;
      todosByUser.set(userId, list);
      upsertProjectsFromTodos(userId);
      return json(route, 200, next);
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

async function setup(page: Page) {
  await installRailSyncMockApi(page, [
    {
      id: "todo-a1",
      title:
        "Alpha planning board with extra long details to validate focus paths",
      description:
        "A description that is intentionally long for truncation behavior.",
      notes: null,
      category: "Alpha",
      dueDate: null,
      priority: "medium",
    },
    {
      id: "todo-a2",
      title: "Alpha subproject task",
      description: null,
      notes: null,
      category: "Alpha / Client",
      dueDate: null,
      priority: "high",
    },
    {
      id: "todo-b1",
      title: "Beta release checklist",
      description: null,
      notes: null,
      category: "Beta",
      dueDate: null,
      priority: "medium",
    },
    {
      id: "todo-long-1",
      title:
        "An extremely long todo title that should remain stable and never overlap the action slot in the list view",
      description: null,
      notes: null,
      category: LONG_PROJECT,
      dueDate: null,
      priority: "low",
    },
    {
      id: "todo-none-1",
      title: "Inbox style task",
      description: null,
      notes: null,
      category: null,
      dueDate: null,
      priority: "low",
    },
  ]);

  await registerAndOpenTodosView(page, {
    name: "Rail Keyboard Tester",
    email: `rail-keyboard-sync-${Date.now()}@example.com`,
  });
}

async function getVisibleTitles(page: Page) {
  return page.locator(".todo-item .todo-title").allTextContents();
}

test.describe("Projects rail keyboard + sync invariants", () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
  });

  test("rail and command palette project selection stay in parity", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only parity checks");

    const betaRailItem = page.locator(
      '#projectsRail .projects-rail-item[data-project-key="Beta"]',
    );
    await betaRailItem.click();

    const viaRailTitles = await getVisibleTitles(page);
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Beta");
    await expect(page.locator("#categoryFilter")).toHaveValue("Beta");

    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+K" : "Control+K",
    );
    await expect(page.locator("#commandPaletteOverlay")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await page.locator("#commandPaletteInput").fill("go to project: beta");
    await page
      .locator('#commandPaletteList [data-command-id="project-Beta"]')
      .click();

    await expect(page.locator("#commandPaletteOverlay")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    const viaPaletteTitles = await getVisibleTitles(page);
    expect(viaPaletteTitles).toEqual(viaRailTitles);
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Beta");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("1 task");
  });

  test("Escape closes kebab first then drawer and restores focus", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop drawer focus invariant");

    const row = page.locator('.todo-item[data-todo-id="todo-a1"]');
    await row.locator(".todo-title").click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.evaluate(() => {
      const fn = (window as { toggleTodoKebab?: Function }).toggleTodoKebab;
      fn?.("todo-a1", {
        preventDefault() {},
        stopPropagation() {},
      });
    });
    await expect(row.locator(".todo-kebab")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(row.locator(".todo-kebab-menu")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(row.locator(".todo-kebab-menu")).toBeHidden();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.keyboard.press("Escape");
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(row).toBeFocused();
  });

  test("long project selection keeps todos scroll region free of horizontal overflow", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only overflow assertion");

    await page
      .locator(
        `#projectsRail .projects-rail-item[data-project-key="${LONG_PROJECT}"]`,
      )
      .click();

    await expect(page.locator("#categoryFilter")).toHaveValue(LONG_PROJECT);

    const overflowMetrics = await page
      .locator("#todosScrollRegion")
      .evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));

    expect(overflowMetrics.scrollWidth).toBeLessThanOrEqual(
      overflowMetrics.clientWidth + 1,
    );
  });
});
