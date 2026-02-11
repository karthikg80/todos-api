import { expect, test, type Page, type Route } from "@playwright/test";

type CriticMockState = {
  critiqueCalls: Array<Record<string, unknown>>;
  suggestionStatusPayloads: Array<{
    suggestionId: string;
    body: Record<string, unknown>;
  }>;
};

async function installCriticMockApi(page: Page): Promise<CriticMockState> {
  const state: CriticMockState = {
    critiqueCalls: [],
    suggestionStatusPayloads: [],
  };

  const users = new Map<
    string,
    { id: string; email: string; password: string }
  >();
  const accessTokens = new Map<string, string>();
  let userSeq = 1;
  let tokenSeq = 1;
  let suggestionSeq = 1;

  const nowIso = () => new Date().toISOString();
  const nextUserId = () => `user-${userSeq++}`;
  const nextToken = () => `token-${tokenSeq++}`;
  const nextSuggestionId = () => `critic-suggestion-${suggestionSeq++}`;

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
        name: "Critic Tester",
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
      return json(200, []);
    }

    if (pathname === "/ai/task-critic" && method === "POST") {
      const body = (await parseBody(route)) as Record<string, unknown>;
      state.critiqueCalls.push(body);
      const suffix = suggestionSeq;
      return json(200, {
        suggestionId: nextSuggestionId(),
        qualityScore: 82,
        improvedTitle: `Sharper title ${suffix}`,
        improvedDescription: `Sharper description ${suffix}`,
        suggestions: ["Use a clearer verb", "Add expected outcome"],
      });
    }

    if (
      pathname.startsWith("/ai/suggestions/") &&
      pathname.endsWith("/status") &&
      method === "PUT"
    ) {
      const suggestionId = pathname.split("/")[3] || "";
      const body = (await parseBody(route)) as Record<string, unknown>;
      state.suggestionStatusPayloads.push({ suggestionId, body });
      return json(200, { ok: true });
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

  return state;
}

async function registerAndOpenTodos(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator("#registerName").fill("Critic User");
  await page.locator("#registerEmail").fill("critic@example.com");
  await page.locator("#registerPassword").fill("Password123!");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("#todosView")).toHaveClass(/active/);
}

test.describe("Task Critic feature flag", () => {
  test("flag off uses legacy critic layout", async ({ page }) => {
    await installCriticMockApi(page);
    await registerAndOpenTodos(page);

    await page.locator("#todoInput").fill("Legacy critic title");
    await page.getByRole("button", { name: "Critique Draft (AI)" }).click();

    await expect(page.locator("#aiCritiquePanel")).toContainText(
      "Suggested title:",
    );
    await expect(page.locator(".critic-panel-enhanced")).toHaveCount(0);
  });

  test("flag on uses enhanced critic layout and reuses apply/dismiss behavior", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("feature.enhancedTaskCritic", "1");
    });
    const state = await installCriticMockApi(page);
    await registerAndOpenTodos(page);

    await page.locator("#todoInput").fill("Needs critique");
    await page.getByRole("button", { name: "Critique Draft (AI)" }).click();

    await expect(page.locator(".critic-panel-enhanced")).toBeVisible();
    await expect(page.locator(".critic-panel-title")).toContainText(
      "Task Critic",
    );
    await expect(page.locator(".critic-future-insights")).toHaveCount(1);
    await expect(page.locator(".critic-future-insights")).not.toHaveAttribute(
      "open",
      "",
    );

    await page.getByRole("button", { name: "Apply Suggestion" }).click();
    await expect(page.locator("#aiCritiquePanel")).toBeHidden();
    await expect(page.locator("#todoInput")).toHaveValue("Sharper title 1");

    await page.getByRole("button", { name: "Critique Draft (AI)" }).click();
    await expect(page.locator(".critic-panel-enhanced")).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.locator("#aiCritiquePanel")).toBeHidden();

    expect(state.suggestionStatusPayloads).toHaveLength(2);
    expect(state.suggestionStatusPayloads[0]).toMatchObject({
      suggestionId: "critic-suggestion-1",
      body: { status: "accepted" },
    });
    expect(state.suggestionStatusPayloads[1]).toMatchObject({
      suggestionId: "critic-suggestion-2",
      body: { status: "rejected" },
    });
  });
});
