import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./services/prismaTodoService";
import { AuthService } from "./services/authService";
import { prisma } from "./prismaClient";

describe("Adaptation API Integration", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;
  let userId: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-adaptation-tests";
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    app = createApp({ todoService, authService });
  });

  beforeEach(async () => {
    await prisma.userAdaptationProfile.deleteMany();
    await prisma.activityEvent.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    const registerResponse = await request(app).post("/auth/register").send({
      email: "adaptation-test@example.com",
      password: "password123",
      name: "Adaptation Tester",
    });

    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;
  });

  describe("GET /adaptation/profile", () => {
    it("returns profile for new user with low confidence", async () => {
      const response = await request(app)
        .get("/adaptation/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // New user has minimal data → low confidence, low eligibility
      expect(["none", "light"]).toContain(response.body.eligibility);
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence).toBeLessThan(0.5);
      expect(response.body.structureAppetite).toBeDefined();
      expect(response.body.insightAffinity).toBeDefined();
      expect(response.body.dateDiscipline).toBeDefined();
      expect(response.body.organizationStyle).toBeDefined();
      expect(response.body.guidanceNeed).toBeDefined();
      expect(response.body.profileVersion).toBe(1);
      expect(response.body.policyVersion).toBe(1);
      expect(response.body.signalsWindowDays).toBe(60);
    });

    it("returns stored profile after computation", async () => {
      // First call computes and stores
      const first = await request(app)
        .get("/adaptation/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(first.body.eligibility).toBeDefined();

      // Second call returns stored profile
      const second = await request(app)
        .get("/adaptation/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(second.body.eligibility).toBe(first.body.eligibility);
      expect(second.body.confidence).toBe(first.body.confidence);
    });

    it("returns 401 without auth token", async () => {
      await request(app).get("/adaptation/profile").expect(401);
    });
  });

  describe("POST /adaptation/profile/compute", () => {
    it("forces recomputation and returns updated profile", async () => {
      // Get initial profile
      const initial = await request(app)
        .get("/adaptation/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Force recompute
      const response = await request(app)
        .post("/adaptation/profile/compute")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.eligibility).toBeDefined();
      expect(response.body.confidence).toBeDefined();
      expect(response.body.lastUpdatedAt).toBeDefined();
    });

    it("returns 401 without auth token", async () => {
      await request(app).post("/adaptation/profile/compute").expect(401);
    });
  });

  describe("GET /adaptation/flags", () => {
    it("returns feature flag state", async () => {
      const response = await request(app)
        .get("/adaptation/flags")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("enabled");
      expect(response.body).toHaveProperty("insightsPersonalization");
      expect(response.body).toHaveProperty("guidancePersonalization");
      expect(response.body).toHaveProperty("rolloutPercentage");
    });
  });

  describe("profile with activity data", () => {
    it("computes profile and stores it for subsequent retrieval", async () => {
      // Force computation
      const computeResponse = await request(app)
        .post("/adaptation/profile/compute")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(computeResponse.body.confidence).toBeDefined();
      expect(computeResponse.body.eligibility).toBeDefined();

      // Verify it was stored by retrieving again
      const getResponse = await request(app)
        .get("/adaptation/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.confidence).toBe(computeResponse.body.confidence);
      expect(getResponse.body.eligibility).toBe(
        computeResponse.body.eligibility,
      );
    });
  });

  describe("GET /adaptation/projects/:projectId/soft-inference", () => {
    it("returns 401 without auth token", async () => {
      await request(app)
        .get("/adaptation/projects/some-id/soft-inference")
        .expect(401);
    });

    it("returns 404 for non-existent project", async () => {
      const response = await request(app)
        .get(
          "/adaptation/projects/00000000-0000-0000-0000-000000000001/soft-inference",
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe("Project not found");
    });
  });
});
