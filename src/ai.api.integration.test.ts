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
      .send({ status: "accepted" })
      .expect(200);

    expect(updateResponse.body.status).toBe("accepted");

    const persisted = await prisma.aiSuggestion.findUnique({
      where: { id: suggestionId },
    });
    expect(persisted).toBeTruthy();
    expect(persisted?.status).toBe("accepted");
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
      .expect(200);

    expect(applyResponse.body.createdCount).toBe(3);
    expect(applyResponse.body.suggestion.status).toBe("accepted");
    expect(applyResponse.body.todos).toHaveLength(3);

    const me = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    const dbTodos = await prisma.todo.findMany({
      where: { userId: me.body.id, category: "AI Plan" },
    });
    expect(dbTodos).toHaveLength(3);

    await request(app)
      .post(`/ai/suggestions/${suggestionId}/apply`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(409);
  });
});
