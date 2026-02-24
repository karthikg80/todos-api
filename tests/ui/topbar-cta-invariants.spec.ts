import { expect, test, type Page, type Route } from "@playwright/test";
import { registerAndOpenTodosView } from "./helpers/todos-view";

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

async function installTopbarInvariantMockApi(
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
        name: "Topbar Invariants User",
        role: "user",
        isVerified: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    if (pathname === "/projects" && method === "GET")
      return json(route, 200, []);
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

test.describe("Topbar CTA invariants", () => {
  test("rail expanded keeps CTAs visible and controls consistent", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Desktop-only topbar invariant check");

    const longProject =
      "Project-With-A-Very-Long-Name-To-Verify-Topbar-Truncation-Without-CTA-Clipping-123456";
    await installTopbarInvariantMockApi(page, [
      {
        id: "todo-long",
        title:
          "Very long todo title to keep topbar and list density stressed while CTA visibility is asserted",
        description: "Long text",
        notes: null,
        category: longProject,
        dueDate: null,
        priority: "high",
      },
    ]);

    await page.setViewportSize({ width: 1280, height: 880 });
    await page.addInitScript(() => {
      window.localStorage.setItem("todos:ai-visible", "1");
    });
    await registerAndOpenTodosView(page, {
      name: "Topbar Invariants",
      email: "topbar-invariants@example.com",
    });

    const rail = page.locator("#projectsRail");
    if (
      await rail.evaluate((node) =>
        node.classList.contains("projects-rail--collapsed"),
      )
    ) {
      await page.locator("#projectsRailToggle").click();
      await expect(rail).not.toHaveClass(/projects-rail--collapsed/);
    }

    const addButton = page.locator(".todos-top-bar .top-add-btn");
    const searchInput = page.locator("#searchInput");
    await expect(addButton).toBeVisible();
    await expect(searchInput).toBeVisible();

    const addBox = await addButton.boundingBox();
    const searchBox = await searchInput.boundingBox();
    const viewport = page.viewportSize();
    expect(addBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    if (addBox && searchBox) {
      const overlap =
        addBox.x < searchBox.x + searchBox.width &&
        addBox.x + addBox.width > searchBox.x &&
        addBox.y < searchBox.y + searchBox.height &&
        addBox.y + addBox.height > searchBox.y;
      expect(overlap).toBe(false);
      expect(addBox.width).toBeGreaterThan(48);
      expect(addBox.x + addBox.width).toBeLessThanOrEqual(
        (viewport?.width || 1280) - 1,
      );
    }

    await page
      .locator(
        `#projectsRail .projects-rail-item[data-project-key="${longProject}"]`,
      )
      .click();

    await page.locator("#projectsRailToggle").click();
    await expect(rail).toHaveClass(/projects-rail--collapsed/);

    const topbarLabel = page.locator("#projectsRailTopbarLabel");
    await expect(topbarLabel).toBeVisible();
    await expect(topbarLabel).toHaveAttribute(
      "title",
      `Projects: ${longProject}`,
    );
    const labelMetrics = await topbarLabel.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const lineHeight = Number.parseFloat(style.lineHeight);
      const fontSize = Number.parseFloat(style.fontSize);
      const resolvedLineHeight = Number.isFinite(lineHeight)
        ? lineHeight
        : Math.max(12, fontSize * 1.2);
      return {
        whiteSpace: style.whiteSpace,
        clientHeight: el.clientHeight,
        lineHeight: resolvedLineHeight,
      };
    });
    expect(labelMetrics.whiteSpace).toBe("nowrap");
    expect(labelMetrics.clientHeight).toBeLessThanOrEqual(
      labelMetrics.lineHeight * 1.5,
    );
    await expect(addButton).toBeVisible();

    const collapsedRailLabel = page.locator(
      `#projectsRail .projects-rail-item[data-project-key="${longProject}"] .projects-rail-item__label`,
    );
    await expect(collapsedRailLabel).toHaveAttribute("title", longProject);
    await expect(collapsedRailLabel).toHaveCSS("white-space", "nowrap");

    const searchH = await searchInput.evaluate((el) =>
      Math.round(el.getBoundingClientRect().height),
    );
    await addButton.click();
    await expect(page.locator("#taskComposerSheet")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    const quickEntryH = await page
      .locator("#todoInput")
      .evaluate((el) => Math.round(el.getBoundingClientRect().height));
    const aiToggle = page.locator("#aiWorkspaceToggle");
    if ((await aiToggle.getAttribute("aria-expanded")) !== "true") {
      await aiToggle.click();
      await expect(aiToggle).toHaveAttribute("aria-expanded", "true");
    }
    const aiGoalH = await page
      .locator("#goalInput")
      .evaluate((el) => Math.round(el.getBoundingClientRect().height));

    expect(Math.abs(searchH - quickEntryH)).toBeLessThanOrEqual(2);
    expect(Math.abs(searchH - aiGoalH)).toBeLessThanOrEqual(2);
    expect(searchH).toBeGreaterThanOrEqual(38);
  });
});
