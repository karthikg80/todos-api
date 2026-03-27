import { expect, test, type Page, type Route } from "@playwright/test";
import {
  openTaskComposerSheet,
  openTodosViewWithStorageState,
} from "./helpers/todos-view";

type SeedTodo = {
  id: string;
  title: string;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  notes?: string | null;
  completed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  subtasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
    order: number;
  }>;
};

type PrioritiesBriefMockResponse = {
  html?: string;
  generatedAt?: string;
  isStale?: boolean;
  refreshInFlight?: boolean;
  delayMs?: number;
  status?: number;
  error?: string;
};

function isoDaysFromNow(days: number, hour = 10) {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
}

function isoDaysAgo(days: number, hour = 10) {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  dt.setHours(hour, 0, 0, 0);
  return dt.toISOString();
}

async function installHomeFocusMockApi(
  page: Page,
  {
    aiDecisionAssistStatus = 500,
    aiTopFocus = null,
    homeFocusSequences = null,
    prioritiesBriefResponses = null,
    seedTodos,
  }: {
    aiDecisionAssistStatus?: number;
    aiTopFocus?: Array<{ todoId: string; reason?: string }> | null;
    homeFocusSequences?: Array<
      Array<{ todoId: string; summary?: string; reason?: string }>
    > | null;
    prioritiesBriefResponses?: PrioritiesBriefMockResponse[] | null;
    seedTodos: SeedTodo[];
  },
) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, Array<Record<string, unknown>>>();
  let latestHomeSuggestion: {
    id: string;
    status: "pending" | "accepted" | "rejected";
    outputEnvelope: Record<string, unknown>;
  } | null = null;
  let userSeq = 1;
  let tokenSeq = 1;
  let todoSeq = 1000;
  let homeFocusSeq = 1;
  let homeFocusGenerateSeq = 0;
  let prioritiesBriefGetSeq = 0;

  const nowIso = () => new Date().toISOString();
  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  };

  const getHomeFocusCards = () => {
    if (Array.isArray(homeFocusSequences) && homeFocusSequences.length > 0) {
      const index = Math.min(
        homeFocusGenerateSeq,
        homeFocusSequences.length - 1,
      );
      return homeFocusSequences[index] || [];
    }
    return Array.isArray(aiTopFocus)
      ? aiTopFocus.map((item) => ({
          todoId: item.todoId,
          summary: item.reason,
          reason: item.reason,
        }))
      : [];
  };

  const buildTodosForUser = (userId: string) =>
    seedTodos.map((todo, index) => ({
      id: todo.id,
      title: todo.title,
      description: null,
      completed: !!todo.completed,
      category: todo.category ?? null,
      dueDate: todo.dueDate ?? null,
      order: index,
      priority: todo.priority,
      notes: todo.notes ?? null,
      userId,
      createdAt: todo.createdAt || isoDaysAgo(14),
      updatedAt: todo.updatedAt || isoDaysAgo(3),
      subtasks:
        todo.subtasks?.map((subtask, subIndex) => ({
          ...subtask,
          order: subtask.order ?? subIndex,
          todoId: todo.id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })) || [],
    }));

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const existing = accessTokens.get(token);
    if (existing) return existing;
    if (!token) return null;
    const id = `cached-user-${userSeq++}`;
    accessTokens.set(token, id);
    if (!todosByUser.has(id)) {
      todosByUser.set(id, buildTodosForUser(id));
    }
    return id;
  };

  const buildHomeFocusEnvelope = (
    userId: string,
    cards: Array<{ todoId: string; summary?: string; reason?: string }>,
  ) => {
    const todos = todosByUser.get(userId) || [];
    const todoById = new Map(
      todos.map((todo) => [String(todo.id), todo] as const),
    );
    const suggestions = cards
      .map((card) => {
        const todo = todoById.get(String(card.todoId || ""));
        if (!todo) return null;
        const summary = String(
          card.summary || card.reason || "Suggested focus for Home.",
        ).trim();
        return {
          type: "focus_task",
          suggestionId: `home-focus-${homeFocusSeq++}`,
          confidence: 0.81,
          payload: {
            todoId: String(todo.id),
            taskId: String(todo.id),
            projectId:
              typeof todo.projectId === "string" ? todo.projectId : undefined,
            title: String(todo.title || ""),
            summary,
            source: "deterministic",
          },
        };
      })
      .filter(Boolean);

    return {
      contractVersion: 1,
      generatedAt: nowIso(),
      requestId: `home-focus-request-${homeFocusGenerateSeq + 1}`,
      surface: "home_focus",
      must_abstain: suggestions.length === 0,
      suggestions,
    };
  };

  const buildPrioritiesBriefHtml = () => {
    const primaryTodo =
      seedTodos.find((todo) => !todo.completed) || seedTodos[0];
    const title = String(primaryTodo?.title || "Nothing urgent right now.");
    return `
      <div class="home-priorities-brief">
        <div class="home-priorities-brief__item">
          <strong>${title}</strong>
        </div>
      </div>
    `;
  };

  const getPrioritiesBriefResponse = () => {
    if (
      Array.isArray(prioritiesBriefResponses) &&
      prioritiesBriefResponses.length > 0
    ) {
      const index = Math.min(
        prioritiesBriefGetSeq,
        prioritiesBriefResponses.length - 1,
      );
      prioritiesBriefGetSeq += 1;
      return prioritiesBriefResponses[index] || {};
    }
    prioritiesBriefGetSeq += 1;
    return {};
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
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      if (users.has(email)) {
        return json(route, 409, { error: "Email already registered" });
      }
      const userId = `user-${userSeq++}`;
      users.set(email, {
        id: userId,
        email,
        password: String(body.password || ""),
      });
      const token = `token-${tokenSeq++}`;
      accessTokens.set(token, userId);
      todosByUser.set(userId, buildTodosForUser(userId));
      return json(route, 201, {
        user: { id: userId, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, {
        id: userId,
        email: "home-focus@example.com",
        name: "Home Focus Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        onboardingCompletedAt: nowIso(),
      });
    }

    if (pathname === "/preferences" && method === "GET") {
      return json(route, 200, {
        maxDailyTasks: null,
        preferredChunkMinutes: null,
        deepWorkPreference: null,
        weekendsActive: true,
        preferredContexts: [],
        waitingFollowUpDays: 7,
        workWindowsJson: null,
        soulProfile: {
          lifeAreas: ["work"],
          failureModes: ["overwhelmed"],
          planningStyle: "both",
          energyPattern: "variable",
          goodDayThemes: ["visible_progress"],
          tone: "calm",
          dailyRitual: "neither",
        },
      });
    }

    if (pathname === "/agent/write/set_day_context" && method === "POST") {
      const body = await parseBody(route);
      return json(route, 200, {
        ok: true,
        action: "set_day_context",
        dayContext: {
          contextDate: body.contextDate || nowIso().slice(0, 10),
          mode: body.mode || "normal",
          energy: body.energy || null,
          notes: body.notes || null,
        },
      });
    }

    if (pathname === "/projects" && method === "GET") {
      return json(route, 200, []);
    }

    if (pathname === "/todos" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, (todosByUser.get(userId) || []).slice());
    }

    if (pathname === "/todos" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const body = await parseBody(route);
      const list = todosByUser.get(userId) || [];
      const todoId = `todo-${todoSeq++}`;
      const nextTodo = {
        id: todoId,
        title: String(body.title || ""),
        description: null,
        completed: false,
        category: body.category ?? null,
        dueDate: body.dueDate ?? null,
        order: list.length,
        priority: (body.priority as string) || "medium",
        notes: body.notes ?? null,
        firstStep: body.firstStep ?? null,
        emotionalState: body.emotionalState ?? null,
        effortScore:
          typeof body.effortScore === "number" ? body.effortScore : null,
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      };
      list.push(nextTodo);
      todosByUser.set(userId, list);
      return json(route, 201, nextTodo);
    }

    if (pathname.startsWith("/todos/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const todoId = pathname.split("/")[2];
      const patch = await parseBody(route);
      const list = todosByUser.get(userId) || [];
      const index = list.findIndex((todo) => String(todo.id) === todoId);
      if (index < 0) return json(route, 404, { error: "Todo not found" });
      const updated = { ...list[index], ...patch, updatedAt: nowIso() };
      list[index] = updated;
      todosByUser.set(userId, list);
      return json(route, 200, updated);
    }

    if (pathname === "/ai/decision-assist/stub" && method === "POST") {
      const body = await parseBody(route);
      if (String(body.surface || "") !== "home_focus") {
        return json(route, 404, { error: "Not found" });
      }
      if (aiDecisionAssistStatus >= 400) {
        return json(route, aiDecisionAssistStatus, { error: "AI unavailable" });
      }
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const outputEnvelope = buildHomeFocusEnvelope(
        userId,
        getHomeFocusCards(),
      );
      const suggestionId = `home-focus-db-${homeFocusGenerateSeq + 1}`;
      latestHomeSuggestion = {
        id: suggestionId,
        status: "pending",
        outputEnvelope,
      };
      homeFocusGenerateSeq += 1;
      return json(route, 200, {
        ...outputEnvelope,
        suggestionId,
      });
    }

    if (pathname === "/ai/suggestions" && method === "GET") {
      return json(route, 200, []);
    }
    if (pathname === "/ai/priorities-brief" && method === "GET") {
      const mock = getPrioritiesBriefResponse();
      if (mock.delayMs && mock.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, mock.delayMs));
      }
      if ((mock.status || 200) >= 400) {
        return json(route, mock.status || 500, {
          error: mock.error || "Priorities brief failed",
        });
      }
      return json(route, mock.status || 200, {
        html: mock.html || buildPrioritiesBriefHtml(),
        generatedAt: mock.generatedAt || nowIso(),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        cached: prioritiesBriefGetSeq > 1,
        isStale: !!mock.isStale,
        refreshInFlight: !!mock.refreshInFlight,
      });
    }
    if (pathname === "/ai/priorities-brief/refresh" && method === "POST") {
      return json(route, 200, {
        ok: true,
        refreshInFlight: true,
      });
    }
    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      if (url.searchParams.get("surface") !== "home_focus") {
        return json(route, 404, { error: "Not found" });
      }
      if (!latestHomeSuggestion || latestHomeSuggestion.status !== "pending") {
        return route.fulfill({ status: 204, body: "" });
      }
      return json(route, 200, {
        aiSuggestionId: latestHomeSuggestion.id,
        status: latestHomeSuggestion.status,
        outputEnvelope: latestHomeSuggestion.outputEnvelope,
      });
    }
    if (
      pathname.startsWith("/ai/suggestions/") &&
      pathname.endsWith("/apply") &&
      method === "POST"
    ) {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const suggestionDbId = pathname.split("/")[3];
      if (!latestHomeSuggestion || latestHomeSuggestion.id !== suggestionDbId) {
        return json(route, 404, { error: "Suggestion not found" });
      }
      const body = await parseBody(route);
      const selectedSuggestion = Array.isArray(
        latestHomeSuggestion.outputEnvelope.suggestions,
      )
        ? latestHomeSuggestion.outputEnvelope.suggestions.find(
            (item) =>
              item &&
              typeof item === "object" &&
              String((item as Record<string, unknown>).suggestionId || "") ===
                String(body.suggestionId || ""),
          )
        : null;
      if (!selectedSuggestion || typeof selectedSuggestion !== "object") {
        return json(route, 404, { error: "Suggestion item not found" });
      }
      const payload =
        selectedSuggestion.payload &&
        typeof selectedSuggestion.payload === "object"
          ? selectedSuggestion.payload
          : {};
      const todoId = String(payload.todoId || "");
      const todo = (todosByUser.get(userId) || []).find(
        (item) => String(item.id) === todoId,
      );
      if (!todo) {
        return json(route, 404, { error: "Todo not found" });
      }
      latestHomeSuggestion = null;
      return json(route, 200, {
        todo,
        appliedSuggestionId: String(body.suggestionId || ""),
        suggestion: {
          id: suggestionDbId,
          status: "accepted",
          appliedTodoIds: [todoId],
        },
        idempotent: false,
      });
    }
    if (
      pathname.startsWith("/ai/suggestions/") &&
      pathname.endsWith("/dismiss") &&
      method === "POST"
    ) {
      const suggestionDbId = pathname.split("/")[3];
      if (!latestHomeSuggestion || latestHomeSuggestion.id !== suggestionDbId) {
        return json(route, 404, { error: "Suggestion not found" });
      }
      latestHomeSuggestion = null;
      return route.fulfill({ status: 204, body: "" });
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
    if (pathname === "/auth/logout" && method === "POST") {
      return json(route, 200, { ok: true });
    }

    return route.continue();
  });
}

async function openHomeApp(page: Page) {
  await openTodosViewWithStorageState(
    page,
    {
      name: "Home Focus",
      email: "home-focus@example.com",
    },
    { preserveLandingDefault: true },
  );
}

function isMobileViewport(page: Page) {
  const size = page.viewportSize();
  return !!size && size.width <= 700;
}

async function openProjectsRailIfNeeded(page: Page) {
  const desktopAll = page.locator(
    '#projectsRail .workspace-view-item[data-workspace-view="all"]',
  );
  if (await canClick(desktopAll)) {
    return "desktop";
  }

  const mobileOpen = page.locator("#projectsRailMobileOpen");
  const sheet = page.locator("#projectsRailSheet");
  const isSheetOpen = (await sheet.getAttribute("aria-hidden")) === "false";
  if (!isSheetOpen && (await canClick(mobileOpen))) {
    await mobileOpen.click();
    await expect(sheet).toHaveAttribute("aria-hidden", "false");
  }
  if ((await sheet.getAttribute("aria-hidden")) === "false") {
    return "sheet";
  }
  return "desktop";
}

async function canClick(locator: ReturnType<Page["locator"]>) {
  try {
    await locator.click({ trial: true, timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

async function closeProjectsRailSheetIfOpen(page: Page) {
  const sheet = page.locator("#projectsRailSheet");
  if ((await sheet.getAttribute("aria-hidden")) === "false") {
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveAttribute("aria-hidden", "true");
  }
}

async function clickWorkspaceView(page: Page, view: string) {
  const mobile = isMobileViewport(page);
  const desktopTarget = page.locator(
    `#projectsRail .workspace-view-item[data-workspace-view="${view}"]`,
  );
  if (!mobile && (await desktopTarget.isVisible())) {
    if (await canClick(desktopTarget)) {
      await desktopTarget.click();
      return;
    }
  }

  const surface = await openProjectsRailIfNeeded(page);
  if (surface === "desktop") {
    await desktopTarget.click();
    return;
  }
  const sheetTarget = page.locator(
    `#projectsRailSheet .workspace-view-item[data-workspace-view="${view}"]`,
  );
  await sheetTarget.click();
  await closeProjectsRailSheetIfOpen(page);
}

async function clickProjectInRail(page: Page, projectKey: string) {
  const mobile = isMobileViewport(page);
  const desktopTarget = page.locator(
    `#projectsRail .projects-rail-item[data-project-key="${projectKey}"]`,
  );
  if (!mobile && (await desktopTarget.isVisible())) {
    if (await canClick(desktopTarget)) {
      await desktopTarget.click();
      return;
    }
  }

  const surface = await openProjectsRailIfNeeded(page);
  if (surface === "desktop") {
    await desktopTarget.click();
    return;
  }
  const sheetTarget = page.locator(
    `#projectsRailSheet .projects-rail-item[data-project-key="${projectKey}"]`,
  );
  await sheetTarget.click();
  await closeProjectsRailSheetIfOpen(page);
}

async function expectWorkspaceViewActive(page: Page, view: string) {
  if (!isMobileViewport(page)) {
    const desktopTarget = page.locator(
      `#projectsRail .workspace-view-item[data-workspace-view="${view}"]`,
    );
    await expect(desktopTarget).toHaveClass(/projects-rail-item--active/);
    return;
  }

  // On mobile, close the task composer sheet first so its backdrop
  // doesn't block the projects rail mobile button.
  const composerSheet = page.locator("#taskComposerSheet");
  if ((await composerSheet.getAttribute("aria-hidden")) === "false") {
    await page.keyboard.press("Escape");
    await expect(composerSheet).toHaveAttribute("aria-hidden", "true");
  }

  const mobileOpen = page.locator("#projectsRailMobileOpen");
  if (await mobileOpen.isVisible()) {
    await openProjectsRailIfNeeded(page);
    const sheetTarget = page.locator(
      `#projectsRailSheet .workspace-view-item[data-workspace-view="${view}"]`,
    );
    await expect(sheetTarget).toHaveClass(/projects-rail-item--active/);
    await page.keyboard.press("Escape");
    return;
  }
}

async function expectListOrEmptyState(page: Page) {
  const titleCount = await page.locator(".todo-item .todo-title").count();
  if (titleCount > 0) {
    await expect(page.locator(".todo-item .todo-title").first()).toBeVisible();
    return;
  }
  await expect(page.locator("#todosContent")).toContainText(
    /No tasks|No todos|Nothing to show/i,
  );
}

function buildSeedTodos(): SeedTodo[] {
  return [
    {
      id: "todo-overdue",
      title: "Send overdue invoice",
      category: null,
      dueDate: isoDaysFromNow(-1, 9),
      priority: "high",
      createdAt: isoDaysAgo(20),
      updatedAt: isoDaysAgo(7),
    },
    {
      id: "todo-today",
      title: "Prepare launch checklist",
      category: "Work",
      dueDate: isoDaysFromNow(0, 11),
      priority: "high",
      createdAt: isoDaysAgo(5),
      updatedAt: isoDaysAgo(1),
    },
    {
      id: "todo-tomorrow",
      title: "Call contractor",
      category: null,
      dueDate: isoDaysFromNow(1, 13),
      priority: "medium",
      createdAt: isoDaysAgo(4),
      updatedAt: isoDaysAgo(4),
    },
    {
      id: "todo-quick-win",
      title: "Email receipt",
      category: null,
      dueDate: null,
      priority: "low",
      createdAt: isoDaysAgo(2),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "todo-project-seed",
      title: "Work project seed",
      category: "Work",
      dueDate: isoDaysFromNow(4, 10),
      priority: "medium",
      createdAt: isoDaysAgo(3),
      updatedAt: isoDaysAgo(2),
    },
    {
      id: "todo-stale",
      title: "Long-running stale item",
      category: null,
      dueDate: null,
      priority: "high",
      notes: "Needs follow-up notes",
      createdAt: isoDaysAgo(30),
      updatedAt: isoDaysAgo(12),
      subtasks: [{ id: "sub-1", title: "Subtask", completed: false, order: 0 }],
    },
  ];
}

function buildPrioritiesBriefMarkup(title: string) {
  return `
    <div class="home-priorities-brief">
      <div class="home-priorities-brief__item">
        <strong>${title}</strong>
      </div>
    </div>
  `;
}

test.describe("Home focus dashboard + sheet composer", () => {
  test.beforeEach(async ({ page }) => {
    await installHomeFocusMockApi(page, {
      aiDecisionAssistStatus: 500,
      seedTodos: buildSeedTodos(),
    });
    await openHomeApp(page);
  });

  test("Home tiles render deterministic fallback when AI endpoint fails", async ({
    page,
  }) => {
    await expect(page.locator('[data-testid="home-dashboard"]')).toBeVisible();
    await expectWorkspaceViewActive(page, "home");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Home");
    await expect(page.locator('[data-testid="home-brief-card"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="home-priorities-tile"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="home-priorities-tile"]'),
    ).toContainText("Today's focus");
    await expect(
      page.locator('[data-testid="home-priorities-tile"]'),
    ).toContainText(
      /Prepare launch checklist|Send overdue invoice|Nothing urgent right now/,
    );
    await expect(page.locator('[data-home-tile="due_soon"]')).toBeVisible();
    await expect(page.locator('[data-home-tile="stale_risks"]')).toBeVisible();
  });

  test("New Task opens bottom sheet; Enter follows the suggested create-task path", async ({
    page,
  }) => {
    await openTaskComposerSheet(page);
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await page.locator("#todoInput").fill("Submit expense report tomorrow");
    await expect(page.locator("#taskComposerAddButton")).toHaveText(
      "Create task now",
    );
    await page.locator("#todoInput").press("Enter");
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await clickWorkspaceView(page, "triage");
    await expect(
      page
        .locator(".triage-item--todo")
        .filter({ hasText: "Submit expense report" }),
    ).toBeVisible();
  });

  test("Creating a task with a project keeps it out of Triage and shows in that project", async ({
    page,
  }) => {
    await clickWorkspaceView(page, "triage");
    await openTaskComposerSheet(page);
    await page.locator("#todoInput").fill("Project scoped task");
    await page.locator("#quickEntryPropertiesToggle").click();
    await page.locator("#todoProjectSelect").selectOption({ label: "Work" });
    await page.locator("#taskComposerAddButton").click();

    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(
      page
        .locator(".triage-item--todo")
        .filter({ hasText: "Project scoped task" }),
    ).toHaveCount(0);

    await clickProjectInRail(page, "Work");
    await expect(
      page.locator(".todo-item").filter({ hasText: "Project scoped task" }),
    ).toBeVisible();
  });

  test("Task composer opens in a compact default state", async ({ page }) => {
    await openTaskComposerSheet(page);
    await expect(page.locator("#quickEntryPropertiesPanel")).toBeHidden();
    await expect(
      page.locator(".task-composer-project-actions"),
    ).not.toHaveAttribute("open", "");
    await expect(page.locator("#todoInput")).toBeVisible();
  });

  test("All tasks keeps the list surface primary", async ({ page }) => {
    await clickWorkspaceView(page, "all");
    await expect(page.locator("#todosListHeader")).toBeVisible();
    await expect(page.locator("#inlineQuickAdd")).toBeVisible();
    await expect(page.locator('[data-testid="home-dashboard"]')).toHaveCount(0);
    await expect(page.locator("#aiWorkspace")).toBeHidden();
  });

  test("Home shows rescue mode affordance and can switch the day into rescue mode", async ({
    page,
  }) => {
    await clickWorkspaceView(page, "home");
    await expect(
      page.locator('[data-testid="home-rescue-panel"]'),
    ).toBeVisible();

    const requestPromise = page.waitForRequest(
      (request) =>
        request.url().endsWith("/agent/write/set_day_context") &&
        request.method() === "POST",
    );
    await page.getByRole("button", { name: "Start rescue mode" }).click();
    const request = await requestPromise;
    const payload = JSON.parse(request.postData() || "{}");

    expect(payload.mode).toBe("rescue");
    await expect(
      page.locator('[data-testid="home-rescue-panel"]'),
    ).toContainText("Rescue mode is on");
  });

  test("Today and Upcoming still navigate on the planner surface", async ({
    page,
  }) => {
    await clickWorkspaceView(page, "today");
    await expectWorkspaceViewActive(page, "today");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Today");
    await expect(page.locator("#todosListHeaderDateBadge")).toBeHidden();
    await expectListOrEmptyState(page);

    await clickWorkspaceView(page, "upcoming");
    await expectWorkspaceViewActive(page, "upcoming");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Upcoming");
    await expect(page.locator("#todosListHeaderDateBadge")).toBeHidden();
    await expectListOrEmptyState(page);
  });

  test("Triage shows an explicit header title", async ({ page }) => {
    await clickWorkspaceView(page, "triage");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Triage");
    await expect(page.locator("#todosListHeaderDateBadge")).toBeHidden();
  });

  test("Sidebar profile hub contains nav items", async ({ page }) => {
    test.skip(isMobileViewport(page), "Sidebar is desktop-only.");

    // Profile button is in the sidebar utility section — scroll into view
    const profileBtn = page.locator("#dockProfileBtn");
    await profileBtn.scrollIntoViewIfNeeded();
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();

    const panel = page.locator("#dockProfilePanel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Settings");
    await expect(panel).toContainText("Feedback");
    await expect(panel).toContainText("Logout");
  });
});

test.describe("Home priorities stale refresh", () => {
  test("Home renders cached priorities immediately and swaps in the refreshed tile", async ({
    page,
  }) => {
    await installHomeFocusMockApi(page, {
      seedTodos: buildSeedTodos(),
      prioritiesBriefResponses: [
        {
          html: buildPrioritiesBriefMarkup("Initial priorities"),
          generatedAt: "2026-03-20T10:55:00.000Z",
          isStale: false,
          refreshInFlight: false,
        },
        {
          html: buildPrioritiesBriefMarkup("Cached priorities"),
          generatedAt: "2026-03-20T11:00:00.000Z",
          isStale: true,
          refreshInFlight: true,
          delayMs: 300,
        },
        {
          html: buildPrioritiesBriefMarkup("Fresh priorities"),
          generatedAt: "2026-03-20T11:05:00.000Z",
          isStale: false,
          refreshInFlight: false,
        },
      ],
    });

    await openHomeApp(page);
    await page.evaluate(
      (payload) => {
        window.localStorage.setItem(
          "todos:home-priorities-brief-cache",
          JSON.stringify(payload),
        );
      },
      {
        html: buildPrioritiesBriefMarkup("Cached priorities"),
        generatedAt: "2026-03-20T11:00:00.000Z",
        expiresAt: "2026-03-20T15:00:00.000Z",
      },
    );
    await page.reload();

    const tile = page.locator('[data-testid="home-priorities-tile"]');
    await expect(tile).toContainText("Cached priorities");
    await expect(tile).toContainText(
      /Updating priorities|Refreshing priorities/,
    );
    await expect(tile).toContainText("Fresh priorities");
  });

  test("Failed refresh keeps the previous priorities tile visible", async ({
    page,
  }) => {
    await installHomeFocusMockApi(page, {
      seedTodos: buildSeedTodos(),
      prioritiesBriefResponses: [
        {
          html: buildPrioritiesBriefMarkup("Visible priorities"),
          generatedAt: "2026-03-20T12:00:00.000Z",
        },
        {
          status: 500,
          error: "Refresh failed",
        },
      ],
    });

    await openHomeApp(page);

    const tile = page.locator('[data-testid="home-priorities-tile"]');
    await expect(tile).toContainText("Visible priorities");

    await page.locator(".home-priorities-refresh-btn").click();

    await expect(tile).toContainText("Visible priorities");
    await expect(tile).toContainText("Showing the last update.");
  });
});
