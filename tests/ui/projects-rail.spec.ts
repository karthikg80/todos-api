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

async function installProjectsRailMockApi(page: Page, todosSeed: TodoSeed[]) {
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
          completed: !!todo.completed,
          order: Number.isInteger(todo.order) ? todo.order : index,
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
        name: "Rail Tester",
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

    if (pathname.startsWith("/todos/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      const todoId = pathname.split("/")[2];
      const patch = (await parseBody(route)) as Record<string, unknown>;
      const list = todosByUser.get(userId) || [];
      const idx = list.findIndex((todo) => String(todo.id) === todoId);
      if (idx === -1) return json(route, 404, { error: "Todo not found" });

      const next = {
        ...list[idx],
        ...patch,
        updatedAt: nowIso(),
      };
      list[idx] = next;
      todosByUser.set(userId, list);
      return json(route, 200, next);
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

async function registerAndOpenTodos(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Rail User");
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

async function visibleTodoTitles(page: Page) {
  return page.locator(".todo-item .todo-title").allTextContents();
}

test.describe("Projects rail wiring", () => {
  test.beforeEach(async ({ page }) => {
    await installProjectsRailMockApi(page, [
      {
        id: "todo-1",
        title: "Work task",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-2",
        title: "Client task",
        description: null,
        notes: null,
        category: "Work / Client A",
        dueDate: null,
        priority: "high",
      },
      {
        id: "todo-3",
        title: "Home task",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page, "projects-rail@example.com");
  });

  test("mobile sheet opens/closes via button, Escape, and backdrop", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile-only rail sheet behavior");

    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await page.locator("#projectsRailMobileOpen").click();
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await expect(page.locator("#projectsRailMobileOpen")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(
      page.locator(
        '#projectsRailSheet .projects-rail-item[data-project-key=""]',
      ),
    ).toBeFocused();

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

  test("collapse toggle updates aria-expanded and collapsed class", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop collapse behavior");

    const toggle = page.locator("#projectsRailToggle");
    const rail = page.locator("#projectsRail");

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await toggle.click();

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(rail).toHaveClass(/projects-rail--collapsed/);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(rail).not.toHaveClass(/projects-rail--collapsed/);
  });

  test("rail project selection matches existing project filter path", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop project comparison");

    await page.locator("#categoryFilter").selectOption("Work");
    const viaSelect = await visibleTodoTitles(page);

    await page.locator("#categoryFilter").selectOption("");
    await page
      .locator('#projectsRail .projects-rail-item[data-project-key="Work"]')
      .click();

    const viaRail = await visibleTodoTitles(page);
    expect(viaRail).toEqual(viaSelect);
    await expect(page.locator("#categoryFilter")).toHaveValue("Work");
  });

  test("active project item persists across rerender", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop active-state persistence");

    const homeRailItem = page.locator(
      '#projectsRail .projects-rail-item[data-project-key="Home"]',
    );

    await homeRailItem.click();
    await expect(homeRailItem).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#categoryFilter")).toHaveValue("Home");

    await page.locator(".todo-item .todo-checkbox").first().click();

    await expect(homeRailItem).toHaveAttribute("aria-current", "page");
    await expect(homeRailItem).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#categoryFilter")).toHaveValue("Home");
  });

  test("desktop keyboard navigation selects project and keeps header/topbar/count in sync", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop keyboard rail behavior");

    const allTasks = page.locator(
      '#projectsRail .projects-rail-item[data-project-key=""]',
    );
    await allTasks.focus();
    await expect(allTasks).toBeFocused();

    await page.keyboard.press("ArrowDown");
    const homeRailItem = page.locator(
      '#projectsRail .projects-rail-item[data-project-key="Home"]',
    );
    await expect(homeRailItem).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.locator("#categoryFilter")).toHaveValue("Home");
    await expect(homeRailItem).toHaveAttribute("aria-selected", "true");
    await expect(homeRailItem).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#projectsRailTopbarLabel")).toContainText(
      "Home",
    );
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Home");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("1 task");
  });
});
