import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./services/prismaTodoService";
import { AuthService } from "./services/authService";
import { prisma } from "./prismaClient";

describe("Capture API Integration", () => {
  let app: ReturnType<typeof createApp>;
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-capture-api-tests";
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    app = createApp({ todoService, authService });
  });

  beforeEach(async () => {
    await prisma.captureItem.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    const registerResponse = await request(app).post("/auth/register").send({
      email: "capture-test@example.com",
      password: "password123",
      name: "Capture Tester",
    });

    authToken = registerResponse.body.token;
  });

  it("POST /capture creates an item and returns 201", async () => {
    const response = await request(app)
      .post("/capture")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "Buy milk", source: "test" })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.text).toBe("Buy milk");
    expect(response.body.source).toBe("test");
    expect(response.body.lifecycle).toBe("new");
    expect(response.body.capturedAt).toBeDefined();
    expect(response.body.createdAt).toBeDefined();
    expect(response.body.updatedAt).toBeDefined();
  });

  it("GET /capture returns all items", async () => {
    await request(app)
      .post("/capture")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "Item 1" })
      .expect(201);

    await request(app)
      .post("/capture")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "Item 2" })
      .expect(201);

    const response = await request(app)
      .get("/capture")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
  });

  it("GET /capture?lifecycle=new returns only new items", async () => {
    const created = await request(app)
      .post("/capture")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "Item A" })
      .expect(201);

    await request(app)
      .patch(`/capture/${created.body.id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ lifecycle: "triaged" })
      .expect(200);

    await request(app)
      .post("/capture")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "Item B" })
      .expect(201);

    const response = await request(app)
      .get("/capture?lifecycle=new")
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].text).toBe("Item B");
  });

  it("GET /capture/:id returns a specific item", async () => {
    const created = await request(app)
      .post("/capture")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "Specific item" })
      .expect(201);

    const response = await request(app)
      .get(`/capture/${created.body.id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.id).toBe(created.body.id);
    expect(response.body.text).toBe("Specific item");
  });

  it("PATCH /capture/:id updates lifecycle", async () => {
    const created = await request(app)
      .post("/capture")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ text: "To triage" })
      .expect(201);

    const response = await request(app)
      .patch(`/capture/${created.body.id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ lifecycle: "triaged", triageResult: { decision: "keep" } })
      .expect(200);

    expect(response.body.lifecycle).toBe("triaged");
    expect(response.body.triageResult).toEqual({ decision: "keep" });
  });

  it("GET /capture returns 401 without auth", async () => {
    await request(app).get("/capture").expect(401);
  });
});
