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
  status?: string;
  startDate?: string | null;
  scheduledDate?: string | null;
  reviewDate?: string | null;
  tags?: string[];
  context?: string | null;
  energy?: string | null;
  effortScore?: number | null;
  emotionalState?: string | null;
  firstStep?: string | null;
  estimateMinutes?: number | null;
  waitingOn?: string | null;
  dependsOnTaskIds?: string[];
  archived?: boolean;
};

type MockOptions = {
  failFirstUpdate?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function toIsoFromLocalDateTime(value: string) {
  return new Date(value).toISOString();
}

async function installDrawerEditMockApi(
  page: Page,
  todosSeed: TodoSeed[],
  options: MockOptions = {},
) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  const updatePatches: Array<{
    todoId: string;
    patch: Record<string, unknown>;
  }> = [];
  let userSeq = 1;
  let tokenSeq = 1;
  let failedUpdate = false;

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
        name: "Drawer Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        onboardingCompletedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      return json(route, 200, [{ id: "proj-work", name: "Work" }]);
    }

    if (pathname === "/todos" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, todosByUser.get(userId) || []);
    }

    if (pathname === "/todos" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const body = (await parseBody(route)) as Record<string, unknown>;
      const list = todosByUser.get(userId) || [];
      const created = {
        id: `todo-created-${list.length + 1}`,
        title: String(body.title || ""),
        description: body.description ?? null,
        notes: body.notes ?? null,
        category: body.category ?? null,
        dueDate: body.dueDate ?? null,
        priority: body.priority ?? "medium",
        completed: body.completed ?? body.status === "done",
        status: body.status ?? "next",
        startDate: body.startDate ?? null,
        scheduledDate: body.scheduledDate ?? null,
        reviewDate: body.reviewDate ?? null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        context: body.context ?? null,
        energy: body.energy ?? null,
        effortScore:
          typeof body.effortScore === "number" ? body.effortScore : null,
        emotionalState: body.emotionalState ?? null,
        firstStep: body.firstStep ?? null,
        estimateMinutes:
          typeof body.estimateMinutes === "number"
            ? body.estimateMinutes
            : null,
        waitingOn: body.waitingOn ?? null,
        dependsOnTaskIds: Array.isArray(body.dependsOnTaskIds)
          ? body.dependsOnTaskIds
          : [],
        archived: body.archived ?? false,
        order: list.length,
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      };
      list.unshift(created);
      todosByUser.set(userId, list);
      return json(route, 201, created);
    }

    if (pathname.startsWith("/todos/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      if (options.failFirstUpdate && !failedUpdate) {
        failedUpdate = true;
        return json(route, 500, { error: "Save failed from mock" });
      }

      const todoId = pathname.split("/")[2];
      const patch = (await parseBody(route)) as Record<string, unknown>;
      updatePatches.push({ todoId, patch });

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

  return { updatePatches };
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.evaluate(() => (window as any).showAuthPage?.("register"));
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Drawer User");
  await page.locator("#registerEmail").fill("drawer@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

async function openFirstTodoDrawer(page: Page) {
  await page.locator(".todo-item .todo-title").first().click();
  await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(page.locator("#drawerTitleInput")).toBeVisible();
}

test.describe("Todo drawer essentials editing", () => {
  test("saves title via blur using shared update path", async ({ page }) => {
    const state = await installDrawerEditMockApi(page, [
      {
        id: "todo-1",
        title: "Original title",
        description: "Description",
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "medium",
      },
    ]);

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerTitleInput").fill("Updated title");
    await page.locator("#drawerPrioritySelect").focus();

    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) => entry.patch.title === "Updated title",
        ),
      )
      .toBeTruthy();

    await expect(page.locator("#drawerSaveStatus")).toContainText("Saved");
    await expect(page.locator(".todo-item .todo-title")).toContainText(
      "Updated title",
    );
  });

  test("saves due date, priority, and project on change", async ({ page }) => {
    const state = await installDrawerEditMockApi(page, [
      {
        id: "todo-1",
        title: "Task one",
        description: "Description",
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-2",
        title: "Task two",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerPrioritySelect").selectOption("high");
    await page.locator("#drawerProjectSelect").selectOption("Work");
    await page.locator("#drawerDueDateInput").fill("2026-05-01");

    await expect
      .poll(() =>
        state.updatePatches.some((entry) => entry.patch.priority === "high"),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some((entry) => entry.patch.category === "Work"),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) =>
            typeof entry.patch.dueDate === "string" &&
            String(entry.patch.dueDate).startsWith("2026-05-01"),
        ),
      )
      .toBeTruthy();

    await expect(page.locator("#drawerSaveStatus")).toContainText("Saved");
  });

  test("keeps focus and active-row highlight stable after save rerender", async ({
    page,
  }) => {
    const state = await installDrawerEditMockApi(page, [
      {
        id: "todo-focus-1",
        title: "Focus task",
        description: "Description",
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-focus-2",
        title: "Other task",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerTitleInput").fill("Focus task updated");
    await page.locator("#drawerTitleInput").press("Control+Enter");

    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) => entry.patch.title === "Focus task updated",
        ),
      )
      .toBeTruthy();

    await expect(page.locator("#drawerTitleInput")).toBeFocused();
    await expect(
      page.locator('.todo-item[data-todo-id="todo-focus-1"]'),
    ).toHaveClass(/todo-item--active/);
  });

  test("saves richer workflow metadata from the drawer", async ({ page }) => {
    const state = await installDrawerEditMockApi(page, [
      {
        id: "todo-rich-1",
        title: "Rich task",
        description: "Description",
        notes: null,
        category: "Home",
        dueDate: "2026-05-01T12:00:00.000Z",
        priority: "medium",
        status: "next",
        startDate: null,
        scheduledDate: null,
        reviewDate: null,
        tags: [],
        context: null,
        energy: null,
        effortScore: null,
        emotionalState: null,
        firstStep: null,
        estimateMinutes: null,
        waitingOn: null,
        dependsOnTaskIds: [],
        archived: false,
      },
      {
        id: "dep-task-1",
        title: "Dependency alpha",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "low",
      },
      {
        id: "dep-task-2",
        title: "Dependency beta",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerStatusSelect").selectOption("waiting");
    await page.locator("#drawerStartDateInput").fill("2026-05-01T09:00");
    await page.locator("#drawerScheduledDateInput").fill("2026-05-01T10:30");
    await page.locator("#drawerReviewDateInput").fill("2026-05-04T08:00");
    await page.locator("#drawerContextInput").fill("@computer");
    await page.locator("#drawerContextInput").blur();
    await page.locator("#drawerEffortSelect").selectOption("3");
    await page.locator("#drawerEnergySelect").selectOption("medium");
    await page.locator("#drawerEstimateInput").fill("45");
    await page.locator("#drawerDetailsToggle").click();
    await expect(page.locator("#drawerDetailsPanel")).toBeVisible();
    await page.locator("#drawerFirstStepInput").fill("Email the vendor");
    await page.locator("#drawerFirstStepInput").blur();
    await page.locator("#drawerEmotionalStateSelect").selectOption("heavy");
    await page.locator("#drawerTagsInput").fill("travel, planning");
    await page.locator("#drawerTagsInput").blur();
    await page.locator("#drawerWaitingOnInput").fill("Vendor quote");
    await page.locator("#drawerWaitingOnInput").blur();
    // Use task picker to add dependencies by searching
    const depPicker = page.locator("#drawerDependsOnPicker");
    await depPicker.locator(".task-picker__search").fill("Dependency alpha");
    await depPicker
      .locator(".task-picker__option", { hasText: "Dependency alpha" })
      .click();
    await depPicker.locator(".task-picker__search").fill("Dependency beta");
    await depPicker
      .locator(".task-picker__option", { hasText: "Dependency beta" })
      .click();
    await page.locator("#drawerArchivedToggle").check();

    await expect
      .poll(() =>
        state.updatePatches.some((entry) => entry.patch.status === "waiting"),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) =>
            entry.patch.startDate ===
            toIsoFromLocalDateTime("2026-05-01T09:00"),
        ),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some((entry) => entry.patch.effortScore === 3),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) => entry.patch.firstStep === "Email the vendor",
        ),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) => entry.patch.emotionalState === "heavy",
        ),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) =>
            Array.isArray(entry.patch.tags) &&
            entry.patch.tags.join(",") === "travel,planning",
        ),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some(
          (entry) =>
            Array.isArray(entry.patch.dependsOnTaskIds) &&
            entry.patch.dependsOnTaskIds.length === 2,
        ),
      )
      .toBeTruthy();
    await expect
      .poll(() =>
        state.updatePatches.some((entry) => entry.patch.archived === true),
      )
      .toBeTruthy();
  });

  test("shows save error and preserves unsaved title on API failure", async ({
    page,
  }) => {
    await installDrawerEditMockApi(
      page,
      [
        {
          id: "todo-1",
          title: "Original title",
          description: "Description",
          notes: null,
          category: "Home",
          dueDate: null,
          priority: "medium",
        },
      ],
      { failFirstUpdate: true },
    );

    await registerAndOpenTodos(page);
    await openFirstTodoDrawer(page);

    await page.locator("#drawerTitleInput").fill("Unsaved local title");
    await page.locator("#drawerPrioritySelect").focus();

    await expect(page.locator("#drawerSaveStatus")).toContainText(
      "Save failed from mock",
    );
    await expect(page.locator("#drawerTitleInput")).toHaveValue(
      "Unsaved local title",
    );
  });

  test("creates a task with richer metadata from quick entry", async ({
    page,
  }) => {
    await installDrawerEditMockApi(page, [
      {
        id: "dep-qe-1",
        title: "Prerequisite task",
        description: null,
        notes: null,
        category: null,
        dueDate: null,
        priority: "low",
      },
    ]);

    await registerAndOpenTodos(page);
    await page.evaluate(() =>
      (window as unknown as Record<string, () => void>).openTaskComposer(),
    );

    await page.locator("#todoInput").fill("Plan travel");
    await page.locator("#quickEntryPropertiesToggle").click();
    await page.locator("#todoStatusSelect").selectOption("scheduled");
    await page.locator("#todoProjectSelect").selectOption("Work");
    await page.locator("#todoDueDateInput").fill("2026-06-01T12:00");
    // Open the advanced fields section (collapsed by default after #506)
    const advancedDetails = page.locator("details.task-composer-advanced");
    if (await advancedDetails.count()) {
      await advancedDetails.locator("summary").click();
    }
    await page.locator("#todoStartDateInput").fill("2026-05-30T09:00");
    await page.locator("#todoScheduledDateInput").fill("2026-05-31T10:00");
    await page.locator("#todoReviewDateInput").fill("2026-06-02T08:30");
    await page.locator("#todoContextInput").fill("@computer");
    await page.locator("#todoEffortSelect").selectOption("2");
    await page.locator("#todoEnergySelect").selectOption("low");
    await page.locator("#todoEmotionalStateSelect").selectOption("exciting");
    await page
      .locator("#todoFirstStepInput")
      .fill("Price three flight options");
    await page.locator("#todoEstimateInput").fill("30");
    await page.locator("#todoTagsInput").fill("travel, planning");
    await page.locator("#todoWaitingOnInput").fill("Budget approval");
    // Use task picker to add a dependency by searching
    const qePicker = page.locator("#todoDependsOnPicker");
    await qePicker.locator(".task-picker__search").fill("Prerequisite");
    await qePicker
      .locator(".task-picker__option", { hasText: "Prerequisite task" })
      .click();
    await page.getByRole("button", { name: /Add notes/ }).click();
    await page.locator("#todoNotesInput").fill("Need options ready");

    const createRequest = page.waitForRequest(
      (request) =>
        request.url().endsWith("/todos") && request.method() === "POST",
    );
    await page.locator("#taskComposerAddButton").click();
    const request = await createRequest;
    const payload = JSON.parse(request.postData() || "{}");

    expect(payload).toMatchObject({
      title: "Plan travel",
      status: "scheduled",
      category: "Work",
      context: "@computer",
      effortScore: 2,
      energy: "low",
      emotionalState: "exciting",
      firstStep: "Price three flight options",
      estimateMinutes: 30,
      waitingOn: "Budget approval",
      notes: "Need options ready",
    });
    expect(payload.tags).toEqual(["travel", "planning"]);
    expect(payload.dependsOnTaskIds).toEqual(["dep-qe-1"]);
    expect(payload.startDate).toBe(toIsoFromLocalDateTime("2026-05-30T09:00"));
    expect(payload.scheduledDate).toBe(
      toIsoFromLocalDateTime("2026-05-31T10:00"),
    );
    expect(payload.reviewDate).toBe(toIsoFromLocalDateTime("2026-06-02T08:30"));
  });
});
