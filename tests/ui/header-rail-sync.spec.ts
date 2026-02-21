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

async function installHeaderRailSyncMockApi(page: Page, todosSeed: TodoSeed[]) {
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
        name: "Header Sync Tester",
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
  await page.locator("#registerName").fill("Header Sync User");
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

async function selectProjectFromRail(
  page: Page,
  projectName: string,
  isMobile: boolean,
) {
  if (isMobile) {
    await page.locator("#projectsRailMobileOpen").click();
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await page
      .locator(
        `#projectsRailSheet .projects-rail-item[data-project-key="${projectName}"]`,
      )
      .click();
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    return;
  }

  await page
    .locator(
      `#projectsRail .projects-rail-item[data-project-key="${projectName}"]`,
    )
    .click();
}

async function ensureMoreFiltersOpen(page: Page) {
  const panel = page.locator("#moreFiltersPanel");
  const toggle = page.locator("#moreFiltersToggle");
  if (!(await panel.isVisible())) {
    await toggle.click();
    await expect(panel).toBeVisible();
  }
}

test.describe("Header + rail sync", () => {
  test.beforeEach(async ({ page }) => {
    await installHeaderRailSyncMockApi(page, [
      {
        id: "todo-1",
        title: "Work planning",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-2",
        title: "Home cleanup",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "low",
      },
      {
        id: "todo-3",
        title: "Home budget",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "high",
      },
      {
        id: "todo-4",
        title: "Long project seeded task",
        description: null,
        notes: null,
        category: "Project Name With A Very Long Context That Should Truncate",
        dueDate: null,
        priority: "medium",
      },
    ]);

    await registerAndOpenTodos(page, "header-rail-sync@example.com");
  });

  test("default state keeps All tasks active with synced header and count", async ({
    page,
    isMobile,
  }) => {
    const allTasksRailItem = page.locator(
      '#projectsRail .projects-rail-item[data-project-key=""]',
    );

    if (isMobile) {
      await page.locator("#projectsRailMobileOpen").click();
      await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
        "aria-hidden",
        "false",
      );
    }

    await expect(allTasksRailItem).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#todosListHeaderBreadcrumb")).toHaveText(
      "Projects /",
    );
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("All tasks");

    const visibleCount = await page.locator(".todo-item").count();
    await expect(page.locator("#todosListHeaderCount")).toHaveText(
      `${visibleCount} tasks`,
    );

    if (isMobile) {
      await page.keyboard.press("Escape");
      await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
  });

  test("project selection syncs rail active state, topbar label, header, and count", async ({
    page,
    isMobile,
  }) => {
    await selectProjectFromRail(page, "Home", isMobile);

    const homeRailItem = isMobile
      ? page.locator(
          '#projectsRailSheet .projects-rail-item[data-project-key="Home"]',
        )
      : page.locator(
          '#projectsRail .projects-rail-item[data-project-key="Home"]',
        );

    await expect(page.locator("#categoryFilter")).toHaveValue("Home");
    await expect(homeRailItem).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Home");
    await expect(page.locator("#projectsRailTopbarLabel")).toContainText(
      "Home",
    );
    await expect(page.locator("#todosListHeaderCount")).toHaveText("2 tasks");

    await ensureMoreFiltersOpen(page);
    await page.locator("#dateViewToday").click();
    await expect(page.locator("#todosListHeaderDateBadge")).toHaveText("Today");
  });

  test("switching away and back to Todos preserves active rail selection and header", async ({
    page,
    isMobile,
  }) => {
    await selectProjectFromRail(page, "Work", isMobile);

    const settingsButton = page.getByRole("button", { name: "Settings" });
    if (await settingsButton.first().isVisible()) {
      await settingsButton.first().click();
    } else {
      await page.getByRole("button", { name: "Profile" }).click();
    }
    await expect(page.locator("#settingsPane")).toBeVisible();

    await page.getByRole("button", { name: "Todos" }).click();
    await expect(page.locator("#todosView")).toHaveClass(/active/);

    const workRailItem = page.locator(
      '#projectsRail .projects-rail-item[data-project-key="Work"]',
    );
    await expect(workRailItem).toHaveAttribute("aria-current", "page");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Work");
    await expect(page.locator("#projectsRailTopbarLabel")).toContainText(
      "Work",
    );
    await expect(page.locator("#todosListHeaderCount")).toHaveText("1 task");
  });

  test("long project names expose tooltip title in topbar and header", async ({
    page,
    isMobile,
  }) => {
    const longProjectName =
      "Project Name With A Very Long Context That Should Truncate";

    await page.locator("#categoryFilter").selectOption(longProjectName);
    await page.locator("#searchInput").dispatchEvent("input");

    if (!isMobile) {
      const openBtn = page.locator("#projectsRailMobileOpen");
      if (!(await openBtn.isVisible())) {
        await page.locator("#projectsRailToggle").click();
      }
    }

    await expect(page.locator("#projectsRailTopbarLabel")).toHaveAttribute(
      "title",
      `Projects: ${longProjectName}`,
    );
    await expect(page.locator("#todosListHeaderTitle")).toHaveAttribute(
      "title",
      longProjectName,
    );
  });
});
