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
  let userEmail: string;
  let adminEmail: string;
  let testRunId = 0;
  const originalFetch = global.fetch;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-feedback-api-tests";
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    app = createApp(todoService, authService);
  });

  beforeEach(async () => {
    testRunId += 1;
    await prisma.feedbackRequest.deleteMany();
    await prisma.captureItem.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    userEmail = `feedback-test-${testRunId}@example.com`;
    const registerResponse = await request(app)
      .post("/auth/register")
      .send({
        email: userEmail,
        password: "password123",
        name: "Feedback Tester",
      })
      .expect(201);

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;

    adminEmail = `feedback-admin-${testRunId}@example.com`;
    const adminRegisterResponse = await request(app)
      .post("/auth/register")
      .send({
        email: adminEmail,
        password: "password123",
        name: "Feedback Admin",
      })
      .expect(201);

    adminToken = adminRegisterResponse.body.token;
    adminUserId = adminRegisterResponse.body.user.id;

    await prisma.user.update({
      where: { id: adminUserId },
      data: { role: "admin" },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
        email: userEmail,
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
        email: userEmail,
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
        email: adminEmail,
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

  it("POST /admin/feedback/:id/triage stores structured triage output", async () => {
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Task drawer crashes on save",
        body: [
          "What happened?",
          "The drawer crashed after pressing save.",
          "",
          "What did you expect?",
          "The task should save.",
          "",
          "What were you doing right before it happened?",
          "Editing notes in the task drawer.",
        ].join("\n"),
        status: "new",
        pageUrl: "https://app.example.com/?view=todos",
      },
    });

    const response = await request(app)
      .post(`/admin/feedback/${feedback.id}/triage`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: feedback.id,
      classification: "bug",
      normalizedTitle: "Task drawer crashes on save",
      triageSummary: expect.any(String),
      actualBehavior: "The drawer crashed after pressing save.",
      expectedBehavior: "The task should save.",
      reproSteps: [
        "Editing notes in the task drawer.",
        "The drawer crashed after pressing save.",
      ],
    });
    expect(response.body.triageConfidence).toBeGreaterThan(0.8);
    expect(response.body.agentLabels).toContain("feedback:bug");

    const persisted = await prisma.feedbackRequest.findUnique({
      where: { id: feedback.id },
    });

    expect(persisted?.classification).toBe("bug");
    expect(persisted?.normalizedTitle).toBe("Task drawer crashes on save");
    expect(persisted?.triageConfidence).toBeGreaterThan(0.8);
    expect(persisted?.expectedBehavior).toBe("The task should save.");
  });

  it("POST /admin/feedback/:id/duplicate-check stores internal duplicate suggestions", async () => {
    const existing = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Task drawer crashes on save",
        body: "Existing crash report",
        status: "triaged",
        classification: "bug",
        normalizedTitle: "Task drawer crashes on save",
        normalizedBody: "Existing crash report",
        dedupeKey: "shared-feedback-key",
      },
    });
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Task drawer crashes on save",
        body: "Fresh crash report",
        status: "new",
        classification: "bug",
        normalizedTitle: "Task drawer crashes on save",
        normalizedBody: "Fresh crash report",
        dedupeKey: "shared-feedback-key",
      },
    });

    const response = await request(app)
      .post(`/admin/feedback/${feedback.id}/duplicate-check`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: feedback.id,
      duplicateCandidate: true,
      matchedFeedbackIds: [existing.id],
      duplicateReason: "Matching dedupe key with normalized feedback",
    });

    const persisted = await prisma.feedbackRequest.findUnique({
      where: { id: feedback.id },
    });

    expect(persisted?.duplicateCandidate).toBe(true);
    expect(persisted?.duplicateReason).toBe(
      "Matching dedupe key with normalized feedback",
    );
  });

  it("PATCH /admin/feedback/:id blocks promotion when duplicate candidates are found", async () => {
    await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "feature",
        title: "Add planning bundles",
        body: "Existing feature report",
        status: "triaged",
        classification: "feature",
        normalizedTitle: "Add planning bundles",
        normalizedBody: "Existing feature report",
        dedupeKey: "shared-feature-key",
      },
    });
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "feature",
        title: "Add planning bundles",
        body: "Fresh feature report",
        status: "triaged",
        classification: "feature",
        normalizedTitle: "Add planning bundles",
        normalizedBody: "Fresh feature report",
        dedupeKey: "shared-feature-key",
      },
    });

    const response = await request(app)
      .patch(`/admin/feedback/${feedback.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "promoted",
      })
      .expect(409);

    expect(response.body.error).toBe("Duplicate candidate found");
    expect(response.body.feedbackRequest).toMatchObject({
      id: feedback.id,
      duplicateCandidate: true,
    });

    const persisted = await prisma.feedbackRequest.findUnique({
      where: { id: feedback.id },
    });

    expect(persisted?.status).toBe("triaged");
    expect(persisted?.duplicateCandidate).toBe(true);
  });

  it("PATCH /admin/feedback/:id links a confirmed duplicate instead of promoting", async () => {
    const existing = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Drawer crash",
        body: "Existing report",
        status: "triaged",
      },
    });
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Drawer crash again",
        body: "Fresh report",
        status: "new",
        duplicateCandidate: true,
      },
    });

    const response = await request(app)
      .patch(`/admin/feedback/${feedback.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "triaged",
        duplicateOfFeedbackId: existing.id,
        duplicateReason: "Confirmed duplicate of existing feedback",
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: feedback.id,
      status: "triaged",
      duplicateOfFeedbackId: existing.id,
      duplicateReason: "Confirmed duplicate of existing feedback",
      duplicateCandidate: false,
    });
  });

  it("GET /admin/feedback/:id/promotion-preview renders a canonical bug issue preview", async () => {
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Task drawer crashes",
        body: "raw input that should not be rendered directly",
        status: "triaged",
        classification: "bug",
        normalizedTitle: "Task drawer crashes on save",
        normalizedBody:
          "Saving from the task drawer crashes the current editing session.",
        impactSummary: "Users cannot save task edits from the drawer.",
        expectedBehavior: "The task should save normally.",
        actualBehavior: "The task drawer crashes and loses the draft.",
        reproStepsJson: ["Open the task drawer", "Edit notes", "Press save"],
        agentLabelsJson: ["ui"],
        pageUrl: "https://app.example.com/?view=todos",
        appVersion: "1.6.0",
        userAgent: "Integration Test Browser",
        screenshotUrl: "https://example.com/bug.png",
      },
    });

    const response = await request(app)
      .get(`/admin/feedback/${feedback.id}/promotion-preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual({
      issueType: "bug",
      title: "Task drawer crashes on save",
      body: expect.stringContaining("## Steps To Reproduce"),
      labels: ["bug", "triaged-by-agent", "ui"],
      sourceFeedbackIds: [feedback.id],
      canPromote: true,
      duplicateCandidate: false,
      duplicateReason: null,
      existingGithubIssueNumber: null,
      existingGithubIssueUrl: null,
    });
    expect(response.body.body).toContain("Source feedback IDs");
    expect(response.body.body).not.toContain(
      "raw input that should not be rendered directly",
    );
  });

  it("POST /admin/feedback/:id/promote creates a GitHub issue and stores promotion metadata", async () => {
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "feature",
        title: "Planning bundles",
        body: "raw feature request",
        status: "triaged",
        classification: "feature",
        normalizedTitle: "Add planning bundles",
        normalizedBody:
          "Users need a bundled planning flow to reduce manual setup.",
        impactSummary: "Weekly planning takes too many manual steps.",
        proposedOutcome: "Offer suggested planning bundles.",
        triageSummary: "Feature feedback from planning bundles.",
        agentLabelsJson: ["ui"],
      },
    });

    global.fetch = jest.fn(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/repos/karthikg80/todos-api/issues")) {
        expect(init?.method).toBe("POST");
        return {
          ok: true,
          json: async () => ({
            number: 512,
            html_url: "https://github.com/karthikg80/todos-api/issues/512",
          }),
        } as Response;
      }
      if (url.endsWith("/repos/karthikg80/todos-api/issues/512/labels")) {
        expect(init?.method).toBe("POST");
        return {
          ok: true,
          json: async () => [
            { name: "feature" },
            { name: "triaged-by-agent" },
            { name: "ui" },
          ],
        } as Response;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const response = await request(app)
      .post(`/admin/feedback/${feedback.id}/promote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    expect(response.body.promotion).toMatchObject({
      issueNumber: 512,
      issueUrl: "https://github.com/karthikg80/todos-api/issues/512",
      preview: {
        issueType: "feature",
        title: "Add planning bundles",
        labels: ["feature", "triaged-by-agent", "ui"],
      },
    });
    expect(response.body.feedbackRequest).toMatchObject({
      id: feedback.id,
      status: "promoted",
      githubIssueNumber: 512,
      githubIssueUrl: "https://github.com/karthikg80/todos-api/issues/512",
      reviewedByUserId: adminUserId,
    });
    expect(response.body.feedbackRequest.promotedAt).toEqual(
      expect.any(String),
    );

    const persisted = await prisma.feedbackRequest.findUnique({
      where: { id: feedback.id },
    });
    expect(persisted?.status).toBe("promoted");
    expect(persisted?.githubIssueNumber).toBe(512);
    expect(persisted?.githubIssueUrl).toBe(
      "https://github.com/karthikg80/todos-api/issues/512",
    );
    expect(persisted?.promotedAt).not.toBeNull();
  });

  it("POST /admin/feedback/:id/promote blocks issue creation when duplicate candidates are found", async () => {
    await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Drawer crash",
        body: "Existing report",
        status: "triaged",
        classification: "bug",
        normalizedTitle: "Task drawer crashes on save",
        normalizedBody: "Existing report",
        dedupeKey: "shared-promotion-key",
      },
    });
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "bug",
        title: "Drawer crash again",
        body: "Fresh report",
        status: "triaged",
        classification: "bug",
        normalizedTitle: "Task drawer crashes on save",
        normalizedBody: "Fresh report",
        dedupeKey: "shared-promotion-key",
      },
    });

    const response = await request(app)
      .post(`/admin/feedback/${feedback.id}/promote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(409);

    expect(response.body.error).toBe("Duplicate candidate found");
    expect(response.body.feedbackRequest).toMatchObject({
      id: feedback.id,
      duplicateCandidate: true,
    });
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

  it("POST /admin/feedback/:id/triage returns 403 for non-admin users", async () => {
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "feature",
        title: "Add a planning helper",
        body: "What are you trying to do?\nPlan my week.",
      },
    });

    await request(app)
      .post(`/admin/feedback/${feedback.id}/triage`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(403)
      .expect({
        error: "Forbidden: Admin access required",
      });
  });

  it("POST /admin/feedback/:id/duplicate-check returns 403 for non-admin users", async () => {
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "feature",
        title: "Add a planning helper",
        body: "What are you trying to do?\nPlan my week.",
      },
    });

    await request(app)
      .post(`/admin/feedback/${feedback.id}/duplicate-check`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(403)
      .expect({
        error: "Forbidden: Admin access required",
      });
  });

  it("POST /admin/feedback/:id/promote returns 403 for non-admin users", async () => {
    const feedback = await prisma.feedbackRequest.create({
      data: {
        userId,
        type: "feature",
        title: "Add planning helper",
        body: "What are you trying to do?\nPlan my week.",
        status: "triaged",
        classification: "feature",
        normalizedTitle: "Add planning helper",
        normalizedBody: "Users need guided planning help.",
      },
    });

    await request(app)
      .post(`/admin/feedback/${feedback.id}/promote`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({})
      .expect(403)
      .expect({
        error: "Forbidden: Admin access required",
      });
  });
});
