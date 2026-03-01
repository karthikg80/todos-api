import { expect, test, type Page, type Route } from "@playwright/test";
import {
  openTodosViewWithStorageState,
  selectWorkspaceView,
} from "./helpers/todos-view";

type TodoSeed = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
};

async function installMockApi(page: Page, todosSeed: TodoSeed[]) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  let userSeq = 1;
  let tokenSeq = 1;

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
    const knownUserId = accessTokens.get(token);
    if (knownUserId) return knownUserId;
    if (!token) return null;

    const id = `cached-user-${userSeq++}`;
    users.set(`cached-${id}@example.com`, {
      id,
      email: `cached-${id}@example.com`,
      password: "",
    });
    accessTokens.set(token, id);
    return id;
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
      if (users.has(email))
        return json(409, { error: "Email already registered" });

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
        name: "Filter Tester",
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
      return json(
        200,
        todosSeed.map((todo, index) => ({
          ...todo,
          completed: false,
          order: index,
          userId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          subtasks: [],
        })),
      );
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

test.describe("More filters disclosure", () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, [
      {
        id: "todo-due-1",
        title: "Due task",
        description: "Task with due date",
        notes: null,
        category: "Work",
        dueDate: "2026-04-01T09:00:00.000Z",
        priority: "medium",
      },
      {
        id: "todo-no-due-1",
        title: "Someday task",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "low",
      },
    ]);

    await openTodosViewWithStorageState(page, {
      name: "Filters User",
      email: "filters@example.com",
    });
  });

  test("filter toggle is hidden by default; search focus reveals it collapsed", async ({
    page,
    isMobile,
  }) => {
    // Search input and filter toggle live in #projectsRail, which is hidden on
    // mobile. The mobile access path is via the rail sheet; skip here.
    test.skip(isMobile, "filter controls are in the desktop projects rail");

    await expect(page.locator("#moreFiltersToggle")).toBeHidden();
    await page.locator("#searchInput").focus();
    await expect(page.locator("#moreFiltersToggle")).toBeVisible();
    await expect(page.locator("#moreFiltersToggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator("#moreFiltersPanel")).toBeHidden();
  });

  test("opens via click, updates aria, and focuses first panel control", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "filter controls are in the desktop projects rail");

    await page.locator("#searchInput").focus();
    await page.locator("#moreFiltersToggle").click();

    await expect(page.locator("#moreFiltersToggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator("#moreFiltersPanel")).toBeVisible();

    await expect(page.locator("#dateViewAll")).toBeFocused();
  });

  test("Escape closes panel and restores focus to toggle", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "filter controls are in the desktop projects rail");

    await page.locator("#searchInput").focus();
    await page.locator("#moreFiltersToggle").click();
    await expect(page.locator("#moreFiltersPanel")).toBeVisible();

    await page.locator("#dateViewToday").focus();
    await page.keyboard.press("Escape");

    await expect(page.locator("#moreFiltersPanel")).toBeHidden();
    await expect(page.locator("#moreFiltersToggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator("#moreFiltersToggle")).toBeFocused();
  });

  test("moved controls remain reachable inside panel", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "filter controls are in the desktop projects rail");

    await page.locator("#searchInput").focus();
    await page.locator("#moreFiltersToggle").click();

    await expect(page.locator("#moreFiltersPanel #dateViewAll")).toBeVisible();
    await expect(
      page.locator("#moreFiltersPanel #dateViewSomeday"),
    ).toBeVisible();
    await expect(
      page.locator("#moreFiltersPanel .clear-filters-btn"),
    ).toBeVisible();
    await expect(
      page.locator("#moreFiltersPanel #exportIcsButton"),
    ).toBeVisible();

    await page.locator("#moreFiltersPanel .clear-filters-btn").click();
    await expect(page.locator("#searchInput")).toHaveValue("");

    await expect(page.locator("#exportIcsButton")).toBeEnabled();
    await page.locator("#exportIcsButton").click();
    await expect(page.locator("#todosMessage")).toContainText(
      "Exported 1 events.",
    );
  });

  test("home dashboard new task button opens task composer", async ({
    page,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      "home-dashboard__new-task only visible on desktop home view",
    );
    // Navigate to the Home view where the dashboard hero button lives.
    await selectWorkspaceView(page, "home");
    // Floating CTA removed on desktop; home dashboard hero button takes that role.
    await expect(page.locator("#floatingNewTaskCta")).toBeHidden();
    await expect(page.locator(".home-dashboard__new-task")).toBeVisible();
    await page.locator(".home-dashboard__new-task").click();
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await expect(page.locator("#todoInput")).toBeVisible();
    await expect(page.locator("#todoInput")).toBeFocused();
  });
});
