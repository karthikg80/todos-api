import { expect, test, type Page, type Route } from "@playwright/test";

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
    const { pathname } = url;
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

      const id = nextUserId();
      users.set(email, { id, email, password });
      const token = nextToken();
      const refreshToken = nextToken();
      accessTokens.set(token, id);

      return json(route, 201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken,
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
        name: "Composition Spacing User",
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
      todosCallCount += 1;
      const response = await resolveTodos(todosCallCount, userId);
      return json(route, response.status, response.body);
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
  await page.locator("#registerName").fill("Composition Spacing User");
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

test.describe("Todos composition and spacing", () => {
  test("sticky list header stays above first visible row while scrolling", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only sticky header composition check");

    const todos = Array.from({ length: 36 }).map((_, index) => ({
      id: `todo-${index + 1}`,
      title: `Scrollable task ${index + 1}`,
      description: "Composition spacing check",
      priority: "medium" as const,
    }));

    await installMockApi(page, async (_count, userId) => ({
      status: 200,
      body: mapTodosForUser(todos, userId, new Date().toISOString()),
    }));

    await registerAndOpenTodos(page, "composition-scroll@example.com");

    const scrollRegion = page.locator("#todosScrollRegion");
    await expect(scrollRegion).toBeVisible();
    await scrollRegion.evaluate((node) => {
      // Scroll to ~40 % of the scrollable range so the assertion is
      // independent of elements above the todo list (e.g. collapsed
      // AI workspace header) that shift vertical geometry across
      // platforms.
      node.scrollTop = Math.round(
        (node.scrollHeight - node.clientHeight) * 0.4,
      );
    });

    const geometry = await page.evaluate(() => {
      const scrollRegion = document.getElementById("todosScrollRegion");
      const header = document.getElementById("todosListHeader");
      const rows = Array.from(document.querySelectorAll(".todo-item"));
      if (
        !(scrollRegion instanceof HTMLElement) ||
        !(header instanceof HTMLElement) ||
        rows.length === 0
      ) {
        return null;
      }
      const regionRect = scrollRegion.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      // First row whose top is fully at or below the header bottom (not
      // partially hidden under the sticky header).
      const firstFullyVisibleRow = rows.find((row) => {
        const rect = row.getBoundingClientRect();
        return rect.top >= headerRect.bottom - 1;
      });
      if (!(firstFullyVisibleRow instanceof HTMLElement)) {
        return null;
      }
      const rowRect = firstFullyVisibleRow.getBoundingClientRect();
      return {
        headerTop: headerRect.top,
        regionTop: regionRect.top,
        headerBottom: headerRect.bottom,
        rowTop: rowRect.top,
      };
    });

    expect(geometry).not.toBeNull();
    if (geometry) {
      // The sticky header must stick to the top of the scroll region.
      expect(geometry.headerTop).toBeCloseTo(geometry.regionTop, 0);
      // The first fully visible row must start at or just after the header.
      expect(geometry.rowTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
    }
  });

  test("empty state stays composed within the list container", async ({
    page,
  }) => {
    await installMockApi(page, async () => ({
      status: 200,
      body: [],
    }));

    await registerAndOpenTodos(page, "composition-empty@example.com");

    const scrollRegion = page.locator("#todosScrollRegion");
    const emptyState = page.locator("#todosEmptyState");
    await expect(emptyState).toBeVisible();

    const emptyBounds = await emptyState.boundingBox();
    const regionBounds = await scrollRegion.boundingBox();
    expect(emptyBounds).not.toBeNull();
    expect(regionBounds).not.toBeNull();
    if (emptyBounds && regionBounds) {
      expect(emptyBounds.x).toBeGreaterThanOrEqual(regionBounds.x - 1);
      expect(emptyBounds.x + emptyBounds.width).toBeLessThanOrEqual(
        regionBounds.x + regionBounds.width + 1,
      );
    }
    const emptyPaddingLeft = await emptyState.evaluate((el) =>
      Number.parseFloat(window.getComputedStyle(el).paddingLeft),
    );
    expect(emptyPaddingLeft).toBeGreaterThan(0);
  });

  test("error state stays composed within the list container", async ({
    page,
  }) => {
    await installMockApi(page, async () => ({
      status: 500,
      body: { error: "temporary failure" },
    }));
    await registerAndOpenTodos(page, "composition-error@example.com");

    await expect(page.locator("#todosErrorState")).toBeVisible();
    await expect(page.locator("#todosRetryLoadButton")).toBeVisible();

    const scrollRegion = page.locator("#todosScrollRegion");
    const regionBounds = await scrollRegion.boundingBox();
    const errorBounds = await page.locator("#todosErrorState").boundingBox();
    expect(regionBounds).not.toBeNull();
    expect(errorBounds).not.toBeNull();
    if (regionBounds && errorBounds) {
      expect(errorBounds.x).toBeGreaterThanOrEqual(regionBounds.x - 1);
      expect(errorBounds.x + errorBounds.width).toBeLessThanOrEqual(
        regionBounds.x + regionBounds.width + 1,
      );
    }
    const errorPaddingLeft = await page
      .locator("#todosErrorState")
      .evaluate((el) =>
        Number.parseFloat(window.getComputedStyle(el).paddingLeft),
      );
    expect(errorPaddingLeft).toBeGreaterThan(0);
  });

  test("loading skeleton appears in-flight and resolves cleanly", async ({
    page,
  }) => {
    let resolveTodosRequest: ((value: TodosResponse) => void) | null = null;
    const todosPromise = new Promise<TodosResponse>((resolve) => {
      resolveTodosRequest = resolve;
    });

    await installMockApi(page, async () => todosPromise);
    await registerAndOpenTodos(page, "composition-loading@example.com");

    await expect(page.locator("#todosLoadingState")).toBeVisible();
    await expect(page.locator(".todo-skeleton-row")).toHaveCount(6);

    resolveTodosRequest?.({
      status: 200,
      body: [],
    });

    await expect(page.locator("#todosLoadingState")).toBeHidden();
    await expect(page.locator(".todo-skeleton-row")).toHaveCount(0);
    await expect(page.locator("#todosEmptyState")).toBeVisible();
  });
});
