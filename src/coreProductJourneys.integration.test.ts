import request from "supertest";
import { createApp } from "./app";
import { PrismaTodoService } from "./services/prismaTodoService";
import { AuthService } from "./services/authService";
import { PrismaProjectService } from "./services/projectService";
import { prisma } from "./prismaClient";

/**
 * End-to-end HTTP + Postgres journeys that sit above unit-tested services.
 * Focus: auth-bound behavior that differs from the unauthenticated contract tests.
 */
describe("Core product journeys (integration)", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-core-product-journeys";
    const todoService = new PrismaTodoService(prisma);
    const authService = new AuthService(prisma);
    const projectService = new PrismaProjectService(prisma);
    app = createApp({ todoService, authService, projectService });
  });

  beforeEach(async () => {
    await prisma.dayPlanTask.deleteMany();
    await prisma.dayPlan.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.project.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  async function registerAndGetToken(): Promise<string> {
    const res = await request(app)
      .post("/auth/register")
      .send({
        email: `journey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
        password: "password123",
        name: "Journey User",
      })
      .expect(201);
    return res.body.token as string;
  }

  it("reorders todos for an authenticated customer (HTTP + JWT + persistence)", async () => {
    const token = await registerAndGetToken();
    const first = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "First" })
      .expect(201);
    const second = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Second" })
      .expect(201);

    const response = await request(app)
      .put("/todos/reorder")
      .set("Authorization", `Bearer ${token}`)
      .send([
        { id: first.body.id, order: 1 },
        { id: second.body.id, order: 0 },
      ])
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0].id).toBe(second.body.id);
    expect(response.body[0].order).toBe(0);
    expect(response.body[1].id).toBe(first.body.id);
    expect(response.body[1].order).toBe(1);
  });

  it("rejects unauthenticated reorder attempts (regression guard for auth middleware)", async () => {
    const token = await registerAndGetToken();
    const created = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Lonely" })
      .expect(201);

    await request(app)
      .put("/todos/reorder")
      .send([{ id: created.body.id, order: 0 }])
      .expect(401);
  });

  it("assigns a task via explicit projectId and filters the list by projectId", async () => {
    const token = await registerAndGetToken();
    const project = await request(app)
      .post("/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Ship Q2 reliability" })
      .expect(201);

    const inProject = await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Harden integration coverage",
        projectId: project.body.id,
      })
      .expect(201);
    expect(inProject.body.projectId).toBe(project.body.id);

    await request(app)
      .post("/todos")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Unscoped inbox item" })
      .expect(201);

    const filtered = await request(app)
      .get("/todos")
      .set("Authorization", `Bearer ${token}`)
      .query({ projectId: project.body.id })
      .expect(200);

    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].id).toBe(inProject.body.id);
  });

  it("returns today's plan for an authenticated user (flagship execution surface)", async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .get("/plans/today")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.status).toBeDefined();
  });
});
