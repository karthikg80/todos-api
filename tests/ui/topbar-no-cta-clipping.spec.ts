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
};

function nowIso() {
  return new Date().toISOString();
}

async function installTopbarLayoutMockApi(page: Page, todosSeed: TodoSeed[]) {
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
        name: "Topbar Layout Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        onboardingCompletedAt: nowIso(),
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
  await page.locator("#registerName").fill("Topbar Layout User");
  await page.locator("#registerEmail").fill("topbar-layout@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

test.describe("Top bar and rail ellipsis hardening", () => {
  test("keeps desktop rail icon-only without project-list overflow in collapsed mode", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only layout assertion");

    const longProject =
      "Project-Label-With-Extreme-Length-To-Verify-Collapsed-Rail-Ellipsis-12345";

    await installTopbarLayoutMockApi(page, [
      {
        id: "todo-topbar-long",
        title:
          "Very long todo title to keep search and title area busy while asserting floating CTA remains visible",
        description: "Long description text",
        notes: null,
        category: longProject,
        dueDate: null,
        priority: "medium",
      },
    ]);

    await registerAndOpenTodos(page);

    const rail = page.locator("#projectsRail");
    if (
      await rail.evaluate((node) =>
        node.classList.contains("projects-rail--collapsed"),
      )
    ) {
      await page.locator("#projectsRailToggle").click();
      await expect(rail).not.toHaveClass(/projects-rail--collapsed/);
    }

    // Floating CTA removed on desktop; search is now in the sidebar rail.
    await expect(page.locator("#floatingNewTaskCta")).toBeHidden();
    await expect(page.locator(".todos-top-bar .top-add-btn")).toHaveCount(0);
    const searchArea = page.locator("#railSearchContainer .search-bar");
    await expect(searchArea).toBeVisible();

    // Search area must be fully within the viewport.
    const searchBox = await searchArea.boundingBox();
    const viewport = page.viewportSize();
    expect(searchBox).not.toBeNull();
    if (searchBox) {
      expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(
        (viewport?.width || 1280) - 1,
      );
    }

    await page.locator("#projectsRailToggle").click();
    await expect(rail).toHaveClass(/projects-rail--collapsed/);

    await expect(page.locator("#projectsRailList")).toBeHidden();
    await expect(
      page.locator(
        `#projectsRail .projects-rail-item[data-project-key="${longProject}"]`,
      ),
    ).toHaveCount(0);
    await expect(
      page.locator(
        '#projectsRail .workspace-view-item[data-workspace-view="all"] .nav-label',
      ),
    ).toBeHidden();
    const collapsedWidth = await rail.evaluate((el) =>
      Math.round(el.getBoundingClientRect().width),
    );
    expect(collapsedWidth).toBeLessThanOrEqual(64);
    await expect(page.locator(".todos-top-bar")).toBeHidden();
  });
});
