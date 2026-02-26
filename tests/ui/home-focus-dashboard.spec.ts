import { expect, test, type Page, type Route } from "@playwright/test";
import {
  openTaskComposerSheet,
  openTodosViewWithStorageState,
} from "./helpers/todos-view";

type SeedTodo = {
  id: string;
  title: string;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  notes?: string | null;
  completed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  subtasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
    order: number;
  }>;
};

function isoDaysFromNow(days: number, hour = 10) {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
}

function isoDaysAgo(days: number, hour = 10) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
}

async function installHomeFocusMockApi(
  page: Page,
  {
    aiDecisionAssistStatus = 500,
    seedTodos,
  }: { aiDecisionAssistStatus?: number; seedTodos: SeedTodo[] },
) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  let userSeq = 1;
  let tokenSeq = 1;
  let todoSeq = 1000;

  const nowIso = () => new Date().toISOString();
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  };

  const buildTodosForUser = (userId: string) =>
    seedTodos.map((todo, index) => ({
      id: todo.id,
      title: todo.title,
      description: null,
      completed: !!todo.completed,
      category: todo.category ?? null,
      dueDate: todo.dueDate ?? null,
      order: index,
      priority: todo.priority,
      notes: todo.notes ?? null,
      userId,
      createdAt: todo.createdAt || isoDaysAgo(14),
      updatedAt: todo.updatedAt || isoDaysAgo(3),
      subtasks:
        todo.subtasks?.map((subtask, subIndex) => ({
          ...subtask,
          order: subtask.order ?? subIndex,
          todoId: todo.id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })) || [],
    }));

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const existing = accessTokens.get(token);
    if (existing) return existing;
    if (!token) return null;
    const id = `cached-user-${userSeq++}`;
    accessTokens.set(token, id);
    if (!todosByUser.has(id)) {
      todosByUser.set(id, buildTodosForUser(id));
    }
    return id;
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
      todosByUser.set(userId, buildTodosForUser(userId));
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
        email: "home-focus@example.com",
        name: "Home Focus Tester",
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
      return json(route, 200, (todosByUser.get(userId) || []).slice());
    }

    if (pathname === "/todos" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const body = await parseBody(route);
      const list = todosByUser.get(userId) || [];
      const todoId = `todo-${todoSeq++}`;
      const nextTodo = {
        id: todoId,
        title: String(body.title || ""),
        description: null,
        completed: false,
        category: body.category ?? null,
        dueDate: body.dueDate ?? null,
        order: list.length,
        priority: (body.priority as string) || "medium",
        notes: body.notes ?? null,
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      };
      list.push(nextTodo);
      todosByUser.set(userId, list);
      return json(route, 201, nextTodo);
    }

    if (pathname.startsWith("/todos/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const todoId = pathname.split("/")[2];
      const patch = await parseBody(route);
      const list = todosByUser.get(userId) || [];
      const index = list.findIndex((todo) => String(todo.id) === todoId);
      if (index < 0) return json(route, 404, { error: "Todo not found" });
      const updated = { ...list[index], ...patch, updatedAt: nowIso() };
      list[index] = updated;
      todosByUser.set(userId, list);
      return json(route, 200, updated);
    }

    if (pathname === "/ai/decision-assist/stub" && method === "POST") {
      if (aiDecisionAssistStatus >= 400) {
        return json(route, aiDecisionAssistStatus, { error: "AI unavailable" });
      }
      return json(route, 200, { topFocus: [] });
    }

    if (pathname === "/ai/suggestions" && method === "GET") {
      return json(route, 200, []);
    }
    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      return json(route, 404, { error: "Not found" });
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

async function openHomeApp(page: Page) {
  await openTodosViewWithStorageState(
    page,
    {
      name: "Home Focus",
      email: "home-focus@example.com",
    },
    { preserveLandingDefault: true },
  );
}

function isMobileViewport(page: Page) {
  const size = page.viewportSize();
  return !!size && size.width <= 700;
}

async function openProjectsRailIfNeeded(page: Page) {
  const desktopAll = page.locator(
    '#projectsRail .workspace-view-item[data-workspace-view="all"]',
  );
  if (await canClick(desktopAll)) {
    return "desktop";
  }

  const mobileOpen = page.locator("#projectsRailMobileOpen");
  const sheet = page.locator("#projectsRailSheet");
  const isSheetOpen = (await sheet.getAttribute("aria-hidden")) === "false";
  if (!isSheetOpen && (await canClick(mobileOpen))) {
    await mobileOpen.click();
    await expect(sheet).toHaveAttribute("aria-hidden", "false");
  }
  if ((await sheet.getAttribute("aria-hidden")) === "false") {
    return "sheet";
  }
  return "desktop";
}

async function canClick(locator: ReturnType<Page["locator"]>) {
  try {
    await locator.click({ trial: true });
    return true;
  } catch {
    return false;
  }
}

async function closeProjectsRailSheetIfOpen(page: Page) {
  const sheet = page.locator("#projectsRailSheet");
  if ((await sheet.getAttribute("aria-hidden")) === "false") {
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveAttribute("aria-hidden", "true");
  }
}

async function clickWorkspaceView(page: Page, view: string) {
  const mobile = isMobileViewport(page);
  const desktopTarget = page.locator(
    `#projectsRail .workspace-view-item[data-workspace-view="${view}"]`,
  );
  if (!mobile && (await desktopTarget.isVisible())) {
    if (await canClick(desktopTarget)) {
      await desktopTarget.click();
      return;
    }
  }

  const surface = await openProjectsRailIfNeeded(page);
  if (surface === "desktop") {
    await desktopTarget.click();
    return;
  }
  const sheetTarget = page.locator(
    `#projectsRailSheet .workspace-view-item[data-workspace-view="${view}"]`,
  );
  await sheetTarget.click();
  await closeProjectsRailSheetIfOpen(page);
}

async function clickProjectInRail(page: Page, projectKey: string) {
  const mobile = isMobileViewport(page);
  const desktopTarget = page.locator(
    `#projectsRail .projects-rail-item[data-project-key="${projectKey}"]`,
  );
  if (!mobile && (await desktopTarget.isVisible())) {
    if (await canClick(desktopTarget)) {
      await desktopTarget.click();
      return;
    }
  }

  const surface = await openProjectsRailIfNeeded(page);
  if (surface === "desktop") {
    await desktopTarget.click();
    return;
  }
  const sheetTarget = page.locator(
    `#projectsRailSheet .projects-rail-item[data-project-key="${projectKey}"]`,
  );
  await sheetTarget.click();
  await closeProjectsRailSheetIfOpen(page);
}

async function expectWorkspaceViewActive(page: Page, view: string) {
  if (!isMobileViewport(page)) {
    const desktopTarget = page.locator(
      `#projectsRail .workspace-view-item[data-workspace-view="${view}"]`,
    );
    await expect(desktopTarget).toHaveClass(/projects-rail-item--active/);
    return;
  }

  const mobileOpen = page.locator("#projectsRailMobileOpen");
  if (await mobileOpen.isVisible()) {
    await openProjectsRailIfNeeded(page);
    const sheetTarget = page.locator(
      `#projectsRailSheet .workspace-view-item[data-workspace-view="${view}"]`,
    );
    await expect(sheetTarget).toHaveClass(/projects-rail-item--active/);
    await page.keyboard.press("Escape");
    return;
  }
}

async function expectListOrEmptyState(page: Page) {
  const titleCount = await page.locator(".todo-item .todo-title").count();
  if (titleCount > 0) {
    await expect(page.locator(".todo-item .todo-title").first()).toBeVisible();
    return;
  }
  await expect(page.locator("#todosContent")).toContainText(
    /No tasks|No todos|Nothing to show/i,
  );
}

function buildSeedTodos(): SeedTodo[] {
  return [
    {
      id: "todo-overdue",
      title: "Send overdue invoice",
      category: null,
      dueDate: isoDaysFromNow(-1, 9),
      priority: "high",
      createdAt: isoDaysAgo(20),
      updatedAt: isoDaysAgo(7),
    },
    {
      id: "todo-today",
      title: "Prepare launch checklist",
      category: "Work",
      dueDate: isoDaysFromNow(0, 11),
      priority: "high",
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: "todo-tomorrow",
      title: "Call contractor",
      category: null,
      dueDate: isoDaysFromNow(1, 13),
      priority: "medium",
      createdAt: isoDaysAgo(4),
      updatedAt: isoDaysAgo(4),
    },
    {
      id: "todo-quick-win",
      title: "Email receipt",
      category: null,
      dueDate: null,
      priority: "low",
      createdAt: isoDaysAgo(2),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "todo-project-seed",
      title: "Work project seed",
      category: "Work",
      dueDate: isoDaysFromNow(4, 10),
      priority: "medium",
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "todo-stale",
      title: "Long-running stale item",
      category: null,
      dueDate: null,
      priority: "high",
      notes: "Needs follow-up notes",
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(12),
      subtasks: [{ id: "sub-1", title: "Subtask", completed: false, order: 0 }],
    },
  ];
}

test.describe("Home focus dashboard + sheet composer", () => {
  test.beforeEach(async ({ page }) => {
    await installHomeFocusMockApi(page, {
      aiDecisionAssistStatus: 500,
      seedTodos: buildSeedTodos(),
    });
    await openHomeApp(page);
  });

  test("Home is the default landing view", async ({ page }) => {
    await expect(page.locator('[data-testid="home-dashboard"]')).toBeVisible();
    await expectWorkspaceViewActive(page, "home");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Home");
  });

  test("Home tiles render deterministic fallback when AI endpoint fails", async ({
    page,
  }) => {
    await expect(page.locator('[data-home-tile="top_focus"]')).toBeVisible();
    await expect(page.locator('[data-home-tile="top_focus"]')).toContainText(
      "Top Focus",
    );
    await expect(page.locator('[data-home-tile="top_focus"]')).toContainText(
      /Deterministic fallback focus list|Nothing urgent right now|Send overdue invoice/,
    );
    await expect(page.locator('[data-home-tile="due_soon"]')).toContainText(
      /Due Soon|Prepare launch checklist|No tasks/,
    );
  });

  test("New Task opens bottom sheet; Enter creates task and closes sheet", async ({
    page,
  }) => {
    await openTaskComposerSheet(page);
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await page.locator("#todoInput").fill("Sheet entry task");
    await page.locator("#todoInput").press("Enter");
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await clickWorkspaceView(page, "unsorted");
    await expect(page.locator(".todo-item .todo-title")).toContainText(
      "Sheet entry task",
    );
  });

  test("Opening sheet inside a project defaults project selector", async ({
    page,
  }) => {
    await clickProjectInRail(page, "Work");
    await openTaskComposerSheet(page);
    await expect(page.locator("#todoProjectSelect")).toHaveValue("Work");
  });

  test("Creating a task with a project keeps it out of Unsorted and shows in that project", async ({
    page,
  }) => {
    await clickWorkspaceView(page, "unsorted");
    await openTaskComposerSheet(page);
    await page.locator("#todoInput").fill("Project scoped task");
    await page.locator("#todoProjectSelect").selectOption({ label: "Work" });
    await page.locator("#taskComposerAddButton").click();

    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator(".todo-item .todo-title")).not.toContainText(
      "Project scoped task",
    );

    await clickProjectInRail(page, "Work");
    await expect(page.locator(".todo-item .todo-title")).toContainText(
      "Project scoped task",
    );
  });

  test("Backdrop click closes when empty and stays open when text exists", async ({
    page,
  }) => {
    await openTaskComposerSheet(page);
    await page.locator("#taskComposerBackdrop").click();
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await openTaskComposerSheet(page);
    await page.locator("#todoInput").fill("Do not close me");
    await page.locator("#taskComposerBackdrop").click();
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });

  test("See all navigates for Due Soon and Quick Wins", async ({ page }) => {
    const dueSoonTile = page.locator('[data-home-tile="due_soon"]');
    await dueSoonTile.getByRole("button", { name: "See all" }).click();
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Due Soon");
    await expectListOrEmptyState(page);

    await clickWorkspaceView(page, "home");
    const quickWinsTile = page.locator('[data-home-tile="quick_wins"]');
    await quickWinsTile.getByRole("button", { name: "See all" }).click();
    await expect(page.locator("#todosListHeaderTitle")).toHaveText(
      "Quick Wins",
    );
    await expectListOrEmptyState(page);
  });
});
