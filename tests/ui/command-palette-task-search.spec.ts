import { expect, test, type Page, type Route } from "@playwright/test";
import { openTodosViewWithStorageState } from "./helpers/todos-view";

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

async function installCommandPaletteTaskSearchMockApi(
  page: Page,
  todosSeed: TodoSeed[],
) {
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
        name: "Command Task Search User",
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

async function openCommandPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.locator("#commandPaletteOverlay")).toHaveClass(
    /command-palette-overlay--open/,
  );
}

test.describe("Command palette task search", () => {
  test.beforeEach(async ({ page }) => {
    await installCommandPaletteTaskSearchMockApi(page, [
      {
        id: "todo-rent",
        title: "Pay rent",
        description: "Monthly rent payment",
        notes: null,
        category: "Home",
        dueDate: null,
        priority: "high",
      },
      {
        id: "todo-flight",
        title: "Book flights",
        description: "Travel planning",
        notes: null,
        category: "Travel",
        dueDate: null,
        priority: "medium",
      },
    ]);

    await openTodosViewWithStorageState(page, {
      name: "Task Search User",
      email: "command-task-search@example.com",
    });
  });

  test("query filters tasks by title", async ({ page }) => {
    await openCommandPalette(page);
    await page.locator("#commandPaletteInput").fill("rent");

    await expect(page.locator("#commandPaletteList")).toContainText("Pay rent");
    await expect(page.locator("#commandPaletteList")).not.toContainText(
      "Book flights",
    );
  });

  test("Enter on task result opens drawer and closes palette", async ({
    page,
  }) => {
    await openCommandPalette(page);
    await page.locator("#commandPaletteInput").fill("rent");

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page.locator("#commandPaletteOverlay")).not.toHaveClass(
      /command-palette-overlay--open/,
    );
    await expect(page.locator("#todoDetailsDrawer")).toHaveClass(
      /todo-drawer--open/,
    );
    await expect(page.locator("#drawerTitleInput")).toHaveValue("Pay rent");
  });

  test("keyboard navigation skips section headers", async ({ page }) => {
    await openCommandPalette(page);
    await page.locator("#commandPaletteInput").fill("o");

    await expect(page.locator("#commandPaletteList")).toContainText("Commands");
    await expect(page.locator("#commandPaletteList")).toContainText("Tasks");

    await expect(page.locator("#commandPaletteOption-0")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("#commandPaletteOption-0")).toContainText(
      "Go to All tasks",
    );

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("#commandPaletteOption-1")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.locator("#commandPaletteOption-3")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator("#commandPaletteOption-3")).toContainText(
      "Book flights",
    );
  });
});
