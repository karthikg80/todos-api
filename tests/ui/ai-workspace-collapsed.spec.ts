import { expect, test, type Page, type Route } from "@playwright/test";
import { openTodosViewWithStorageState } from "./helpers/todos-view";

function nowIso() {
  return new Date().toISOString();
}

async function installAiWorkspaceMockApi(page: Page) {
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
    if (!token) return "user-1";
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
      todosByUser.set(id, []);

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
        email: "ai-workspace@example.com",
        name: "AI Workspace Tester",
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

    if (pathname === "/ai/plan-from-goal" && method === "POST") {
      return json(route, 200, {
        suggestionId: "ai-suggestion-1",
        summary: "Draft plan",
        tasks: [
          {
            tempId: "task-1",
            title: "Drafted task",
            description: "Drafted description",
            dueDate: null,
            priority: "medium",
            projectName: null,
            subtasks: [],
          },
        ],
      });
    }

    if (
      pathname.startsWith("/ai/suggestions/") &&
      pathname.endsWith("/status")
    ) {
      return json(route, 200, { ok: true });
    }

    if (pathname === "/auth/logout" && method === "POST") {
      return json(route, 200, { ok: true });
    }

    return route.continue();
  });
}

async function openTodos(page: Page, { showWorkspace = false } = {}) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("todos:ai-collapsed");
  });
  await openTodosViewWithStorageState(page, {
    name: "AI Workspace User",
    email: "ai-workspace-user@example.com",
  });
  if (showWorkspace) {
    await page.goto("/?ai_debug=1");
  }
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

test.describe("AI workspace visibility defaults", () => {
  test("is hidden by default on Todos load", async ({ page }) => {
    await installAiWorkspaceMockApi(page);
    await openTodos(page);
    await expect(page.locator("#aiWorkspace")).toBeHidden();
    await expect(page.locator("#critiqueDraftButton")).toBeHidden();
  });
});

test.describe("AI workspace calm mode", () => {
  test.beforeEach(async ({ page }) => {
    await installAiWorkspaceMockApi(page);
    await openTodos(page, { showWorkspace: true });
  });

  test("defaults to collapsed on Todos load", async ({ page }) => {
    await expect(page.locator("#aiWorkspaceToggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator("#aiWorkspaceBody")).toBeHidden();
    await expect(page.locator("#aiWorkspaceStatus")).toContainText("Ready");
  });

  test("toggle expands and collapses workspace body", async ({ page }) => {
    const toggle = page.locator("#aiWorkspaceToggle");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#aiWorkspaceBody")).toBeVisible();
    await expect(page.locator("#goalInput")).toBeVisible();
    await expect(page.locator("#brainDumpInput")).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#aiWorkspaceBody")).toBeHidden();
  });

  test("Draft tasks CTA expands and focuses brain dump", async ({ page }) => {
    await page.locator("#aiWorkspaceDraftButton").click();
    await expect(page.locator("#aiWorkspaceToggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator("#brainDumpInput")).toBeFocused();
  });

  test("Escape inside expanded body collapses and restores focus to toggle", async ({
    page,
  }) => {
    await page.locator("#aiWorkspaceToggle").click();
    await expect(page.locator("#aiWorkspaceBody")).toBeVisible();

    await page.locator("#brainDumpInput").focus();
    await page.keyboard.press("Escape");

    await expect(page.locator("#aiWorkspaceToggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator("#aiWorkspaceBody")).toBeHidden();
    await expect(page.locator("#aiWorkspaceToggle")).toBeFocused();
  });

  test("collapsed state persists across reload", async ({ page }) => {
    await page.locator("#aiWorkspaceToggle").click();
    await expect(page.locator("#aiWorkspaceToggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await page.locator("#aiWorkspaceToggle").click();
    await expect(page.locator("#aiWorkspaceToggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await page.reload();
    await expect(page.locator("#todosView")).toHaveClass(/active/);
    await expect(page.locator("#aiWorkspaceToggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(page.locator("#aiWorkspaceBody")).toBeHidden();
  });
});
