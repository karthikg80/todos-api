import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./services/prismaTodoService";
import { AuthService } from "./services/authService";
import { prisma } from "./prismaClient";

describe("Events & Insights API Integration", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-events-insights-tests";
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    app = createApp({ todoService, authService });
  });

  beforeEach(async () => {
    await prisma.userInsight.deleteMany();
    await prisma.activityEvent.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.user.deleteMany();

    const registerResponse = await request(app).post("/auth/register").send({
      email: "events-test@example.com",
      password: "password123",
      name: "Events Tester",
    });

    authToken = registerResponse.body.token;
  });

  describe("POST /events/batch", () => {
    it("records a batch of events and returns count", async () => {
      const response = await request(app)
        .post("/events/batch")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          events: [
            { eventType: "session_start" },
            {
              eventType: "task_created",
              entityType: "todo",
              entityId: "test-1",
            },
          ],
        })
        .expect(200);

      expect(response.body.recorded).toBe(2);
    });

    it("returns 400 for missing events array", async () => {
      await request(app)
        .post("/events/batch")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it("returns 400 for batch exceeding 50 events", async () => {
      const events = Array.from({ length: 51 }, (_, i) => ({
        eventType: "task_created",
        entityId: `todo-${i}`,
      }));

      await request(app)
        .post("/events/batch")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ events })
        .expect(400);
    });

    it("returns 200 for empty events array", async () => {
      const response = await request(app)
        .post("/events/batch")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ events: [] })
        .expect(200);

      expect(response.body.recorded).toBe(0);
    });

    it("requires authentication", async () => {
      await request(app)
        .post("/events/batch")
        .send({ events: [{ eventType: "session_start" }] })
        .expect(401);
    });
  });

  describe("GET /insights", () => {
    it("returns empty array when no insights computed", async () => {
      const response = await request(app)
        .get("/insights")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it("requires authentication", async () => {
      await request(app).get("/insights").expect(401);
    });
  });

  describe("POST /insights/compute", () => {
    it("triggers computation and returns ok", async () => {
      const response = await request(app)
        .post("/insights/compute")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
    });

    it("populates insights after computation", async () => {
      await request(app)
        .post("/insights/compute")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const response = await request(app)
        .get("/insights")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Should have at least completion_velocity and stale_task_count
      expect(response.body.length).toBeGreaterThan(0);
      const types = response.body.map(
        (i: { insightType: string }) => i.insightType,
      );
      expect(types).toContain("completion_velocity");
    });

    it("requires authentication", async () => {
      await request(app).post("/insights/compute").expect(401);
    });
  });

  describe("GET /insights/trend/:type", () => {
    it("returns trend data for a valid type", async () => {
      // Compute first
      await request(app)
        .post("/insights/compute")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const response = await request(app)
        .get("/insights/trend/completion_velocity?periods=3")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("returns 400 for invalid insight type", async () => {
      await request(app)
        .get("/insights/trend/bogus_type")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe("GET /insights/project-health", () => {
    it("returns project health scores", async () => {
      const response = await request(app)
        .get("/insights/project-health")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
