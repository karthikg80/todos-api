import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./services/prismaTodoService";
import { AuthService } from "./services/authService";
import { prisma } from "./prismaClient";

describe("Feedback API Integration", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;
  let userId: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-feedback-api-tests";
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    app = createApp(todoService, authService);
  });

  beforeEach(async () => {
    await prisma.feedbackRequest.deleteMany();
    await prisma.captureItem.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    const registerResponse = await request(app).post("/auth/register").send({
      email: "feedback-test@example.com",
      password: "password123",
      name: "Feedback Tester",
    });

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;
  });

  it("POST /feedback creates a bug report with captured context", async () => {
    const response = await request(app)
      .post("/feedback")
      .set("Authorization", `Bearer ${authToken}`)
      .set("User-Agent", "Feedback Integration Test UA")
      .send({
        type: "bug",
        title: "Task drawer crashes on save",
        body: "What happened: Save throws an error.\nExpected: Task updates.\nRight before: Edited notes.",
        screenshotUrl: "https://example.com/screenshots/task-drawer.png",
        attachmentMetadata: {
          name: "task-drawer.png",
          type: "image/png",
          size: 48291,
          lastModified: 1710000000000,
        },
        pageUrl: "https://app.example.com/?view=todos",
        userAgent: "Feedback Integration Test UA",
        appVersion: "1.6.0",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      userId,
      type: "bug",
      title: "Task drawer crashes on save",
      screenshotUrl: "https://example.com/screenshots/task-drawer.png",
      pageUrl: "https://app.example.com/?view=todos",
      userAgent: "Feedback Integration Test UA",
      appVersion: "1.6.0",
      status: "new",
    });
    expect(response.body.attachmentMetadata).toEqual({
      name: "task-drawer.png",
      type: "image/png",
      size: 48291,
      lastModified: 1710000000000,
    });

    const persisted = await prisma.feedbackRequest.findUnique({
      where: { id: response.body.id },
    });

    expect(persisted).not.toBeNull();
    expect(persisted?.userId).toBe(userId);
    expect(persisted?.type).toBe("bug");
    expect(persisted?.status).toBe("new");
    expect(persisted?.pageUrl).toBe("https://app.example.com/?view=todos");
  });

  it("POST /feedback creates a feature request without screenshot fields", async () => {
    const response = await request(app)
      .post("/feedback")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        type: "feature",
        title: "Make weekly planning easier",
        body: "Trying to do: review next week.\nHard today: too much manual sorting.\nWould help: suggested grouping.",
      })
      .expect(201);

    expect(response.body.type).toBe("feature");
    expect(response.body.screenshotUrl).toBeNull();
    expect(response.body.attachmentMetadata).toBeNull();
  });

  it("POST /feedback returns clear validation errors", async () => {
    const response = await request(app)
      .post("/feedback")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        type: "idea",
        title: "   ",
        body: "",
      })
      .expect(400);

    expect(response.body).toEqual({
      error: 'type must be "bug", "feature", or "general"',
    });
  });

  it("POST /feedback returns 401 without auth", async () => {
    await request(app)
      .post("/feedback")
      .send({
        type: "bug",
        title: "Missing auth",
        body: "Should not work",
      })
      .expect(401);
  });
});
