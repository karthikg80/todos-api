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
};

function nowIso() {
  return new Date().toISOString();
}

async function installOverflowMockApi(page: Page, todosSeed: TodoSeed[]) {
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
        name: "Overflow Tester",
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

test.describe("Todos layout overflow hardening", () => {
  test("no horizontal overflow after selecting long-name project and row remains usable", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-focused overflow assertion");

    const longProject =
      "Project-With-Very-Long-Name-For-Overflow-Hardening-12345";

    await installOverflowMockApi(page, [
      {
        id: "todo-long",
        title:
          "This is an intentionally very long todo title designed to test overflow handling in the todos main panel while chips and actions are present",
        description:
          "This description is deliberately long to ensure single-line clamp and no panel overflow when project filters are active.",
        notes: null,
        category: longProject,
        dueDate: "2026-03-18T09:00:00.000Z",
        priority: "high",
      },
    ]);

    await registerAndOpenTodosView(page, {
      name: "Overflow User",
      email: "layout-overflow@example.com",
    });

    await page
      .locator(
        `#projectsRail .projects-rail-item[data-project-key="${longProject}"]`,
      )
      .click();

    const addButton = page.locator("#floatingNewTaskCta");
    const searchInput = page.locator("#searchInput");
    await expect(page.locator(".todos-top-bar .top-add-btn")).toHaveCount(0);
    await expect(addButton).toBeVisible();
    await expect(searchInput).toBeVisible();

    const topbarOverlap = await page.evaluate(() => {
      const add = document.querySelector(
        "#floatingNewTaskCta",
      ) as HTMLElement | null;
      const search = document.querySelector(
        "#searchInput",
      ) as HTMLElement | null;
      if (!add || !search) return false;
      const addBox = add.getBoundingClientRect();
      const searchBox = search.getBoundingClientRect();
      return (
        addBox.x < searchBox.x + searchBox.width &&
        addBox.x + addBox.width > searchBox.x &&
        addBox.y < searchBox.y + searchBox.height &&
        addBox.y + addBox.height > searchBox.y
      );
    });
    expect(topbarOverlap).toBe(false);

    const scrollRegion = page.locator("#todosScrollRegion");
    const regionDimensions = await scrollRegion.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(regionDimensions.scrollWidth).toBeLessThanOrEqual(
      regionDimensions.clientWidth + 1,
    );

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(
      dimensions.clientWidth + 1,
    );

    const firstRow = page.locator(".todo-item").first();
    await expect(firstRow).toBeVisible();
    await firstRow.locator(".todo-title").click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });
});
