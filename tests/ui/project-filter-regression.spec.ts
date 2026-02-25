import { expect, test, type Page, type Route } from "@playwright/test";

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

type ProjectRecord = {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function installProjectFilterRegressionMockApi(
  page: Page,
  todosSeed: TodoSeed[],
) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  const projectsByUser = new Map<string, ProjectRecord[]>();

  let userSeq = 1;
  let tokenSeq = 1;
  let projectSeq = 1;

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

      const seededTodos = todosSeed.map((todo, index) => ({
        ...todo,
        completed: !!todo.completed,
        order: Number.isInteger(todo.order) ? todo.order : index,
        userId: id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      }));
      todosByUser.set(id, seededTodos);

      const initialProjectNames = Array.from(
        new Set(
          seededTodos
            .map((todo) => String(todo.category || "").trim())
            .filter(Boolean),
        ),
      );
      projectsByUser.set(
        id,
        initialProjectNames.map((name) => ({
          id: `project-${projectSeq++}`,
          name,
          userId: id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
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
        name: "Project Filter Regression",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, projectsByUser.get(userId) || []);
    }

    if (pathname.startsWith("/projects/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      const projectId = pathname.split("/")[2];
      const body = (await parseBody(route)) as { name?: string };
      const nextName = String(body?.name || "").trim();
      if (!nextName) {
        return json(route, 400, { error: "Project name is required" });
      }

      const projects = projectsByUser.get(userId) || [];
      const index = projects.findIndex((project) => project.id === projectId);
      if (index === -1) return json(route, 404, { error: "Project not found" });

      const previousName = projects[index].name;
      projects[index] = {
        ...projects[index],
        name: nextName,
        updatedAt: nowIso(),
      };
      projectsByUser.set(userId, projects);

      const previousPrefix = `${previousName} /`;
      const todos = todosByUser.get(userId) || [];
      todosByUser.set(
        userId,
        todos.map((todo) => {
          const category = String(todo.category || "");
          if (category === previousName) {
            return { ...todo, category: nextName, updatedAt: nowIso() };
          }
          if (category.startsWith(previousPrefix)) {
            return {
              ...todo,
              category: `${nextName}${category.slice(previousName.length)}`,
              updatedAt: nowIso(),
            };
          }
          return todo;
        }),
      );

      return json(route, 200, projects[index]);
    }

    if (pathname.startsWith("/projects/") && method === "DELETE") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      const projectId = pathname.split("/")[2];
      const projects = projectsByUser.get(userId) || [];
      const target = projects.find((project) => project.id === projectId);
      if (!target) return json(route, 404, { error: "Project not found" });

      projectsByUser.set(
        userId,
        projects.filter((project) => project.id !== projectId),
      );

      const targetPrefix = `${target.name} /`;
      const todos = todosByUser.get(userId) || [];
      todosByUser.set(
        userId,
        todos.map((todo) => {
          const category = String(todo.category || "");
          if (category === target.name || category.startsWith(targetPrefix)) {
            return { ...todo, category: null, updatedAt: nowIso() };
          }
          return todo;
        }),
      );

      return route.fulfill({ status: 204, body: "" });
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
      const index = list.findIndex((todo) => String(todo.id) === todoId);
      if (index === -1) return json(route, 404, { error: "Todo not found" });

      const next = {
        ...list[index],
        ...patch,
        updatedAt: nowIso(),
      };
      list[index] = next;
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
  await page.locator("#registerName").fill("Project Filter User");
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

async function getVisibleTodoTitles(page: Page) {
  return page.locator(".todo-item .todo-title").allTextContents();
}

async function selectProjectViaRail(page: Page, projectKey: string) {
  await page
    .locator(
      `#projectsRail .projects-rail-item[data-project-key="${projectKey}"]`,
    )
    .click();
}

async function selectProjectViaTopbar(
  page: Page,
  projectKey: string,
  isMobile: boolean,
) {
  const topbarProjectsButton = page.locator("#projectsRailMobileOpen");
  if (isMobile) {
    await topbarProjectsButton.click();
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await page
      .locator(
        `#projectsRailSheet .projects-rail-item[data-project-key="${projectKey}"]`,
      )
      .click();
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    return;
  }

  const rail = page.locator("#projectsRail");
  const railClass = (await rail.getAttribute("class")) || "";
  if (!railClass.includes("projects-rail--collapsed")) {
    await page.locator("#projectsRailToggle").click();
    await expect(rail).toHaveClass(/projects-rail--collapsed/);
  }

  await expect(topbarProjectsButton).toBeVisible();
  await topbarProjectsButton.click();
  await expect(rail).not.toHaveClass(/projects-rail--collapsed/);
  await selectProjectViaRail(page, projectKey);
}

test.describe("Project filter regression", () => {
  test("rail selection filters list and keeps header count/title in sync", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop rail interactions only");

    await installProjectFilterRegressionMockApi(page, [
      {
        id: "a-1",
        title: "Project A task one",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "a-2",
        title: "Project A task two",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "low",
      },
      {
        id: "b-1",
        title: "Project B task one",
        description: null,
        notes: null,
        category: "Project B",
        dueDate: null,
        priority: "high",
      },
      {
        id: "u-1",
        title: "Unassigned task",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "medium",
      },
    ]);

    await registerAndOpenTodos(page, "regression-rail@example.com");

    await selectProjectViaRail(page, "Project A");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Project A");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("2 tasks");
    await expect(await getVisibleTodoTitles(page)).toEqual([
      "Project A task one",
      "Project A task two",
    ]);

    await selectProjectViaRail(page, "Project B");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Project B");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("1 task");
    await expect(await getVisibleTodoTitles(page)).toEqual([
      "Project B task one",
    ]);

    await selectProjectViaRail(page, "");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("All tasks");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("4 tasks");
    await expect(page.locator(".todo-item")).toHaveCount(4);
  });

  test("topbar project selection remains parity with rail filtering", async ({
    page,
    isMobile,
  }) => {
    await installProjectFilterRegressionMockApi(page, [
      {
        id: "a-1",
        title: "Project A task",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "b-1",
        title: "Project B task",
        description: null,
        notes: null,
        category: "Project B",
        dueDate: null,
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page, "regression-topbar@example.com");

    await selectProjectViaTopbar(page, "Project B", isMobile);
    await expect(page.locator("#categoryFilter")).toHaveValue("Project B");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Project B");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("1 task");
    await expect(await getVisibleTodoTitles(page)).toEqual(["Project B task"]);
  });

  test("drawer coordination remains stable across project switches", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop rail interactions only");

    await installProjectFilterRegressionMockApi(page, [
      {
        id: "a-1",
        title: "Project A drawer target",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "b-1",
        title: "Project B visible task",
        description: null,
        notes: null,
        category: "Project B",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page, "regression-drawer@example.com");

    await selectProjectViaRail(page, "Project A");
    await page.locator(".todo-item").first().click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveClass(
      /todo-drawer--open/,
    );

    await page.locator("#todoDrawerClose").click();
    await expect(page.locator("#todoDetailsDrawer")).not.toHaveClass(
      /todo-drawer--open/,
    );

    await selectProjectViaRail(page, "Project B");
    await expect(page.locator("#todoDetailsDrawer")).not.toHaveClass(
      /todo-drawer--open/,
    );
    await expect(page.locator(".todo-item--active")).toHaveCount(0);
    await expect(await getVisibleTodoTitles(page)).toEqual([
      "Project B visible task",
    ]);
  });

  test("rename/delete project edge cases preserve filter fallback and counts", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop rail interactions only");

    await installProjectFilterRegressionMockApi(page, [
      {
        id: "a-1",
        title: "Project A task one",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "a-2",
        title: "Project A task two",
        description: null,
        notes: null,
        category: "Project A",
        dueDate: null,
        priority: "low",
      },
      {
        id: "none-1",
        title: "General task",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page, "regression-rename-delete@example.com");

    await selectProjectViaRail(page, "Project A");
    await page
      .locator(
        '#projectsRail .projects-rail-kebab[data-project-menu-toggle="Project A"]',
      )
      .click();
    await page
      .locator(
        '#projectsRail .projects-rail-menu-item[data-project-menu-action="rename"][data-project-key="Project A"]',
      )
      .click();

    await expect(page.locator("#projectCrudModal")).toBeVisible();
    await page.locator("#projectCrudNameInput").fill("Project A+");
    await page.locator("#projectCrudSubmitButton").click();

    await expect(page.locator("#categoryFilter")).toHaveValue("Project A+");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText(
      "Project A+",
    );
    await expect(page.locator("#todosListHeaderCount")).toHaveText("2 tasks");

    page.once("dialog", (dialog) => {
      dialog.accept();
    });
    await page
      .locator(
        '#projectsRail .projects-rail-kebab[data-project-menu-toggle="Project A+"]',
      )
      .click();
    await page
      .locator(
        '#projectsRail .projects-rail-menu-item[data-project-menu-action="delete"][data-project-key="Project A+"]',
      )
      .click();

    await expect(page.locator("#categoryFilter")).toHaveValue("");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("All tasks");
    await expect(page.locator("#todosListHeaderCount")).toHaveText("3 tasks");
    await expect(page.locator(".todo-item")).toHaveCount(3);
  });

  test("no horizontal overflow on project switch with long names/titles", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop overflow stability check");

    await installProjectFilterRegressionMockApi(page, [
      {
        id: "long-a",
        title:
          "A very long todo title for Project Alpha that should remain within the list container without horizontal overflow issues",
        description: null,
        notes: null,
        category:
          "Project Alpha With Extremely Long Name For Overflow Regression Coverage",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "long-b",
        title:
          "Another extremely long todo title for Project Beta to validate clipping without introducing horizontal scrolling",
        description: null,
        notes: null,
        category:
          "Project Beta With Extremely Long Name For Overflow Regression Coverage",
        dueDate: null,
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page, "regression-overflow@example.com");

    await selectProjectViaRail(
      page,
      "Project Alpha With Extremely Long Name For Overflow Regression Coverage",
    );
    await selectProjectViaRail(
      page,
      "Project Beta With Extremely Long Name For Overflow Regression Coverage",
    );

    const overflow = await page
      .locator("#todosScrollRegion")
      .evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
