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

async function installListHeaderMockApi(page: Page, todosSeed: TodoSeed[]) {
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
        name: "List Header Tester",
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

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("List Header User");
  await page.locator("#registerEmail").fill("list-header@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
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

test.describe("Todos list header", () => {
  test("default shows All tasks with visible count after load", async ({
    page,
  }) => {
    await installListHeaderMockApi(page, [
      {
        id: "todo-1",
        title: "Prepare sprint summary",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-2",
        title: "Buy groceries",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "low",
      },
      {
        id: "todo-3",
        title: "Book dentist appointment",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page);
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("All tasks");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("3 tasks");
  });

  test("project selection updates title and filtered count", async ({
    page,
    isMobile,
  }) => {
    await installListHeaderMockApi(page, [
      {
        id: "todo-a",
        title: "Work planning",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-b",
        title: "Home laundry",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "low",
      },
      {
        id: "todo-c",
        title: "Home deep clean",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page);
    await selectProjectFromRail(page, "Home", isMobile);
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Home");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("2 tasks");
  });

  test("search filter updates count while project title stays selected", async ({
    page,
    isMobile,
  }) => {
    await installListHeaderMockApi(page, [
      {
        id: "todo-w1",
        title: "Write launch brief",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-w2",
        title: "Write rollout email",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-w3",
        title: "Review tickets",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page);
    await selectProjectFromRail(page, "Work", isMobile);
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Work");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("3 tasks");

    // On mobile, #searchInput lives in the hidden desktop rail. Set it via
    // evaluate (bypasses visibility) then call filterTodos() — the canonical
    // filter entry point that reads #searchInput.value.
    const setSearch = async (q: string) => {
      await page.evaluate((query: string) => {
        const input = document.getElementById(
          "searchInput",
        ) as HTMLInputElement | null;
        if (input) input.value = query;
        (window as Window & { filterTodos: () => void }).filterTodos();
      }, q);
    };

    await setSearch("rollout");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Work");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("1 task");

    await setSearch("nothing-matches");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Work");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("0 tasks");
  });

  test("header stays visible while scrolling and keeps sticky positioning", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only sticky assertion");

    const manyTodos = Array.from({ length: 30 }).map((_, index) => ({
      id: `todo-${index + 1}`,
      title: `Task ${index + 1}`,
      description: `Description for task ${index + 1}`,
      notes: null,
      category: index % 2 === 0 ? "Work" : "Home",
      dueDate: null,
      priority: "medium" as const,
    }));

    await installListHeaderMockApi(page, manyTodos);
    await registerAndOpenTodos(page);

    const header = page.locator("#todosListHeader");
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS("position", "sticky");

    const scrollRegion = page.locator("#todosScrollRegion");
    if ((await scrollRegion.count()) > 0) {
      await scrollRegion.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
    } else {
      await page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
      });
    }

    await expect(header).toBeVisible();
    const box = await header.boundingBox();
    const regionBox =
      (await scrollRegion.count()) > 0
        ? await scrollRegion.boundingBox()
        : null;
    if (regionBox && box) {
      expect(box.y).toBeGreaterThanOrEqual(regionBox.y - 2);
      expect(box.y).toBeLessThan(regionBox.y + 80);
    } else {
      expect(box?.y ?? 999).toBeLessThan(140);
    }
  });
});
