import { expect, test, type Page, type Route } from "@playwright/test";
import {
  ensureAllTasksListActive,
  openTaskComposerSheet,
} from "./helpers/todos-view";

type TodoRecord = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  order: number;
  subtasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    order: number;
  }>;
};

function nowIso() {
  return new Date().toISOString();
}

function todayAtIso(hours: number) {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

async function installAiUiMockApi(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("feature.taskDrawerDecisionAssist", "true");
  });

  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  const todosByUser = new Map<string, TodoRecord[]>();
  const todayPlansByUser = new Map<
    string,
    {
      aiSuggestionId: string;
      status: "pending" | "accepted" | "rejected";
      outputEnvelope: Record<string, unknown>;
    }[]
  >();
  let userSeq = 1;
  let tokenSeq = 1;
  let aiSeq = 1;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? JSON.parse(raw) : {};
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return accessTokens.get(token) || "user-1";
  };

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
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
      todosByUser.set(id, [
        {
          id: "todo-1",
          title: "Ship website checklist",
          description: "",
          completed: false,
          category: "Website",
          dueDate: todayAtIso(10),
          priority: "medium",
          notes: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          order: 1,
          subtasks: [],
        },
        {
          id: "todo-2",
          title: "Marketing update draft",
          description: "",
          completed: false,
          category: "Marketing",
          dueDate: todayAtIso(14),
          priority: "low",
          notes: "",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          order: 2,
          subtasks: [],
        },
      ]);
      todayPlansByUser.set(id, []);
      return json(route, 201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      return json(route, 200, {
        id: userId,
        email: "ai-debug@example.com",
        name: "AI Debug Tester",
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
      return json(route, 200, todosByUser.get(userId) || []);
    }

    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      const userId = authUserId(route);
      const surface = url.searchParams.get("surface") || "";
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      if (surface !== "today_plan") {
        return route.fulfill({ status: 204, body: "" });
      }
      const plans = todayPlansByUser.get(userId) || [];
      const latest = plans.find((item) => item.status === "pending");
      if (!latest) {
        return route.fulfill({ status: 204, body: "" });
      }
      return json(route, 200, {
        aiSuggestionId: latest.aiSuggestionId,
        status: latest.status,
        outputEnvelope: latest.outputEnvelope,
      });
    }

    if (pathname === "/ai/decision-assist/stub" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      const body = await parseBody(route);
      if (String(body.surface || "") !== "today_plan") {
        return json(route, 400, { error: "surface must be today_plan" });
      }
      const todos = todosByUser.get(userId) || [];
      const top = todos.slice(0, 3);
      const aiSuggestionId = `today-${aiSeq++}`;
      const outputEnvelope = {
        surface: "today_plan",
        requestId: `today-plan-${aiSuggestionId}`,
        contractVersion: 1,
        generatedAt: nowIso(),
        must_abstain: false,
        planPreview: {
          topN: top.length || 3,
          items: top.map((todo, index) => ({
            todoId: todo.id,
            rank: index + 1,
            timeEstimateMin: index === 0 ? 45 : 30,
            rationale: "Debug test plan preview.",
          })),
        },
        suggestions: top.map((todo, index) => ({
          type: index === 0 ? "set_priority" : "set_due_date",
          suggestionId: `today-s-${aiSuggestionId}-${index + 1}`,
          confidence: 0.72,
          rationale: "Debug suggestion",
          payload:
            index === 0
              ? { todoId: todo.id, priority: "high" }
              : { todoId: todo.id, dueDateISO: todayAtIso(16 + index) },
        })),
      };
      todayPlansByUser.set(userId, [
        {
          aiSuggestionId,
          status: "pending",
          outputEnvelope,
        },
      ]);
      return json(route, 200, {
        ...outputEnvelope,
        suggestionId: aiSuggestionId,
      });
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

    if (pathname === "/auth/logout" && method === "POST") {
      return json(route, 200, { ok: true });
    }

    return route.continue();
  });
}

async function registerAndOpenTodos(page: Page, debug = false) {
  await page.goto(debug ? "/?ai_debug=1" : "/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("AI Debug User");
  await page
    .locator("#registerEmail")
    .fill(
      debug ? "ai-debug-mode-on@example.com" : "ai-debug-mode-off@example.com",
    );
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

async function openTodayView(page: Page) {
  if (
    (await page.locator("#taskComposerSheet").getAttribute("aria-hidden")) ===
    "false"
  ) {
    await page.keyboard.press("Escape");
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  }
  // #moreFiltersToggle is hidden until search is focused in the new layout; call
  // setDateView() directly so the test works on both desktop and mobile.
  await page.evaluate(() =>
    (window as Window & { setDateView: (v: string) => void }).setDateView(
      "today",
    ),
  );
  await expect(page.locator('[data-testid="today-plan-panel"]')).toBeVisible();
}

test.describe("AI debug metadata visibility", () => {
  test.beforeEach(async ({ page }) => {
    await installAiUiMockApi(page);
  });

  test("metadata is hidden when ai_debug query param is absent", async ({
    page,
  }) => {
    await registerAndOpenTodos(page, false);
    await openTaskComposerSheet(page);
    await page.locator("#todoInput").fill("urgent tomorrow website marketing");

    const onCreateRow = page.locator('[data-testid="ai-on-create-row"]');
    await expect(onCreateRow).toBeVisible();
    await expect(
      onCreateRow.locator('[data-testid="ai-debug-meta"]'),
    ).toHaveCount(0);
    await expect(
      onCreateRow.locator('[data-testid^="ai-debug-suggestion-id-"]'),
    ).toHaveCount(0);

    await openTodayView(page);
    await page.locator('[data-testid="today-plan-generate"]').click();
    const panel = page.locator('[data-testid="today-plan-panel"]');
    await expect(panel.locator('[data-testid="ai-debug-meta"]')).toHaveCount(0);
    await expect(
      panel.locator('[data-testid^="ai-debug-suggestion-id-"]'),
    ).toHaveCount(0);
  });

  test("metadata is visible when ai_debug query param is enabled", async ({
    page,
  }) => {
    await registerAndOpenTodos(page, true);
    await openTaskComposerSheet(page);

    await page.locator("#todoInput").fill("urgent tomorrow website");
    const onCreateRow = page.locator('[data-testid="ai-on-create-row"]');
    await expect(
      onCreateRow.locator('[data-testid="ai-debug-meta"]'),
    ).toContainText("v1");
    await expect(
      onCreateRow.locator('[data-testid^="ai-debug-suggestion-id-"]'),
    ).toHaveCount(3);

    await openTodayView(page);
    await page
      .locator('[data-testid="today-plan-goal-input"]')
      .fill("quick wins");
    await page.locator('[data-testid="today-plan-generate"]').click();

    const panel = page.locator('[data-testid="today-plan-panel"]');
    await expect(panel.locator('[data-testid="ai-debug-meta"]')).toContainText(
      "req:today-plan-",
    );
    expect(
      await panel.locator('[data-testid^="ai-debug-suggestion-id-"]').count(),
    ).toBeGreaterThan(0);
  });
});
