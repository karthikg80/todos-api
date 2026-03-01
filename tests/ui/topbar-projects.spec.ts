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

async function installTopbarProjectsMockApi(page: Page, todosSeed: TodoSeed[]) {
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
        name: "Topbar Tester",
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
      return json(route, 200, todosByUser.get(userId) || []);
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

    return route.continue();
  });
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Topbar User");
  await page.locator("#registerEmail").fill("topbar-projects@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

test.describe("Top bar projects cleanup", () => {
  test.beforeEach(async ({ page }) => {
    await installTopbarProjectsMockApi(page, [
      {
        id: "todo-work",
        title: "Work task",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-home",
        title: "Home task",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page);
  });

  test("desktop rail visible hides projects button and keeps essentials visible", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only assertion");

    // Search and filters moved from the top bar to the desktop rail.
    await expect(
      page.locator("#railSearchContainer #searchInput"),
    ).toBeVisible();
    await expect(page.locator(".todos-top-bar .top-add-btn")).toHaveCount(0);
    // Floating CTA removed on desktop; home dashboard hero button takes that role.
    await expect(page.locator("#floatingNewTaskCta")).toBeHidden();
    await expect(page.locator(".keyboard-shortcuts-btn")).toHaveCount(0);
    // #moreFiltersToggle is in the rail and hidden by default; it reveals on search focus.
    await expect(page.locator("#moreFiltersToggle")).toBeHidden();
    await page.locator("#searchInput").focus();
    await expect(page.locator("#moreFiltersToggle")).toBeVisible();
    await expect(page.locator(".todos-top-bar #categoryFilter")).toHaveCount(0);
    await expect(page.locator("#projectsRailMobileOpen")).toBeHidden();
  });

  test("desktop collapsed rail shows projects button and restores focus into rail", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only assertion");

    await page.locator("#projectsRailToggle").click();
    await expect(page.locator("#projectsRail")).toHaveClass(
      /projects-rail--collapsed/,
    );
    await expect(page.locator("#projectsRailMobileOpen")).toBeVisible();

    await page.locator("#projectsRailMobileOpen").click();
    await expect(page.locator("#projectsRail")).not.toHaveClass(
      /projects-rail--collapsed/,
    );
    await expect(
      page.locator('#projectsRail .projects-rail-item[aria-current="page"]'),
    ).toBeFocused();
  });

  test("mobile projects button opens sheet and restores focus on close", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile-only assertion");

    await expect(page.locator("#projectsRailMobileOpen")).toBeVisible();
    await page.locator("#projectsRailMobileOpen").click();

    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.keyboard.press("Escape");
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator("#projectsRailMobileOpen")).toBeFocused();

    await page.locator("#projectsRailMobileOpen").click();
    const viewport = page.viewportSize();
    await page.locator("#projectsRailBackdrop").click({
      position: {
        x: Math.max(4, (viewport?.width || 320) - 12),
        y: 12,
      },
    });
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
