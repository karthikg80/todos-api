import { expect, test, type Page, type Route } from "@playwright/test";

async function clickLogout(page: Page) {
  const profileBtn = page.locator("#dockProfileBtn");
  if (await profileBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await profileBtn.scrollIntoViewIfNeeded();
    await profileBtn.click();
    await page.getByRole("menuitem", { name: "Logout" }).click();
  } else {
    await page.getByRole("button", { name: "Logout" }).click();
  }
}

type UserRecord = {
  id: string;
  email: string;
  password: string;
  name: string | null;
  isVerified: boolean;
  role: "user" | "admin";
  createdAt: string;
  updatedAt: string;
};

async function installMockApi(page: Page) {
  const users = new Map<string, UserRecord>();
  const accessTokens = new Map<string, string>();
  const refreshTokens = new Map<string, string>();

  let userSeq = 1;
  let tokenSeq = 1;

  const now = () => new Date().toISOString();
  const mkUserId = () => `user-${userSeq++}`;
  const mkToken = (prefix: string) => `${prefix}-${tokenSeq++}`;

  const parseBody = async (route: Route) => {
    const raw = route.request().postData();
    if (!raw) return {};
    return JSON.parse(raw);
  };

  const seedUser = (overrides: Partial<UserRecord> = {}) => {
    const email = overrides.email || "returning@example.com";
    const user: UserRecord = {
      id: overrides.id || mkUserId(),
      email,
      password: overrides.password || "Password123!",
      name: overrides.name ?? "Returning User",
      isVerified: overrides.isVerified ?? true,
      role: overrides.role || "user",
      createdAt: overrides.createdAt || now(),
      updatedAt: overrides.updatedAt || now(),
    };
    users.set(email, user);
    return user;
  };

  const bearerUserId = (route: Route) => {
    const auth = route.request().headers()["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    return accessTokens.get(token) || null;
  };

  const userDto = (user: UserRecord) => ({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  const profileDto = (user: UserRecord) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    isVerified: user.isVerified,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    onboardingCompletedAt: user.createdAt,
  });

  seedUser();

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

    if (pathname === "/auth/providers" && method === "GET") {
      return json(200, { google: false, apple: false, phone: false });
    }

    if (pathname === "/auth/bootstrap-admin/status" && method === "GET") {
      return json(200, { enabled: false, reason: "already_provisioned" });
    }

    if (pathname === "/auth/login" && method === "POST") {
      const body = await parseBody(route);
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const password = String(body.password || "");
      const user = users.get(email);
      if (!user || user.password !== password) {
        return json(401, { error: "Invalid credentials" });
      }

      const token = mkToken("access");
      const refreshToken = mkToken("refresh");
      accessTokens.set(token, user.id);
      refreshTokens.set(refreshToken, user.id);
      return json(200, { user: userDto(user), token, refreshToken });
    }

    if (pathname === "/auth/logout" && method === "POST") {
      const body = await parseBody(route);
      refreshTokens.delete(String(body.refreshToken || ""));
      return json(200, { message: "Logged out successfully" });
    }

    if (pathname === "/auth/refresh" && method === "POST") {
      const body = await parseBody(route);
      const userId = refreshTokens.get(String(body.refreshToken || ""));
      if (!userId) {
        return json(401, { error: "Invalid refresh token" });
      }

      const token = mkToken("access");
      const refreshToken = mkToken("refresh");
      accessTokens.set(token, userId);
      refreshTokens.set(refreshToken, userId);
      return json(200, { token, refreshToken });
    }

    if (pathname === "/users/me" && method === "GET") {
      const userId = bearerUserId(route);
      if (!userId) {
        return json(401, { error: "Unauthorized" });
      }

      const user = Array.from(users.values()).find(
        (candidate) => candidate.id === userId,
      );
      if (!user) {
        return json(404, { error: "User not found" });
      }

      return json(200, profileDto(user));
    }

    if (pathname === "/todos" && method === "GET") {
      const userId = bearerUserId(route);
      if (!userId) {
        return json(401, { error: "Unauthorized" });
      }

      return json(200, []);
    }

    return route.continue();
  });
}

async function login(page: Page) {
  await page.locator("#loginEmail").fill("returning@example.com");
  await page.locator("#loginPassword").fill("Password123!");
  await page.getByRole("button", { name: "Login" }).click();
}

test.describe("Auth routing", () => {
  test("login from landing page redirects to /app", async ({ page }) => {
    await installMockApi(page);

    await page.goto("/");
    await page.getByRole("link", { name: "Log in" }).click();
    await page.waitForURL(
      /\/auth\?next=%2Fapp&tab=login|\/auth\?next=\/app&tab=login/,
    );

    await login(page);

    await page.waitForURL(/\/app\/?$/);
  });

  test("direct access to a protected route returns there after login", async ({
    page,
  }) => {
    await installMockApi(page);

    await page.goto("/app-classic");
    await page.waitForURL(
      /\/auth\?next=%2Fapp-classic|\/auth\?next=\/app-classic/,
    );

    await login(page);

    await page.waitForURL(/\/app-classic\/?$/);
  });

  test("logout/login flow preserves the protected route", async ({ page }) => {
    await installMockApi(page);

    await page.goto("/app-classic");
    await page.waitForURL(
      /\/auth\?next=%2Fapp-classic|\/auth\?next=\/app-classic/,
    );

    await login(page);
    await page.waitForURL(/\/app-classic\/?$/);
    await expect(page.locator("#todosView")).toHaveClass(/active/);

    await clickLogout(page);
    await page.waitForURL(
      /\/auth\?next=%2Fapp-classic|\/auth\?next=\/app-classic/,
    );

    await login(page);
    await page.waitForURL(/\/app-classic\/?$/);
  });
});
