import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./services/prismaTodoService";
import { AuthService } from "./services/authService";
import { prisma } from "./prismaClient";

describe("Preferences API Integration", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-preferences-api-tests";
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    app = createApp(todoService, authService);
  });

  beforeEach(async () => {
    await prisma.userPlanningPreferences.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    const registerResponse = await request(app).post("/auth/register").send({
      email: "prefs-test@example.com",
      password: "password123",
      name: "Prefs Tester",
    });

    authToken = registerResponse.body.token;
  });

  it("GET /preferences returns defaults when none set", async () => {
    const response = await request(app)
      .get("/preferences")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.weekendsActive).toBe(true);
    expect(response.body.waitingFollowUpDays).toBe(7);
    expect(response.body.preferredContexts).toEqual([]);
    expect(response.body.maxDailyTasks).toBeNull();
    expect(response.body.preferredChunkMinutes).toBeNull();
  });

  it("PATCH /preferences updates and returns updated prefs", async () => {
    const response = await request(app)
      .patch("/preferences")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ maxDailyTasks: 5, weekendsActive: false, waitingFollowUpDays: 3 })
      .expect(200);

    expect(response.body.maxDailyTasks).toBe(5);
    expect(response.body.weekendsActive).toBe(false);
    expect(response.body.waitingFollowUpDays).toBe(3);
  });

  it("GET /preferences returns updated prefs on second call", async () => {
    await request(app)
      .patch("/preferences")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ maxDailyTasks: 10, preferredContexts: ["home", "office"] })
      .expect(200);

    const response = await request(app)
      .get("/preferences")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.maxDailyTasks).toBe(10);
    expect(response.body.preferredContexts).toEqual(["home", "office"]);
  });
});
