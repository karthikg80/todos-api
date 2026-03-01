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

function nowIso() {
  return new Date().toISOString();
}

function todayIsoAt(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

async function installFilterPipelineMockApi(page: Page, todosSeed: TodoSeed[]) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  const projectsByUser = new Map<
    string,
    Array<{
      id: string;
      name: string;
      userId: string;
      createdAt: string;
      updatedAt: string;
    }>
  >();

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
      const body = (await parseBody(route)) as {
        email?: string;
        password?: string;
        name?: string;
      };
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      if (users.has(email)) {
        return json(route, 409, { error: "Email already registered" });
      }

      const userId = `user-${userSeq++}`;
      users.set(email, { id: userId, email, password });
      const token = `token-${tokenSeq++}`;
      accessTokens.set(token, userId);

      const seededTodos = todosSeed.map((todo, index) => ({
        ...todo,
        completed: !!todo.completed,
        order: Number.isInteger(todo.order) ? todo.order : index,
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      }));
      todosByUser.set(userId, seededTodos);

      const projectNames = Array.from(
        new Set(
          seededTodos
            .map((todo) => String(todo.category || "").trim())
            .filter(Boolean),
        ),
      );
      projectsByUser.set(
        userId,
        projectNames.map((name) => ({
          id: `project-${projectSeq++}`,
          name,
          userId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })),
      );

      return json(route, 201, {
        user: { id: userId, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const user = Array.from(users.values()).find(
        (entry) => entry.id === userId,
      );
      if (!user) return json(route, 404, { error: "User not found" });
      return json(route, 200, {
        id: user.id,
        email: user.email,
        name: "Filter Pipeline User",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, projectsByUser.get(userId) || []);
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
      const index = list.findIndex((todo) => String(todo.id) === todoId);
      if (index === -1) return json(route, 404, { error: "Todo not found" });
      const updated = { ...list[index], ...patch, updatedAt: nowIso() };
      list[index] = updated;
      todosByUser.set(userId, list);
      return json(route, 200, updated);
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

async function registerAndOpenTodos(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Filter Pipeline");
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

async function openMoreFilters(page: Page) {
  // Search focus reveals the toggle; click it to open the filter panel.
  await page.locator("#searchInput").focus();
  const panel = page.locator("#moreFiltersPanel");
  // Guard: if already open (e.g. called twice in one test), avoid toggling closed.
  if (await panel.isVisible()) return;
  const toggle = page.locator("#moreFiltersToggle");
  await toggle.click();
  await expect(panel).toBeVisible();
}

async function getVisibleTodoTitles(page: Page) {
  return page.locator(".todo-item .todo-title").allTextContents();
}

test.describe("Filter pipeline regression", () => {
  test("search + project compose with synced header count", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop rail interactions only");

    await installFilterPipelineMockApi(page, [
      {
        id: "a-1",
        title: "Alpha report",
        description: "Quarterly update",
        notes: null,
        category: "Project A",
        dueDate: todayIsoAt(10),
        priority: "medium",
      },
      {
        id: "a-2",
        title: "Alpha planning",
        description: "Roadmap",
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "low",
      },
      {
        id: "b-1",
        title: "Beta report",
        description: "Ops update",
        notes: null,
        category: "Project B",
        dueDate: todayIsoAt(11),
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page, "pipeline-compose@example.com");

    await page
      .locator(
        '#projectsRail .projects-rail-item[data-project-key="Project A"]',
      )
      .click();
    await page.locator("#searchInput").fill("report");

    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Project A");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("1 task");
    await expect(await getVisibleTodoTitles(page)).toEqual(["Alpha report"]);
  });

  test("date pill + search composition and clear filters remain stable", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop rail interactions only");

    await installFilterPipelineMockApi(page, [
      {
        id: "a-1",
        title: "Today report",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: todayIsoAt(9),
        priority: "medium",
      },
      {
        id: "b-1",
        title: "Today planning",
        description: null,
        notes: null,
        category: "Project B",
        dueDate: todayIsoAt(12),
        priority: "low",
      },
      {
        id: "c-1",
        title: "Someday report",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page, "pipeline-date-search@example.com");

    await openMoreFilters(page);
    await page.locator("#dateViewToday").click();
    await page.locator("#searchInput").fill("report");

    await expect(await getVisibleTodoTitles(page)).toEqual(["Today report"]);
    await expect(page.locator("#todosListHeaderCount")).toHaveText("1 task");

    await openMoreFilters(page);
    await page.locator("#moreFiltersPanel .clear-filters-btn").click();
    await expect(page.locator("#categoryFilter")).toHaveValue("");
    await expect(page.locator("#searchInput")).toHaveValue("");
    await expect(page.locator("#dateViewAll")).toHaveClass(/active/);
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("All tasks");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("3 tasks");
  });

  test("export .ics follows visible filtered todos source", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop rail interactions only");

    await page.addInitScript(() => {
      const capture = {
        downloads: [] as Array<{ download: string; href: string }>,
        contents: [] as string[],
      };

      (
        window as typeof window & { __icsCapture: typeof capture }
      ).__icsCapture = capture;

      URL.createObjectURL = (blob: Blob) => {
        blob.text().then((content) => {
          capture.contents.push(content);
        });
        return `blob:ics-${capture.contents.length + 1}`;
      };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function () {
        capture.downloads.push({
          download: this.download,
          href: this.href,
        });
      };
    });

    await installFilterPipelineMockApi(page, [
      {
        id: "a-1",
        title: "Alpha due task",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: todayIsoAt(8),
        priority: "medium",
      },
      {
        id: "a-2",
        title: "Alpha no due",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "low",
      },
      {
        id: "b-1",
        title: "Beta due task",
        description: null,
        notes: null,
        category: "Project B",
        dueDate: todayIsoAt(16),
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page, "pipeline-ics@example.com");

    await page
      .locator(
        '#projectsRail .projects-rail-item[data-project-key="Project A"]',
      )
      .click();
    await page.locator("#searchInput").fill("due");
    await openMoreFilters(page);
    await page.locator("#exportIcsButton").click();

    await page.waitForFunction(() => {
      const capture = (
        window as typeof window & { __icsCapture?: { contents: string[] } }
      ).__icsCapture;
      return !!capture && capture.contents.length > 0;
    });

    const content = await page.evaluate(() => {
      return (
        window as typeof window & {
          __icsCapture: { contents: string[] };
        }
      ).__icsCapture.contents[0];
    });

    expect(content).toContain("SUMMARY:Alpha due task");
    expect(content).not.toContain("SUMMARY:Beta due task");
    expect(content).not.toContain("SUMMARY:Alpha no due");
  });

  test("drawer state stays deterministic after filter changes", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop rail interactions only");

    await installFilterPipelineMockApi(page, [
      {
        id: "a-1",
        title: "Project A drawer target",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "b-1",
        title: "Project B visible task",
        description: null,
        notes: null,
        category: "Project B",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page, "pipeline-drawer@example.com");

    await page
      .locator(
        '#projectsRail .projects-rail-item[data-project-key="Project A"]',
      )
      .click();
    await page.locator(".todo-item").first().click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveClass(
      /todo-drawer--open/,
    );

    await page.locator("#categoryFilter").selectOption("Project B");
    await page.locator("#categoryFilter").dispatchEvent("change");

    await expect(await getVisibleTodoTitles(page)).toEqual([
      "Project B visible task",
    ]);
    await expect(page.locator(".todo-item--active")).toHaveCount(0);
    await expect(page.locator("#todoDetailsDrawer")).toHaveClass(
      /todo-drawer--open/,
    );
  });

  test("loadTodos sends sortBy and sortOrder query params to the API", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop only — avoids duplicate mobile coverage");

    let capturedTodosUrl: URL | null = null;

    // Install the mock first — it handles all API routes.
    await installFilterPipelineMockApi(page, [
      {
        id: "q-1",
        title: "Query param task",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "medium",
      },
    ]);

    // Stack a second interceptor on top (registered later = higher priority).
    // It captures the GET /todos URL and falls back to the mock for the response.
    await page.route("**/todos*", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/todos" && route.request().method() === "GET") {
        capturedTodosUrl = url;
      }
      return route.fallback();
    });

    await registerAndOpenTodos(page, "query-params@example.com");

    expect(capturedTodosUrl).not.toBeNull();
    expect(capturedTodosUrl!.searchParams.get("sortBy")).toBe("order");
    expect(capturedTodosUrl!.searchParams.get("sortOrder")).toBe("asc");
  });
});
