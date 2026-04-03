import { expect, test, type Page, type Route } from "@playwright/test";
import {
  openTodosViewWithStorageState,
  selectWorkspaceView,
} from "./helpers/todos-view";

type TodoSeed = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  status: "waiting" | "scheduled" | "someday";
};

function nowIso() {
  return new Date().toISOString();
}

async function installStatusViewMockApi(page: Page, todosSeed: TodoSeed[]) {
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
        name: "Status View User",
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

test.describe("Status view parity", () => {
  test.beforeEach(async ({ page }) => {
    await installStatusViewMockApi(page, [
      {
        id: "todo-waiting",
        title: "Waiting for supplier quote",
        description: null,
        notes: null,
        category: "Ops",
        dueDate: null,
        priority: "medium",
        status: "waiting",
      },
      {
        id: "todo-scheduled",
        title: "Planned design review",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "high",
        status: "scheduled",
      },
      {
        id: "todo-someday",
        title: "Someday writing idea",
        description: null,
        notes: null,
        category: "Personal",
        dueDate: null,
        priority: "low",
        status: "someday",
      },
    ]);

    await openTodosViewWithStorageState(page, {
      name: "Status View User",
      email: "status-view-user@example.com",
    });
  });

  test("sidebar surfaces pending, planned, and later lists", async ({
    page,
  }) => {
    await selectWorkspaceView(page, "waiting");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Pending");
    await expect(page.locator(".todo-item .todo-title")).toHaveText(
      "Waiting for supplier quote",
    );

    await selectWorkspaceView(page, "scheduled");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Planned");
    await expect(page.locator(".todo-item .todo-title")).toHaveText(
      "Planned design review",
    );

    await selectWorkspaceView(page, "someday");
    await expect(page.locator("#todosListHeaderTitle")).toHaveText("Later");
    await expect(page.locator(".todo-item .todo-title")).toHaveText(
      "Someday writing idea",
    );
  });
});
