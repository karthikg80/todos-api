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

async function installLayoutInvariantMockApi(
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
        name: "Layout Invariants User",
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

async function registerAndOpenTodos(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Layout Invariants User");
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

test.describe("Todos layout invariants", () => {
  test("desktop rail/topbar/row invariants hold without overflow", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only invariants");

    const longProject =
      "Project-Label-With-Extreme-Length-To-Verify-Collapsed-Rail-Ellipsis-1234567890";
    await installLayoutInvariantMockApi(page, [
      {
        id: "todo-long",
        title:
          "Very long todo title that should ellipsize correctly without clipping row actions or forcing horizontal overflow in the list region",
        description:
          "Long description preview that should remain calm and single-line in the default desktop list density.",
        notes: null,
        category: longProject,
        dueDate: null,
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page, "layout-invariants@example.com");

    const rail = page.locator("#projectsRail");
    if (
      await rail.evaluate((node) =>
        node.classList.contains("projects-rail--collapsed"),
      )
    ) {
      await page.locator("#projectsRailToggle").click();
      await expect(rail).not.toHaveClass(/projects-rail--collapsed/);
    }

    // Topbar hidden on desktop; floating CTA and shortcuts btn removed.
    await expect(page.locator(".todos-top-bar")).toBeHidden();
    await expect(page.locator(".todos-top-bar .top-add-btn")).toHaveCount(0);
    await expect(page.locator("#floatingNewTaskCta")).toBeHidden();
    await expect(page.locator(".keyboard-shortcuts-btn")).toHaveCount(0);

    // Sidebar search must be accessible on desktop.
    await expect(
      page.locator("#railSearchContainer #searchInput"),
    ).toBeVisible();

    await page
      .locator(
        `#projectsRail .projects-rail-item[data-project-key="${longProject}"]`,
      )
      .click();

    const scrollRegion = page.locator("#todosScrollRegion");
    const regionMetrics = await scrollRegion.evaluate((node) => ({
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth,
    }));
    expect(regionMetrics.scrollWidth).toBe(regionMetrics.clientWidth);

    const firstRow = page.locator(".todo-item").first();
    await expect(firstRow).toBeVisible();
    const kebab = firstRow.locator(".todo-kebab");
    await expect(kebab).toHaveCSS("opacity", "0");

    const rowBeforeHover = await firstRow.boundingBox();
    await firstRow.hover();
    await expect(kebab).toHaveCSS("opacity", "1");
    const rowAfterHover = await firstRow.boundingBox();
    expect(rowBeforeHover).not.toBeNull();
    expect(rowAfterHover).not.toBeNull();
    if (rowBeforeHover && rowAfterHover) {
      expect(Math.abs(rowAfterHover.height - rowBeforeHover.height)).toBe(0);
    }

    await firstRow.focus();
    await expect(kebab).toHaveCSS("opacity", "1");
    await kebab.click();
    await expect(firstRow.locator(".todo-kebab-menu")).toHaveClass(
      /todo-kebab-menu--open/,
    );

    await page.locator("#projectsRailToggle").click();
    await expect(rail).toHaveClass(/projects-rail--collapsed/);
    const railLabel = page.locator(
      `#projectsRail .projects-rail-item[data-project-key="${longProject}"] .projects-rail-item__label`,
    );
    const labelMetrics = await railLabel.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        whiteSpace: style.whiteSpace,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    expect(labelMetrics.whiteSpace).toBe("nowrap");
    expect(labelMetrics.scrollWidth).toBeGreaterThan(labelMetrics.clientWidth);
  });

  test("mobile keeps row actions visible by default", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile-only action visibility");

    await installLayoutInvariantMockApi(page, [
      {
        id: "todo-mobile",
        title: "Mobile action visibility task",
        description: null,
        notes: null,
        category: "Mobile Project",
        dueDate: null,
        priority: "medium",
      },
    ]);

    await registerAndOpenTodos(page, "layout-invariants-mobile@example.com");

    const kebab = page.locator(".todo-item .todo-kebab").first();
    await expect(kebab).toBeVisible();
    await expect(kebab).toHaveCSS("opacity", "1");
    await expect(kebab).toHaveCSS("visibility", "visible");
  });
});
