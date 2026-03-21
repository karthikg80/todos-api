import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./services/prismaTodoService";
import { AuthService } from "./services/authService";
import { prisma } from "./prismaClient";

describe("Feedback API Integration", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;
  let userId: string;
  let adminToken: string;
  let adminUserId: string;

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

    const adminRegisterResponse = await request(app)
      .post("/auth/register")
      .send({
        email: "feedback-admin@example.com",
        password: "password123",
        name: "Feedback Admin",
      });

    adminToken = adminRegisterResponse.body.token;
    adminUserId = adminRegisterResponse.body.user.id;

    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: "admin" },
    });
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

  it("GET /admin/feedback lists feedback for admins with filters", async () => {
    const older = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Drawer crashes",
        body: "Crash details",
        status: "new",
      },
    });

    const newer = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "feature",
        title: "Calendar planning",
        body: "Feature details",
        status: "triaged",
      },
    });

    const response = await request(app)
      .get("/admin/feedback")
      .set("Authorization", `Bearer ${adminToken}`)
      .query({ type: "feature", status: "triaged" })
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: newer.id,
      title: "Calendar planning",
      status: "triaged",
      type: "feature",
      user: {
        id: userId,
        email: "feedback-test@example.com",
      },
    });
    expect(response.body[0].id).not.toBe(older.id);
  });

  it("GET /admin/feedback/:id returns detail for admins", async () => {
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Filtering breaks",
        body: "Full raw submission",
        screenshotUrl: "https://example.com/bug.png",
        pageUrl: "https://app.example.com/?view=todos",
        appVersion: "1.6.0",
        userAgent: "Integration Test Browser",
        triageSummary: "Likely duplicate of filter bug",
      },
    });

    const response = await request(app)
      .get(`/admin/feedback/${feedback.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: feedback.id,
      title: "Filtering breaks",
      screenshotUrl: "https://example.com/bug.png",
      pageUrl: "https://app.example.com/?view=todos",
      appVersion: "1.6.0",
      triageSummary: "Likely duplicate of filter bug",
      user: {
        id: userId,
        email: "feedback-test@example.com",
      },
    });
  });

  it("PATCH /admin/feedback/:id updates review state and metadata", async () => {
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "feature",
        title: "Promote this",
        body: "Promotion candidate",
        status: "new",
      },
    });

    const response = await request(app)
      .patch(`/admin/feedback/${feedback.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "rejected",
        rejectionReason: "Not actionable enough yet",
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: feedback.id,
      status: "rejected",
      reviewedByUserId: adminUserId,
      rejectionReason: "Not actionable enough yet",
      reviewer: {
        id: adminUserId,
        email: "feedback-admin@example.com",
      },
    });
    expect(response.body.reviewedAt).toEqual(expect.any(String));

    const persisted = await prisma.feedbackRequest.findUnique({
      where: { id: feedback.id },
    });

    expect(persisted?.status).toBe("rejected");
    expect(persisted?.reviewedByUserId).toBe(adminUserId);
    expect(persisted?.rejectionReason).toBe("Not actionable enough yet");
    expect(persisted?.reviewedAt).not.toBeNull();
  });

  it("GET /admin/feedback returns 403 for non-admin users", async () => {
    await request(app)
      .get("/admin/feedback")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(403)
      .expect({
        error: "Forbidden: Admin access required",
      });
  });
});
