import { expect, test, type Page, type Route } from "@playwright/test";

type TodoSeed = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
};

async function installIcsMockApi(page: Page, todosSeed: TodoSeed[]) {
  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  let userSeq = 1;
  let tokenSeq = 1;

  const nowIso = () => new Date().toISOString();
  const nextUserId = () => `user-${userSeq++}`;
  const nextToken = () => `token-${tokenSeq++}`;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return {};
    return JSON.parse(raw);
  };

  const authUserId = (route: Route) => {
    const authHeader = route.request().headers()["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    return accessTokens.get(token) || null;
  };

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
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
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const existing = users.get(email);
      if (existing) return json(409, { error: "Email already registered" });
      const id = nextUserId();
      users.set(email, { id, email, password });
      const token = nextToken();
      const refreshToken = nextToken();
      accessTokens.set(token, id);
      return json(201, {
        user: { id, email, name: body.name || null },
        token,
        refreshToken,
      });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = authUserId(route);
      if (!userId) return json(401, { error: "Unauthorized" });
      const user = Array.from(users.values()).find(
        (item) => item.id === userId,
      );
      if (!user) return json(404, { error: "User not found" });
      return json(200, {
        id: user.id,
        email: user.email,
        name: "ICS Tester",
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

    if (pathname === "/ai/suggestions" && method === "GET") {
      return json(200, []);
    }

    if (pathname === "/ai/usage" && method === "GET") {
      return json(200, {
        plan: "free",
        used: 1,
        limit: 10,
        remaining: 9,
        resetAt: nowIso(),
      });
    }

    if (pathname === "/ai/insights" && method === "GET") {
      return json(200, {
        generatedCount: 1,
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

    if (pathname === "/auth/logout" && method === "POST") {
      return json(200, { ok: true });
    }

    return route.continue();
  });
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("ICS User");
  await page.locator("#registerEmail").fill("ics@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

async function openMoreFilters(page: Page) {
  const toggle = page.locator("#moreFiltersToggle");
  await toggle.click();
  const panel = page.locator("#moreFiltersPanel");
  if (!(await panel.isVisible())) {
    await page.evaluate(() => {
      document
        .getElementById("moreFiltersPanel")
        ?.classList.add("more-filters--open");
    });
  }
  await expect(panel).toBeVisible();
}

test.describe("ICS export", () => {
  test("export button is disabled when visible list has no due dates", async ({
    page,
  }) => {
    await installIcsMockApi(page, [
      {
        id: "todo-no-due-1",
        title: "No due A",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "medium",
      },
      {
        id: "todo-with-due",
        title: "Has due",
        description: null,
        notes: null,
        category: "Home",
        dueDate: "2026-03-15T12:00:00.000Z",
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page);
    await openMoreFilters(page);
    await page.getByRole("button", { name: "Someday" }).click();
    await expect(page.locator("#exportIcsButton")).toBeDisabled();
  });

  test("exports ICS for currently visible filtered due-dated todos", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const capture = {
        downloads: [] as Array<{ download: string; href: string }>,
        contents: [] as string[],
      };

      (
        window as typeof window & { __icsCapture: typeof capture }
      ).__icsCapture = capture;

      URL.createObjectURL = (blob: Blob) => {
        blob.text().then((content) => {
          capture.contents.push(content);
        });
        return `blob:ics-${capture.contents.length + 1}`;
      };

      URL.revokeObjectURL = () => {};

      HTMLAnchorElement.prototype.click = function () {
        capture.downloads.push({
          download: this.download,
          href: this.href,
        });
      };
    });

    await installIcsMockApi(page, [
      {
        id: "todo-work-due",
        title: "Work planning",
        description: "Scope and prep",
        notes: "Include checklist",
        category: "Work",
        dueDate: "2026-03-15T12:00:00.000Z",
        priority: "medium",
      },
      {
        id: "todo-work-no-due",
        title: "Work backlog",
        description: null,
        notes: null,
        category: "Work",
        dueDate: null,
        priority: "low",
      },
      {
        id: "todo-home-due",
        title: "Home cleanup",
        description: "Weekend tasks",
        notes: null,
        category: "Home",
        dueDate: "2026-03-20T12:00:00.000Z",
        priority: "high",
      },
    ]);

    await registerAndOpenTodos(page);

    await page.locator("#categoryFilter").selectOption("Work");
    await openMoreFilters(page);
    await expect(page.locator("#exportIcsButton")).toBeEnabled();

    await page.locator("#exportIcsButton").click();

    await page.waitForFunction(() => {
      const capture = (
        window as typeof window & { __icsCapture?: { contents: string[] } }
      ).__icsCapture;
      return !!capture && capture.contents.length > 0;
    });

    const capture = await page.evaluate(() => {
      return (
        window as typeof window & {
          __icsCapture: {
            downloads: Array<{ download: string; href: string }>;
            contents: string[];
          };
        }
      ).__icsCapture;
    });

    expect(capture.downloads).toHaveLength(1);
    expect(capture.downloads[0].download).toMatch(
      /^todos-\d{4}-\d{2}-\d{2}\.ics$/,
    );

    const content = capture.contents[0];
    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("BEGIN:VEVENT");
    expect(content).toContain("SUMMARY:Work planning");
    expect(content).toContain("DTSTART;VALUE=DATE:20260315");
    expect(content).not.toContain("SUMMARY:Home cleanup");
  });
});
