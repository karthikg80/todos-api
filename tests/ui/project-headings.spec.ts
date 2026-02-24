import { expect, test, type Page, type Route } from "@playwright/test";
import { openTodosViewWithStorageState } from "./helpers/todos-view";

type HeadingRecord = {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type TodoRecord = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  completed: boolean;
  order: number;
  headingId: string | null;
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    order: number;
    todoId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
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

async function installProjectHeadingsMockApi(page: Page) {
  const users = new Map<string, { id: string; email: string }>();
  const tokens = new Map<string, string>();
  const projectsByUser = new Map<string, ProjectRecord[]>();
  const headingsByProject = new Map<string, HeadingRecord[]>();
  const todosByUser = new Map<string, TodoRecord[]>();

  let userSeq = 1;
  let tokenSeq = 1;
  let projectSeq = 1;
  let headingSeq = 1;
  let todoSeq = 1;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  };

  const ensureUserForToken = (token: string) => {
    if (!token) return null;
    const existingUserId = tokens.get(token);
    if (existingUserId) return existingUserId;

    const userId = `user-${userSeq++}`;
    const email = `${userId}@example.com`;
    users.set(userId, { id: userId, email });
    tokens.set(token, userId);
    if (!projectsByUser.has(userId)) {
      seedUserData(userId);
    }
    return userId;
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return ensureUserForToken(token);
  };

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  const seedUserData = (userId: string) => {
    const project: ProjectRecord = {
      id: `project-${projectSeq++}`,
      name: "Work",
      userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const headingA: HeadingRecord = {
      id: `heading-${headingSeq++}`,
      projectId: project.id,
      name: "Heading A",
      sortOrder: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const headingB: HeadingRecord = {
      id: `heading-${headingSeq++}`,
      projectId: project.id,
      name: "Heading B",
      sortOrder: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    projectsByUser.set(userId, [project]);
    headingsByProject.set(project.id, [headingA, headingB]);

    const todos: TodoRecord[] = [
      {
        id: `todo-${todoSeq++}`,
        title: "Seed task under heading",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
        completed: false,
        order: 0,
        headingId: headingA.id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [
          {
            id: "subtask-1",
            title: "Nested subtask",
            completed: false,
            order: 0,
            todoId: `todo-${todoSeq}`,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
        ],
      },
      {
        id: `todo-${todoSeq++}`,
        title: "Unheaded task",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "low",
        completed: false,
        order: 1,
        headingId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      },
    ];
    todosByUser.set(userId, todos);
  };

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
      const id = `user-${userSeq++}`;
      const email = String(body.email || `${id}@example.com`);
      users.set(id, { id, email });
      const token = `token-${tokenSeq++}`;
      tokens.set(token, id);
      seedUserData(id);
      return json(route, 201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const user = users.get(userId) || {
        id: userId,
        email: `${userId}@example.com`,
      };
      users.set(userId, user);
      if (!projectsByUser.has(userId)) seedUserData(userId);
      return json(route, 200, {
        id: user.id,
        email: user.email,
        name: "Headings Test User",
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

    if (/^\/projects\/[^/]+\/headings$/.test(pathname) && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const projectId = pathname.split("/")[2] || "";
      const project = (projectsByUser.get(userId) || []).find(
        (p) => p.id === projectId,
      );
      if (!project) return json(route, 404, { error: "Project not found" });
      return json(route, 200, headingsByProject.get(projectId) || []);
    }

    if (/^\/projects\/[^/]+\/headings$/.test(pathname) && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const projectId = pathname.split("/")[2] || "";
      const body = await parseBody(route);
      const project = (projectsByUser.get(userId) || []).find(
        (p) => p.id === projectId,
      );
      if (!project) return json(route, 404, { error: "Project not found" });
      const name = String(body.name || "").trim();
      if (!name) return json(route, 400, { error: "Heading name is required" });
      const list = headingsByProject.get(projectId) || [];
      const nextHeading: HeadingRecord = {
        id: `heading-${headingSeq++}`,
        projectId,
        name,
        sortOrder: list.length,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      list.push(nextHeading);
      headingsByProject.set(projectId, list);
      return json(route, 201, nextHeading);
    }

    if (pathname === "/todos" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, todosByUser.get(userId) || []);
    }

    if (pathname === "/todos" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const body = await parseBody(route);
      const list = todosByUser.get(userId) || [];
      const nextTodo: TodoRecord = {
        id: `todo-${todoSeq++}`,
        title: String(body.title || ""),
        description:
          typeof body.description === "string" && body.description.length
            ? body.description
            : null,
        notes:
          typeof body.notes === "string" && body.notes.length
            ? body.notes
            : null,
        category: typeof body.category === "string" ? body.category : null,
        dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
        priority:
          body.priority === "low" || body.priority === "high"
            ? body.priority
            : "medium",
        completed: false,
        order: list.length,
        headingId: typeof body.headingId === "string" ? body.headingId : null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      };
      list.unshift(nextTodo);
      todosByUser.set(userId, list);
      return json(route, 201, nextTodo);
    }

    if (/^\/todos\/[^/]+$/.test(pathname) && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const todoId = pathname.split("/")[2] || "";
      const patch = await parseBody(route);
      const list = todosByUser.get(userId) || [];
      const index = list.findIndex((todo) => todo.id === todoId);
      if (index === -1) return json(route, 404, { error: "Todo not found" });
      const current = list[index];
      list[index] = {
        ...current,
        ...patch,
        headingId:
          patch.headingId === null
            ? null
            : typeof patch.headingId === "string"
              ? patch.headingId
              : current.headingId,
        updatedAt: nowIso(),
      };
      todosByUser.set(userId, list);
      return json(route, 200, list[index]);
    }

    if (pathname === "/todos/reorder" && method === "PUT") {
      return json(route, 200, []);
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
    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      return route.fulfill({ status: 204, body: "" });
    }
    if (pathname === "/auth/logout" && method === "POST") {
      return json(route, 200, { ok: true });
    }

    return route.continue();
  });
}

async function openWorkProject(page: Page) {
  await installProjectHeadingsMockApi(page);
  await openTodosViewWithStorageState(page, {
    name: "Project Headings Tester",
    email: "project-headings@example.com",
  });

  const mobileProjectsButton = page.locator("#projectsRailMobileOpen");
  if (await mobileProjectsButton.isVisible()) {
    await mobileProjectsButton.click();
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await page
      .locator(
        '#projectsRailSheet .projects-rail-item[data-project-key="Work"]',
      )
      .click();
    await expect(page.locator("#projectsRailSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  } else {
    await page
      .locator('#projectsRail .projects-rail-item[data-project-key="Work"]')
      .click();
  }

  await expect(page.locator("#todosListHeaderTitle")).toHaveText("Work");
  await expect(page.locator("#projectHeadingCreateButton")).toBeVisible();
}

async function getVisibleListSequence(page: Page) {
  return page.evaluate(() => {
    const list = document.querySelector("#todosContent .todos-list");
    if (!list) return [];
    return Array.from(list.children).map((child) => {
      if (!(child instanceof HTMLElement)) return "unknown";
      if (child.classList.contains("todo-heading-divider")) {
        const title = child.querySelector(".todo-heading-divider__title");
        return `heading:${title?.textContent?.trim() || ""}`;
      }
      if (child.classList.contains("todo-item")) {
        const title = child.querySelector(".todo-title");
        return `task:${title?.textContent?.trim() || ""}`;
      }
      if (child.classList.contains("todo-group-header")) {
        return `group:${child.textContent?.trim() || ""}`;
      }
      return child.tagName.toLowerCase();
    });
  });
}

async function waitForSequenceAssertion(
  page: Page,
  predicate: (sequence: string[]) => boolean,
) {
  await expect
    .poll(async () => predicate(await getVisibleListSequence(page)), {
      timeout: 5_000,
    })
    .toBe(true);
}

test.describe("Project headings (sections)", () => {
  test.beforeEach(async ({ page }) => {
    await openWorkProject(page);
  });

  test("create heading, assign task to it, and render grouping", async ({
    page,
  }) => {
    page.once("dialog", (dialog) => dialog.accept("Sprint"));
    await page.locator("#projectHeadingCreateButton").click();
    await expect(
      page.locator(".todo-heading-divider__title", { hasText: "Sprint" }),
    ).toBeVisible();

    await page.locator("#quickEntryPropertiesToggle").click();
    await page.locator("#todoProjectSelect").selectOption({ label: "Work" });
    await page.locator("#todoInput").fill("Task for sprint");
    await page.getByRole("button", { name: "Add Task" }).click();
    await expect(page.getByText("Task for sprint")).toBeVisible();

    const taskRow = page.locator(".todo-item", { hasText: "Task for sprint" });
    await taskRow.hover();
    await taskRow.locator(".todo-kebab").click();
    await taskRow
      .locator('label:has-text("Move to heading") select')
      .selectOption({ label: "Sprint" });

    await waitForSequenceAssertion(page, (sequence) => {
      const headingIndex = sequence.indexOf("heading:Sprint");
      const taskIndex = sequence.indexOf("task:Task for sprint");
      return headingIndex >= 0 && taskIndex > headingIndex;
    });
    const sequence = await getVisibleListSequence(page);
    expect(sequence).toContain("heading:Sprint");
    const headingIndex = sequence.indexOf("heading:Sprint");
    const taskIndex = sequence.indexOf("task:Task for sprint");
    expect(headingIndex).toBeGreaterThanOrEqual(0);
    expect(taskIndex).toBeGreaterThan(headingIndex);
  });

  test("task with subtasks still renders under heading grouping", async ({
    page,
  }) => {
    await expect(
      page.locator(".todo-heading-divider__title", { hasText: "Heading A" }),
    ).toBeVisible();
    const row = page.locator(".todo-item", {
      hasText: "Seed task under heading",
    });
    await expect(row.locator(".subtask-title")).toContainText("Nested subtask");

    await row.locator(".todo-title").click();
    await expect(page.locator("#todoDetailsDrawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#todoDetailsDrawer")).toBeHidden();
  });

  test("move task between headings and to no heading", async ({ page }) => {
    const row = page.locator(".todo-item", { hasText: "Unheaded task" });
    await row.hover();
    await row.locator(".todo-kebab").click();
    await row
      .locator('label:has-text("Move to heading") select')
      .selectOption({ label: "Heading B" });

    await waitForSequenceAssertion(page, (sequence) => {
      const headingBIndex = sequence.indexOf("heading:Heading B");
      const taskIndex = sequence.indexOf("task:Unheaded task");
      return headingBIndex >= 0 && taskIndex > headingBIndex;
    });
    let sequence = await getVisibleListSequence(page);
    let headingBIndex = sequence.indexOf("heading:Heading B");
    let taskIndex = sequence.indexOf("task:Unheaded task");
    expect(taskIndex).toBeGreaterThan(headingBIndex);

    const movedRow = page.locator(".todo-item", { hasText: "Unheaded task" });
    await movedRow.hover();
    await movedRow.locator(".todo-kebab").click();
    await movedRow
      .locator('label:has-text("Move to heading") select')
      .selectOption("");

    await waitForSequenceAssertion(page, (sequenceValue) => {
      const headingBIndex = sequenceValue.indexOf("heading:Heading B");
      const taskIndex = sequenceValue.indexOf("task:Unheaded task");
      return taskIndex >= 0 && headingBIndex > taskIndex;
    });
    sequence = await getVisibleListSequence(page);
    headingBIndex = sequence.indexOf("heading:Heading B");
    taskIndex = sequence.indexOf("task:Unheaded task");
    expect(taskIndex).toBeGreaterThanOrEqual(0);
    expect(headingBIndex).toBeGreaterThan(taskIndex);
  });
});
