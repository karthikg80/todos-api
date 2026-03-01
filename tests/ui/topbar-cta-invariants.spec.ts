import { expect, test, type Page, type Route } from "@playwright/test";
import {
  registerAndOpenTodosView,
  selectWorkspaceView,
  waitForTodosViewIdle,
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

function nowIso() {
  return new Date().toISOString();
}

async function installTopbarInvariantMockApi(
  page: Page,
  todosSeed: TodoSeed[],
) {
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
        name: "Topbar Invariants User",
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

test.describe("Topbar CTA invariants", () => {
  test("home dashboard new task button opens task composer", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only layout invariant check");

    await installTopbarInvariantMockApi(page, [
      {
        id: "todo-1",
        title: "Sample task for layout check",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "medium",
      },
    ]);

    await page.setViewportSize({ width: 1280, height: 880 });
    await registerAndOpenTodosView(page, {
      name: "Topbar Invariants",
      email: "topbar-invariants@example.com",
    });

    // Search input is in the sidebar rail on desktop.
    await expect(page.locator("#searchInput")).toBeVisible();

    // Floating CTA and keyboard shortcuts FAB are removed on desktop.
    await expect(page.locator("#floatingNewTaskCta")).toBeHidden();
    await expect(page.locator(".keyboard-shortcuts-btn")).toHaveCount(0);

    // Navigate to Home view where the dashboard hero button lives.
    // waitForTodosViewIdle ensures any double-render from the async stats fetch
    // settles before we read the bounding box.
    await selectWorkspaceView(page, "home");
    await waitForTodosViewIdle(page);

    // Home dashboard hero's New Task button opens the composer.
    const heroNewTask = page.locator(".home-dashboard__new-task");
    await expect(heroNewTask).toBeVisible();

    const heroBox = await heroNewTask.boundingBox();
    const viewport = page.viewportSize();
    expect(heroBox).not.toBeNull();
    if (heroBox) {
      // Button must stay within viewport.
      expect(heroBox.x + heroBox.width).toBeLessThanOrEqual(
        (viewport?.width || 1280) + 1,
      );
    }

    await heroNewTask.click();
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });
});
