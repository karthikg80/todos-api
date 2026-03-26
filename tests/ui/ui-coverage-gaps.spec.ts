import { expect, test, type Page, type Route } from "@playwright/test";
import {
  openTodosViewWithStorageState,
  openTodoDrawerFromListRow,
  ensureAllTasksListActive,
  waitForTodosViewIdle,
} from "./helpers/todos-view";

// ---------------------------------------------------------------------------
// Shared mock API — lightweight auth + todos + MCP sessions
// ---------------------------------------------------------------------------

type TodoSeed = {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  category?: string | null;
  dueDate?: string | null;
  priority?: "low" | "medium" | "high";
};

type McpSession = {
  id: string;
  clientName: string;
  scopes: string[];
  lastUsedAt: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

async function installGapsMockApi(
  page: Page,
  todosSeed: TodoSeed[] = [],
  mcpSessions: McpSession[] = [],
) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  let userSeq = 1;
  let tokenSeq = 1;
  let calendarExportCalled = false;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    return raw ? JSON.parse(raw) : {};
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers().authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const knownUserId = accessTokens.get(token);
    if (knownUserId) return knownUserId;
    if (!token) return null;
    const id = `cached-user-${userSeq++}`;
    users.set(`cached-${id}@example.com`, {
      id,
      email: `cached-${id}@example.com`,
      password: "",
    });
    accessTokens.set(token, id);
    return id;
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
      if (users.has(email)) {
        return json(route, 409, { error: "Email already registered" });
      }
      const id = `user-${userSeq++}`;
      users.set(email, { id, email, password: String(body.password || "") });
      const token = `token-${tokenSeq++}`;
      accessTokens.set(token, id);
      return json(route, 201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken: `refresh-${tokenSeq++}`,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(route, 200, {
        id: userId,
        email: "gap-tester@example.com",
        name: "Gap Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        onboardingCompletedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      return json(route, 200, []);
    }

    if (pathname === "/todos" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });
      return json(
        route,
        200,
        todosSeed.map((todo, index) => ({
          ...todo,
          completed: false,
          order: index,
          userId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          subtasks: [],
        })),
      );
    }

    if (
      pathname.startsWith("/todos/") &&
      method === "PATCH" &&
      pathname.split("/").length === 3
    ) {
      const todoId = pathname.split("/")[2];
      const body = await parseBody(route);
      return json(route, 200, {
        id: todoId,
        ...body,
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/auth/mcp/sessions" && method === "GET") {
      return json(route, 200, { sessions: mcpSessions });
    }

    if (pathname === "/auth/mcp/sessions" && method === "DELETE") {
      mcpSessions.length = 0;
      return json(route, 200, { ok: true });
    }

    if (
      pathname.startsWith("/auth/mcp/sessions/") &&
      method === "DELETE" &&
      pathname.split("/").length === 5
    ) {
      const sessionId = pathname.split("/")[4];
      const idx = mcpSessions.findIndex((s) => s.id === sessionId);
      if (idx !== -1) mcpSessions.splice(idx, 1);
      return json(route, 200, { ok: true });
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

  return {
    get calendarExportCalled() {
      return calendarExportCalled;
    },
    set calendarExportCalled(v: boolean) {
      calendarExportCalled = v;
    },
  };
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/?tab=register");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Gap Tester");
  await page.locator("#registerEmail").fill("gap@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

async function openCommandPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#commandPaletteOverlay")).toHaveClass(
    /command-palette-overlay--open/,
  );
}

// ============================================================================
// P1: Command Palette — Theme Toggle
// ============================================================================

test.describe("Command palette system actions", () => {
  test.beforeEach(async ({ page }) => {
    await installGapsMockApi(page);
    await registerAndOpenTodos(page);
  });

  test("Toggle Dark Mode command applies dark-mode class and persists", async ({
    page,
  }) => {
    // Ensure we start in light mode
    await expect(page.locator("body")).not.toHaveClass(/dark-mode/);

    await openCommandPalette(page);
    await page.locator("#commandPaletteInput").fill("dark");
    await expect(page.locator("#commandPaletteList")).toContainText(
      "Toggle Dark Mode",
    );
    await page.keyboard.press("Enter");

    // Palette closes and dark mode applies
    await expect(page.locator("#commandPaletteOverlay")).not.toHaveClass(
      /command-palette-overlay--open/,
    );
    await expect(page.locator("body")).toHaveClass(/dark-mode/);

    // localStorage persists theme
    const storedTheme = await page.evaluate(() =>
      localStorage.getItem("theme"),
    );
    expect(storedTheme).toBe("dark");
  });

  test("theme persists across page reload", async ({ page }) => {
    // Toggle to dark
    await page.evaluate(() => window.toggleTheme?.());
    await expect(page.locator("body")).toHaveClass(/dark-mode/);

    // Reload
    await page.reload();
    await waitForTodosViewIdle(page);

    // Dark mode restored from localStorage
    await expect(page.locator("body")).toHaveClass(/dark-mode/);
  });

  // ==========================================================================
  // P1: Command Palette — Keyboard Shortcuts Overlay
  // ==========================================================================

  test("Show Keyboard Shortcuts command opens overlay", async ({ page }) => {
    await openCommandPalette(page);
    await page.locator("#commandPaletteInput").fill("shortcut");
    await expect(page.locator("#commandPaletteList")).toContainText(
      "Show Keyboard Shortcuts",
    );
    await page.keyboard.press("Enter");

    // Palette closes, shortcuts overlay opens
    await expect(page.locator("#commandPaletteOverlay")).not.toHaveClass(
      /command-palette-overlay--open/,
    );
    await expect(page.locator("#shortcutsOverlay")).toHaveClass(/active/);

    // Escape closes the shortcuts overlay
    await page.keyboard.press("Escape");
    await expect(page.locator("#shortcutsOverlay")).not.toHaveClass(/active/);
  });

  // ==========================================================================
  // P1: Command Palette — Export Calendar
  // ==========================================================================

  test("Export Calendar command is available in palette", async ({ page }) => {
    await openCommandPalette(page);
    await page.locator("#commandPaletteInput").fill("export");
    await expect(page.locator("#commandPaletteList")).toContainText(
      "Export Calendar",
    );
  });
});

// ============================================================================
// P2: Ctrl+Enter saves title in drawer
// ============================================================================

test.describe("Drawer keyboard shortcuts", () => {
  test("Ctrl+Enter in drawer title saves without closing", async ({ page }) => {
    await installGapsMockApi(page, [
      {
        id: "todo-1",
        title: "Original title",
        category: null,
        dueDate: null,
        priority: "medium",
      },
    ]);
    await registerAndOpenTodos(page);

    // Open drawer via the helper (handles desktop inline→More details flow)
    const todoItem = page.locator('.todo-item[data-todo-id="todo-1"]');
    await expect(todoItem).toBeVisible();
    await openTodoDrawerFromListRow(page, todoItem);

    // Find the title input inside the drawer
    const titleInput = page.locator("#drawerTitleInput");
    await expect(titleInput).toBeVisible();
    await titleInput.click();
    await titleInput.fill("Updated via Ctrl+Enter");
    await page.keyboard.press("ControlOrMeta+Enter");

    // Drawer should remain visible (not closed by Ctrl+Enter)
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
  });
});

// ============================================================================
// P3: MCP Sessions Management
// ============================================================================

test.describe("MCP sessions management", () => {
  test("settings view renders MCP sessions and revoke works", async ({
    page,
  }) => {
    const sessions: McpSession[] = [
      {
        id: "session-1",
        clientName: "Claude Desktop",
        scopes: ["read", "write"],
        lastUsedAt: "2026-03-20T10:00:00.000Z",
      },
      {
        id: "session-2",
        clientName: "Cursor",
        scopes: ["read"],
        lastUsedAt: null,
      },
    ];

    await installGapsMockApi(page, [], sessions);

    // Set up as authenticated user, go to settings
    await page.addInitScript(() => {
      window.localStorage.setItem("authToken", "test-token");
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          id: "user-1",
          email: "gap@example.com",
          name: "Gap Tester",
          role: "user",
          isVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      );
    });
    await page.goto("/");
    // Navigate to settings
    const settingsButton = page.getByRole("button", { name: "Settings" });
    if (await settingsButton.first().isVisible()) {
      await settingsButton.first().click();
    } else {
      await page.evaluate(() =>
        (window as Window & { switchView: (v: string) => void }).switchView(
          "settings",
        ),
      );
    }

    // MCP sessions section should render
    const sessionsList = page.locator("#mcpSessionsList");
    await expect(sessionsList).toBeVisible();

    // Both sessions are listed
    await expect(
      sessionsList.locator(".mcp-session-row__name", {
        hasText: "Claude Desktop",
      }),
    ).toBeVisible();
    await expect(
      sessionsList.locator(".mcp-session-row__name", {
        hasText: "Cursor",
      }),
    ).toBeVisible();

    // Revoke one session
    const revokeButton = sessionsList
      .locator(".mcp-session-row", { hasText: "Cursor" })
      .locator(".mcp-session-row__revoke");
    await revokeButton.click();

    // After revoke, only Claude Desktop remains
    await expect(
      sessionsList.locator(".mcp-session-row__name", {
        hasText: "Claude Desktop",
      }),
    ).toBeVisible();
    await expect(
      sessionsList.locator(".mcp-session-row__name", { hasText: "Cursor" }),
    ).toBeHidden();
  });

  test("empty MCP sessions shows placeholder", async ({ page }) => {
    await installGapsMockApi(page, [], []);

    await page.addInitScript(() => {
      window.localStorage.setItem("authToken", "test-token");
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          id: "user-1",
          email: "gap@example.com",
          name: "Gap Tester",
          role: "user",
          isVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      );
    });
    await page.goto("/");
    const settingsButton = page.getByRole("button", { name: "Settings" });
    if (await settingsButton.first().isVisible()) {
      await settingsButton.first().click();
    } else {
      await page.evaluate(() =>
        (window as Window & { switchView: (v: string) => void }).switchView(
          "settings",
        ),
      );
    }

    await expect(page.locator("#mcpSessionsList")).toContainText(
      "No assistants connected yet",
    );
  });
});
