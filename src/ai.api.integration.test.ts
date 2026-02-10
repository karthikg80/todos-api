import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./prismaTodoService";
import { AuthService } from "./authService";
import { PrismaAiSuggestionStore } from "./aiSuggestionStore";
import { prisma } from "./prismaClient";

describe("AI API Integration", () => {
  let app: any;
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-ai-api-tests";
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    const aiSuggestionStore = new PrismaAiSuggestionStore(prisma);
    app = createApp(todoService, authService, aiSuggestionStore);
  });

  beforeEach(async () => {
    await prisma.aiSuggestion.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    const registerResponse = await request(app).post("/auth/register").send({
      email: "ai-test@example.com",
      password: "password123",
      name: "AI Tester",
    });

    authToken = registerResponse.body.token;
  });

  it("persists task critic suggestion and updates status", async () => {
    const critiqueResponse = await request(app)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        title: "Docs",
        description: "Need docs",
        priority: "medium",
      })
      .expect(200);

    expect(critiqueResponse.body.suggestionId).toBeDefined();
    expect(critiqueResponse.body.qualityScore).toBeLessThanOrEqual(100);

    const suggestionId = critiqueResponse.body.suggestionId as string;

    const listResponse = await request(app)
      .get("/ai/suggestions")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(suggestionId);
    expect(listResponse.body[0].status).toBe("pending");

    const updateResponse = await request(app)
      .put(`/ai/suggestions/${suggestionId}/status`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "accepted", reason: "Great output quality" })
      .expect(200);

    expect(updateResponse.body.status).toBe("accepted");
    expect(updateResponse.body.feedback).toEqual(
      expect.objectContaining({
        reason: "Great output quality",
        source: "manual_status_update",
      }),
    );

    const persisted = await prisma.aiSuggestion.findUnique({
      where: { id: suggestionId },
    });
    expect(persisted).toBeTruthy();
    expect(persisted?.status).toBe("accepted");
    expect((persisted?.feedback as any)?.reason).toBe("Great output quality");
  });

  it("creates plan suggestion and supports rejection status", async () => {
    const planResponse = await request(app)
      .post("/ai/plan-from-goal")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        goal: "Ship onboarding improvements",
        maxTasks: 4,
      })
      .expect(200);

    expect(planResponse.body.tasks).toHaveLength(4);
    const suggestionId = planResponse.body.suggestionId as string;
    expect(suggestionId).toBeDefined();

    const rejectResponse = await request(app)
      .put(`/ai/suggestions/${suggestionId}/status`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "rejected" })
      .expect(200);

    expect(rejectResponse.body.status).toBe("rejected");
  });

  it("applies plan suggestion and creates persisted todos", async () => {
    const planResponse = await request(app)
      .post("/ai/plan-from-goal")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        goal: "Ship AI planner",
        maxTasks: 3,
      })
      .expect(200);

    const suggestionId = planResponse.body.suggestionId as string;
    expect(suggestionId).toBeDefined();

    const applyResponse = await request(app)
      .post(`/ai/suggestions/${suggestionId}/apply`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ reason: "Plan tasks were concrete and helpful" })
      .expect(200);

    expect(applyResponse.body.createdCount).toBe(3);
    expect(applyResponse.body.suggestion.status).toBe("accepted");
    expect(applyResponse.body.suggestion.feedback).toEqual(
      expect.objectContaining({
        reason: "Plan tasks were concrete and helpful",
        source: "apply_endpoint",
      }),
    );
    expect(applyResponse.body.todos).toHaveLength(3);

    const me = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    const dbTodos = await prisma.todo.findMany({
      where: { userId: me.body.id, category: "AI Plan" },
    });
    expect(dbTodos).toHaveLength(3);

    const reapplied = await request(app)
      .post(`/ai/suggestions/${suggestionId}/apply`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);
    expect(reapplied.body.idempotent).toBe(true);

    const dbTodosAfterReapply = await prisma.todo.findMany({
      where: { userId: me.body.id, category: "AI Plan" },
    });
    expect(dbTodosAfterReapply).toHaveLength(3);
  });

  it("returns usage summary and enforces per-day quota", async () => {
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    const aiSuggestionStore = new PrismaAiSuggestionStore(prisma);
    const limitedApp = createApp(
      todoService,
      authService,
      aiSuggestionStore,
      undefined,
      1,
    );

    const register = await request(limitedApp).post("/auth/register").send({
      email: "ai-limit@example.com",
      password: "password123",
      name: "AI Limit",
    });
    const token = register.body.token as string;

    await request(limitedApp)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Quota first request" })
      .expect(200);

    const blocked = await request(limitedApp)
      .post("/ai/plan-from-goal")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "Quota second request", maxTasks: 3 })
      .expect(429);
    expect(blocked.body.error).toBe("Daily AI suggestion limit reached");

    const usage = await request(limitedApp)
      .get("/ai/usage")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(usage.body).toEqual(
      expect.objectContaining({
        plan: "free",
        used: 1,
        remaining: 0,
        limit: 1,
      }),
    );
  });

  it("uses plan-specific limits for pro users", async () => {
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    const aiSuggestionStore = new PrismaAiSuggestionStore(prisma);
    const planLimitedApp = createApp(
      todoService,
      authService,
      aiSuggestionStore,
      undefined,
      undefined,
      {
        free: 1,
        pro: 2,
        team: 3,
      },
    );

    const register = await request(planLimitedApp).post("/auth/register").send({
      email: "pro-limit@example.com",
      password: "password123",
      name: "Pro Limit",
    });
    const token = register.body.token as string;
    const userId = register.body.user.id as string;

    await prisma.user.update({
      where: { id: userId },
      data: { plan: "pro" },
    });

    await request(planLimitedApp)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "pro request 1" })
      .expect(200);

    await request(planLimitedApp)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "pro request 2" })
      .expect(200);

    await request(planLimitedApp)
      .post("/ai/plan-from-goal")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "pro request 3", maxTasks: 3 })
      .expect(429);

    const usage = await request(planLimitedApp)
      .get("/ai/usage")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(usage.body).toEqual(
      expect.objectContaining({
        plan: "pro",
        used: 2,
        remaining: 0,
        limit: 2,
      }),
    );
  });

  it("aggregates feedback reasons across accepted and rejected statuses", async () => {
    const first = await request(app)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Task 1" })
      .expect(200);
    const second = await request(app)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Task 2" })
      .expect(200);
    const third = await request(app)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Task 3" })
      .expect(200);

    await request(app)
      .put(`/ai/suggestions/${first.body.suggestionId}/status`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "accepted", reason: "Actionable" })
      .expect(200);
    await request(app)
      .put(`/ai/suggestions/${second.body.suggestionId}/status`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "rejected", reason: "Too generic" })
      .expect(200);
    await request(app)
      .put(`/ai/suggestions/${third.body.suggestionId}/status`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "rejected", reason: "Too generic" })
      .expect(200);

    const summary = await request(app)
      .get("/ai/feedback-summary?days=30&reasonLimit=5")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(summary.body).toEqual(
      expect.objectContaining({
        days: 30,
        reasonLimit: 5,
        acceptedCount: 1,
        rejectedCount: 2,
        totalRated: 3,
      }),
    );
    expect(summary.body.acceptedReasons).toEqual([
      { reason: "Actionable", count: 1 },
    ]);
    expect(summary.body.rejectedReasons).toEqual([
      { reason: "Too generic", count: 2 },
    ]);
  });

  it("validates feedback-summary query params", async () => {
    await request(app)
      .get("/ai/feedback-summary?days=0")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(400);

    await request(app)
      .get("/ai/feedback-summary?reasonLimit=200")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(400);
  });

  it("validates apply suggestion reason payload", async () => {
    const planResponse = await request(app)
      .post("/ai/plan-from-goal")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        goal: "Ship AI planner",
        maxTasks: 3,
      })
      .expect(200);

    const suggestionId = planResponse.body.suggestionId as string;
    await request(app)
      .post(`/ai/suggestions/${suggestionId}/apply`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ reason: 123 })
      .expect(400);
  });

  it("uses rejection feedback to make later outputs more specific", async () => {
    const first = await request(app)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Draft docs" })
      .expect(200);

    await request(app)
      .put(`/ai/suggestions/${first.body.suggestionId}/status`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ status: "rejected", reason: "Too generic" })
      .expect(200);

    const secondCritique = await request(app)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ title: "Write changelog notes" })
      .expect(200);
    expect(
      secondCritique.body.suggestions.some((item: string) =>
        item.includes("owner, measurable result, and deadline"),
      ),
    ).toBe(true);

    const plan = await request(app)
      .post("/ai/plan-from-goal")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ goal: "Ship release prep", maxTasks: 3 })
      .expect(200);
    expect(plan.body.summary).toContain("specific steps");
  });

  it("returns insights and upgrade recommendation when usage is near cap", async () => {
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    const aiSuggestionStore = new PrismaAiSuggestionStore(prisma);
    const limitedApp = createApp(
      todoService,
      authService,
      aiSuggestionStore,
      undefined,
      1,
    );

    const register = await request(limitedApp).post("/auth/register").send({
      email: "insights-limit@example.com",
      password: "password123",
      name: "Insights Limit",
    });
    const token = register.body.token as string;

    await request(limitedApp)
      .post("/ai/task-critic")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Only request" })
      .expect(200);

    const insights = await request(limitedApp)
      .get("/ai/insights?days=7")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(insights.body).toEqual(
      expect.objectContaining({
        periodDays: 7,
        generatedCount: 1,
        ratedCount: 0,
        acceptanceRate: null,
      }),
    );
    expect(insights.body.usageToday).toEqual(
      expect.objectContaining({
        plan: "free",
        used: 1,
        remaining: 0,
        limit: 1,
      }),
    );
    expect(insights.body.recommendation).toContain("Upgrade to Pro");
  });

  it("validates insights query params", async () => {
    await request(app)
      .get("/ai/insights?days=0")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(400);
  });
});
