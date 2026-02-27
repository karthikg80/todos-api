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

type MockOptions = {
  putDelayMs?: number;
};

function nowIso() {
  return new Date().toISOString();
}

async function installDrawerMockApi(
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
  let userSeq = 1;
  let tokenSeq = 1;

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
        name: "Drawer Mobile Tester",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
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

    if (pathname.startsWith("/todos/") && method === "PUT") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      if (options.putDelayMs && options.putDelayMs > 0) {
        await page.waitForTimeout(options.putDelayMs);
      }

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

    if (pathname.startsWith("/todos/") && method === "DELETE") {
      const userId = authUserId(route);
      if (!userId) return json(route, 401, { error: "Unauthorized" });

      const todoId = pathname.split("/")[2];
      const list = todosByUser.get(userId) || [];
      const next = list.filter((todo) => String(todo.id) !== todoId);
      todosByUser.set(userId, next);
      return route.fulfill({ status: 204, body: "" });
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
  await page.locator("#registerName").fill("Drawer Mobile User");
  await page.locator("#registerEmail").fill(email);
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await ensureAllTasksListActive(page);
}

test.describe("Todo drawer mobile polish", () => {
  test("mobile sheet locks body scroll and restores it on close", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Mobile-specific scroll lock behavior");

    const todosSeed = Array.from({ length: 20 }).map((_, index) => ({
      id: `todo-${index + 1}`,
      title: `Task ${index + 1}`,
      description: "Details",
      notes: null,
      category: index % 2 === 0 ? "Work" : "Home",
      dueDate: null,
      priority: "medium" as const,
    }));

    await installDrawerMockApi(page, todosSeed);
    await registerAndOpenTodos(page, "drawer-mobile-scroll@example.com");

    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
      window.scrollTo(0, 420);
    });

    await page.locator(".todo-item .todo-title").first().click();

    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    await expect(page.locator("body")).toHaveClass(/is-drawer-open/);
    await expect
      .poll(() => page.evaluate(() => document.body.style.position))
      .toBe("fixed");
    await expect
      .poll(() =>
        page.evaluate(() => /^-?\d+px$/.test(document.body.style.top)),
      )
      .toBe(true);

    const lockedTop = await page.evaluate(() => document.body.style.top);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator("#todoDrawerClose")).toBeVisible();
    await page.locator("#todoDrawerClose").click();

    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(page.locator("body")).not.toHaveClass(/is-drawer-open/);

    const expectedRestoreY = Math.abs(parseInt(lockedTop || "0", 10));
    await expect
      .poll(() =>
        page.evaluate(
          (expectedY) =>
            document.body.style.position === "" &&
            Math.abs(window.scrollY - expectedY) <= 4,
          expectedRestoreY,
        ),
      )
      .toBe(true);
  });

  test("details accordion state is preserved after save rerender", async ({
    page,
  }) => {
    await installDrawerMockApi(page, [
      {
        id: "todo-1",
        title: "Task one",
        description: "Description",
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
    ]);

    await registerAndOpenTodos(page, "drawer-accordion@example.com");
    await page.locator(".todo-item .todo-title").first().click();
    await expect(page.locator("#todoDetailsDrawer")).toHaveAttribute(
      "aria-hidden",
      "false",
    );

    await page.locator("#drawerDetailsToggle").click();
    await expect(page.locator("#drawerDetailsToggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await page.locator("#drawerPrioritySelect").selectOption("high");
    await expect(page.locator("#drawerSaveStatus")).toContainText("Saved");

    await expect(page.locator("#drawerDetailsToggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(page.locator("#drawerDetailsPanel")).toBeVisible();
  });

  test("save status transitions from Saving to Saved to Ready", async ({
    page,
  }) => {
    await installDrawerMockApi(
      page,
      [
        {
          id: "todo-1",
          title: "Task one",
          description: "Description",
          notes: null,
          category: "Work",
          dueDate: null,
          priority: "medium",
        },
      ],
      { putDelayMs: 150 },
    );

    await registerAndOpenTodos(page, "drawer-save-status@example.com");
    await page.locator(".todo-item .todo-title").first().click();

    await page.locator("#drawerPrioritySelect").selectOption("high");

    await expect(page.locator("#drawerSaveStatus")).toContainText("Saving...");
    await expect(page.locator("#drawerSaveStatus")).toContainText("Saved");

    await expect
      .poll(async () => {
        const text = await page.locator("#drawerSaveStatus").textContent();
        return String(text || "").trim();
      })
      .toBe("Ready");
  });
});
