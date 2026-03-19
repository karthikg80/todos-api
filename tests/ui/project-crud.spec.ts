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

type ProjectRecord = {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  todoCount?: number;
  openTodoCount?: number;
};

function nowIso() {
  return new Date().toISOString();
}

function enrichProject(
  project: ProjectRecord,
  todos: Array<Record<string, unknown>>,
) {
  const matchingTodos = todos.filter(
    (todo) => String(todo.category || "") === project.name,
  );
  return {
    ...project,
    todoCount: matchingTodos.length,
    openTodoCount: matchingTodos.filter((todo) => !todo.completed).length,
  };
}

async function installProjectCrudMockApi(page: Page, todosSeed: TodoSeed[]) {
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
        name: "Project CRUD Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        onboardingCompletedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const projects = projectsByUser.get(userId) || [];
      const todos = todosByUser.get(userId) || [];
      return json(
        route,
        200,
        projects.map((project) => enrichProject(project, todos)),
      );
    }

    if (pathname === "/projects" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      const body = (await parseBody(route)) as { name?: string };
      const name = String(body?.name || "").trim();
      if (!name) {
        return json(route, 400, { error: "Project name is required" });
      }

      const existing = projectsByUser.get(userId) || [];
      if (
        existing.some(
          (project) => project.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        return json(route, 409, { error: "Project name already exists" });
      }

      const created: ProjectRecord = {
        id: `project-${projectSeq++}`,
        name,
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      projectsByUser.set(userId, [...existing, created]);
      return json(route, 201, created);
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
      const idx = projects.findIndex((project) => project.id === projectId);
      if (idx === -1) {
        return json(route, 404, { error: "Project not found" });
      }
      if (
        projects.some(
          (project, index) =>
            index !== idx &&
            project.name.toLowerCase() === nextName.toLowerCase(),
        )
      ) {
        return json(route, 409, { error: "Project name already exists" });
      }

      const previousName = projects[idx].name;
      const updated: ProjectRecord = {
        ...projects[idx],
        name: nextName,
        updatedAt: nowIso(),
      };
      projects[idx] = updated;
      projectsByUser.set(userId, projects);

      const todos = todosByUser.get(userId) || [];
      todosByUser.set(
        userId,
        todos.map((todo) =>
          String(todo.category || "") === previousName
            ? { ...todo, category: nextName, updatedAt: nowIso() }
            : todo,
        ),
      );

      return json(route, 200, updated);
    }

    if (pathname.startsWith("/projects/") && method === "DELETE") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      const projectId = pathname.split("/")[2];
      const taskDisposition =
        url.searchParams.get("taskDisposition") || "unsorted";
      const projects = projectsByUser.get(userId) || [];
      const target = projects.find((project) => project.id === projectId);
      if (!target) {
        return json(route, 404, { error: "Project not found" });
      }

      projectsByUser.set(
        userId,
        projects.filter((project) => project.id !== projectId),
      );

      const todos = todosByUser.get(userId) || [];
      const nextTodos =
        taskDisposition === "delete"
          ? todos.filter((todo) => String(todo.category || "") !== target.name)
          : todos.map((todo) =>
              String(todo.category || "") === target.name
                ? { ...todo, category: null, updatedAt: nowIso() }
                : todo,
            );
      todosByUser.set(userId, nextTodos);

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
  await page.locator("#registerName").fill("Project Crud User");
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

async function selectProject(
  page: Page,
  projectName: string,
  isMobile: boolean,
) {
  if (isMobile) {
    await page.locator("#projectsRailMobileOpen").click();
    await page
      .locator(
        `#projectsRailSheet .projects-rail-item[data-project-key="${projectName}"]`,
      )
      .click();
    return;
  }

  await page
    .locator(
      `#projectsRail .projects-rail-item[data-project-key="${projectName}"]`,
    )
    .click();
}

async function selectWorkspaceView(
  page: Page,
  view: string,
  isMobile: boolean,
) {
  if (isMobile) {
    await page.locator("#projectsRailMobileOpen").click();
    await page
      .locator(
        `#projectsRailSheet .workspace-view-item[data-workspace-view="${view}"]`,
      )
      .click();
    return;
  }

  await page
    .locator(
      `#projectsRail .workspace-view-item[data-workspace-view="${view}"]`,
    )
    .click();
}

function projectRailItem(page: Page, projectName: string, isMobile: boolean) {
  return isMobile
    ? page.locator(
        `#projectsRailSheet .projects-rail-item[data-project-key="${projectName}"]`,
      )
    : page.locator(
        `#projectsRail .projects-rail-item[data-project-key="${projectName}"]`,
      );
}

function workspaceViewItem(page: Page, view: string, isMobile: boolean) {
  return isMobile
    ? page.locator(
        `#projectsRailSheet .workspace-view-item[data-workspace-view="${view}"]`,
      )
    : page.locator(
        `#projectsRail .workspace-view-item[data-workspace-view="${view}"]`,
      );
}

test.describe("Project actions drawer", () => {
  test.beforeEach(async ({ page }) => {
    await installProjectCrudMockApi(page, [
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
        title: "Home task",
        description: null,
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page, "project-crud@example.com");
  });

  test("create empty project becomes active and filters list", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-focused CRUD rail interactions");

    await page.locator("#dockNewProjectBtn").click();
    await expect(page.locator("#projectCrudModal")).toBeVisible();
    await page.locator("#projectCrudNameInput").fill("Errands");
    await page.locator("#projectCrudSubmitButton").click();

    await expect(page.locator("#projectCrudModal")).toBeHidden();
    await expect(page.locator("#categoryFilter")).toHaveValue("Errands");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Errands");
    await expect(
      page.locator(
        '#projectsRail .projects-rail-item[data-project-key="Errands"]',
      ),
    ).toHaveCount(0);
    await expect(page.locator(".todo-item")).toHaveCount(0);
  });

  test("selected project exposes header kebab and saves edits from the drawer", async ({
    page,
    isMobile,
  }) => {
    await selectProject(page, "Work", isMobile);

    await expect(page.locator("#projectViewActionsButton")).toBeVisible();
    await page.locator("#projectViewActionsButton").click();
    await expect(page.locator("#projectEditDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await expect(page.locator("#projectEditNameInput")).toHaveValue("Work");
    await page.locator("#projectEditNameInput").fill("Work Ops");
    await page.locator("#projectEditSaveButton").click();

    await expect(page.locator("#projectEditDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator("#categoryFilter")).toHaveValue("Work Ops");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Work Ops");
    await expect(projectRailItem(page, "Work Ops", isMobile)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(projectRailItem(page, "Work", isMobile)).toHaveCount(0);
  });

  test("delete project can move open tasks to Unsorted and falls back to Home", async ({
    page,
    isMobile,
  }) => {
    await selectProject(page, "Home", isMobile);
    await expect(page.locator("#categoryFilter")).toHaveValue("Home");
    await page.locator("#projectViewActionsButton").click();
    await page.locator("#projectEditDeleteButton").click();
    await expect(page.locator("#projectDeleteDialog")).toBeVisible();
    await page
      .getByRole("button", {
        name: "Delete project and move tasks to Unsorted",
      })
      .click();

    await expect(page.locator("#projectEditDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator("#categoryFilter")).toHaveValue("");
    await expect(projectRailItem(page, "Home", isMobile)).toHaveCount(0);
    await expect(workspaceViewItem(page, "home", isMobile)).toHaveAttribute(
      "aria-current",
      "page",
    );
    await selectWorkspaceView(page, "unsorted", isMobile);
    await expect(page.locator(".todo-item")).toContainText("Home task");
  });

  test("delete project can delete its open tasks from the drawer dialog", async ({
    page,
    isMobile,
  }) => {
    await selectProject(page, "Home", isMobile);

    await page.locator("#projectViewActionsButton").click();
    await page.locator("#projectEditDeleteButton").click();
    await page
      .getByRole("button", {
        name: "Delete project and delete its tasks",
      })
      .click();

    await selectWorkspaceView(page, "all", isMobile);
    await expect(page.locator(".todo-item")).not.toContainText("Home task");
  });

  test("mobile uses the same project edit surface as a bottom sheet", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile-only sheet behavior");

    await page.locator("#projectsRailMobileOpen").click();
    await page
      .locator(
        '#projectsRailSheet .projects-rail-item[data-project-key="Work"]',
      )
      .click();
    await expect(page.locator("#projectViewActionsButton")).toBeVisible();

    await page.locator("#projectViewActionsButton").click();
    await expect(page.locator("#projectEditDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await expect(page.locator("#projectEditDrawer")).toHaveCSS("bottom", "0px");
  });

  test("duplicate create error shows message and keeps modal open", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-focused CRUD rail interactions");

    await page.locator("#dockNewProjectBtn").click();
    await page.locator("#projectCrudNameInput").fill("Chores");
    await page.locator("#projectCrudSubmitButton").click();
    await expect(page.locator("#projectCrudModal")).toBeHidden();

    await page.locator("#dockNewProjectBtn").click();
    await page.locator("#projectCrudNameInput").fill("Chores");
    await page.locator("#projectCrudSubmitButton").click();

    await expect(page.locator("#projectCrudModal")).toBeVisible();
    await expect(page.locator("#todosMessage")).toContainText(
      "Project name already exists",
    );
  });
});
