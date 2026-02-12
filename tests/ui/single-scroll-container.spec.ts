import { expect, test, type Page, type Route } from "@playwright/test";

type TodoSeed = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
};

function nowIso() {
  return new Date().toISOString();
}

async function installSingleScrollMockApi(page: Page, todosSeed: TodoSeed[]) {
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
          completed: false,
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
        name: "Single Scroll Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET")
      return json(route, 200, []);
    if (pathname === "/todos" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, todosByUser.get(userId) || []);
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

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Single Scroll User");
  await page.locator("#registerEmail").fill("single-scroll@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

test.describe("Single scroll container hardening", () => {
  test("uses #todosScrollRegion as primary scroll container without overflow spill", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only single-scroll assertion");

    const longProject =
      "Project-With-A-Very-Long-Name-To-Validate-Single-Scroll-Containment-12345";
    const seededTodos = Array.from({ length: 34 }, (_, index) => ({
      id: `todo-overflow-${String(index + 1).padStart(2, "0")}`,
      title: `Very long task title ${index + 1} - this item exists to force scroll container growth while validating no overflow spill in the main todos panel`,
      description:
        "Description text is intentionally verbose to exercise row shrink behavior and clamp inside the single scroll container.",
      notes: null,
      category: longProject,
      dueDate: index % 2 === 0 ? "2026-04-01T09:00:00.000Z" : null,
      priority: index % 3 === 0 ? ("high" as const) : ("medium" as const),
    }));

    await installSingleScrollMockApi(page, seededTodos);
    await registerAndOpenTodos(page);

    await page
      .locator(
        `#projectsRail .projects-rail-item[data-project-key="${longProject}"]`,
      )
      .click();

    const scrollRegion = page.locator("#todosScrollRegion");
    await expect(scrollRegion).toBeVisible();

    const regionMetrics = await scrollRegion.evaluate((node) => ({
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));

    expect(regionMetrics.scrollHeight).toBeGreaterThan(
      regionMetrics.clientHeight,
    );
    expect(regionMetrics.scrollWidth).toBe(regionMetrics.clientWidth);

    const docMetrics = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(docMetrics.scrollHeight).toBeLessThanOrEqual(
      docMetrics.clientHeight + 4,
    );

    const lastTitle = page.locator(".todo-item .todo-title").last();
    await scrollRegion.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(lastTitle).toBeVisible();

    const firstRowTitle = page.locator(".todo-item .todo-title").first();
    await firstRowTitle.click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.locator("#todoDrawerClose").click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator(".todo-item").first()).toBeFocused();
  });
});
