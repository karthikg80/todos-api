import { expect, test, type Page, type Route } from "@playwright/test";
import {
  openTaskComposerSheet,
  openTodosViewWithStorageState,
} from "./helpers/todos-view";

type MockTodo = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  completed: boolean;
  order: number;
};

async function installQuickEntryMockApi(page: Page) {
  const users = new Map<string, { id: string; email: string }>();
  const tokens = new Map<string, string>();
  const todos: MockTodo[] = [];
  const createdTodoBodies: Array<Record<string, unknown>> = [];
  let userSeq = 1;
  let tokenSeq = 1;
  let todoSeq = 1;

  const nowIso = () => new Date().toISOString();

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers()["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const knownUserId = tokens.get(token);
    if (knownUserId) return knownUserId;
    if (!token) return null;
    const id = `cached-user-${userSeq++}`;
    users.set(id, { id, email: `${id}@example.com` });
    tokens.set(token, id);
    return id;
  };

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();

    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (pathname === "/auth/bootstrap-admin/status" && method === "GET") {
      return json(200, { enabled: false, reason: "already_provisioned" });
    }

    if (pathname === "/auth/register" && method === "POST") {
      const body = await parseBody(route);
      const id = `user-${userSeq++}`;
      const token = `token-${tokenSeq++}`;
      const refreshToken = `token-${tokenSeq++}`;
      const email = String(body.email || `${id}@example.com`);
      users.set(id, { id, email });
      tokens.set(token, id);
      return json(201, {
        user: {
          id,
          email,
          name: body.name || null,
        },
        token,
        refreshToken,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      const user = users.get(userId) || {
        id: userId,
        email: "quick-entry@example.com",
      };
      users.set(userId, user);
      return json(200, {
        id: user.id,
        email: user.email,
        name: "Quick Entry User",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET") {
      return json(200, []);
    }

    if (pathname === "/todos" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      return json(
        200,
        todos.map((todo) => ({
          ...todo,
          userId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          subtasks: [],
        })),
      );
    }

    if (pathname === "/todos" && method === "POST") {
      const userId = authUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      const body = await parseBody(route);
      createdTodoBodies.push(body);

      const nextTodo: MockTodo = {
        id: `todo-${todoSeq++}`,
        title: String(body.title || ""),
        description:
          typeof body.description === "string" ? body.description : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        category: typeof body.category === "string" ? body.category : null,
        dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
        priority:
          body.priority === "low" || body.priority === "high"
            ? body.priority
            : "medium",
        completed: false,
        order: todos.length,
      };
      todos.unshift(nextTodo);

      return json(201, {
        ...nextTodo,
        userId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        subtasks: [],
      });
    }

    if (pathname === "/todos/reorder" && method === "PUT") {
      return json(200, { ok: true });
    }

    if (pathname.startsWith("/todos/") && method === "PUT") {
      return json(200, { ok: true });
    }

    if (pathname === "/ai/suggestions" && method === "GET") {
      return json(200, []);
    }

    if (pathname === "/ai/usage" && method === "GET") {
      return json(200, {
        plan: "free",
        used: 0,
        limit: 10,
        remaining: 10,
        resetAt: nowIso(),
      });
    }

    if (pathname === "/ai/insights" && method === "GET") {
      return json(200, {
        generatedCount: 0,
        ratedCount: 0,
        acceptanceRate: null,
        recommendation: "",
      });
    }

    if (pathname === "/ai/feedback-summary" && method === "GET") {
      return json(200, {
        totalRated: 0,
        acceptedCount: 0,
        rejectedCount: 0,
      });
    }

    if (pathname === "/ai/suggestions/latest" && method === "GET") {
      return route.fulfill({ status: 204, body: "" });
    }

    if (pathname === "/auth/logout" && method === "POST") {
      return json(200, { ok: true });
    }

    return route.continue();
  });

  await page.exposeFunction("__getCreatedTodoBodies", () => createdTodoBodies);
}

async function openQuickEntry(page: Page) {
  await installQuickEntryMockApi(page);
  await openTodosViewWithStorageState(page, {
    name: "Quick Entry Tester",
    email: "quick-entry-tester@example.com",
  });
  await openTaskComposerSheet(page);
  await page.locator("#quickEntryPropertiesToggle").click();
  await expect(page.locator("#todoDueDateInput")).toBeVisible();
}

test.describe("Quick entry natural date input", () => {
  test.beforeEach(async ({ page }) => {
    await openQuickEntry(page);
  });

  test("typing 'tomorrow 6pm' auto-fills due date and shows detected preview", async ({
    page,
  }) => {
    await page.locator("#todoInput").fill("Test task tomorrow 6pm");

    await expect
      .poll(async () => page.locator("#todoDueDateInput").inputValue())
      .not.toBe("");

    const dueValue = await page.locator("#todoDueDateInput").inputValue();
    expect(dueValue).toMatch(/T18:00$/);

    const matchesTomorrow = await page.evaluate((value) => {
      const due = new Date(value);
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(now.getDate() + 1);
      return (
        due.getFullYear() === tomorrow.getFullYear() &&
        due.getMonth() === tomorrow.getMonth() &&
        due.getDate() === tomorrow.getDate()
      );
    }, dueValue);

    expect(matchesTomorrow).toBe(true);
    await expect(page.locator("#quickEntryNaturalDueChipRow")).toContainText(
      "Due:",
    );
  });

  test("applied natural date phrase is removed from title before create", async ({
    page,
  }) => {
    await page.locator("#todoInput").fill("Test task tomorrow 6pm");

    await expect
      .poll(async () => page.locator("#todoInput").inputValue())
      .toBe("Test task");

    await page.locator("#taskComposerAddButton").click();
    await expect(page.getByText("Test task")).toBeVisible();
    await expect(page.getByText(/tomorrow 6pm/i)).toHaveCount(0);

    const createdBodies = (await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__getCreatedTodoBodies(),
    )) as Array<Record<string, unknown>>;
    expect(createdBodies).toHaveLength(1);
    expect(createdBodies[0]?.title).toBe("Test task");
    expect(String(createdBodies[0]?.title || "")).not.toMatch(/tomorrow 6pm/i);
    expect(typeof createdBodies[0]?.dueDate).toBe("string");
  });

  test("manual due date is not overwritten by later natural language in title", async ({
    page,
  }) => {
    await page.locator("#todoDueDateInput").fill("2026-08-15T09:30");
    await page.locator("#todoInput").fill("Call John in 4 days");

    await expect
      .poll(async () => page.locator("#todoDueDateInput").inputValue())
      .toBe("2026-08-15T09:30");

    await expect(page.locator("#quickEntryNaturalDueChipRow")).toContainText(
      "Detected:",
    );
    await expect(page.locator("#quickEntryNaturalDueChipRow")).toContainText(
      "Apply",
    );
  });
});
