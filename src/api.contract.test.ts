import request from "supertest";
import { createApp } from "./app";
import { TodoService } from "./todoService";
import type { Express } from "express";

describe("API Contract", () => {
  let app: Express;

  beforeEach(() => {
    app = createApp(new TodoService());
  });

  describe("PUT /todos/reorder", () => {
    it("reorders todos and returns updated list", async () => {
      const first = await request(app)
        .post("/todos")
        .send({ title: "First" })
        .expect(201);
      const second = await request(app)
        .post("/todos")
        .send({ title: "Second" })
        .expect(201);

      const response = await request(app)
        .put("/todos/reorder")
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

    it("returns 400 for invalid reorder payload", async () => {
      await request(app)
        .put("/todos/reorder")
        .send({ id: "not-an-array" })
        .expect(400);
    });
  });

  describe("Subtask endpoints", () => {
    it("supports subtask create/read/update/delete lifecycle", async () => {
      const todo = await request(app)
        .post("/todos")
        .send({ title: "Parent Todo" })
        .expect(201);
      const todoId = todo.body.id;

      const createdSubtask = await request(app)
        .post(`/todos/${todoId}/subtasks`)
        .send({ title: "Subtask A" })
        .expect(201);

      const subtaskId = createdSubtask.body.id;
      expect(createdSubtask.body.title).toBe("Subtask A");

      const list = await request(app)
        .get(`/todos/${todoId}/subtasks`)
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].id).toBe(subtaskId);

      const updated = await request(app)
        .put(`/todos/${todoId}/subtasks/${subtaskId}`)
        .send({ completed: true })
        .expect(200);
      expect(updated.body.completed).toBe(true);

      await request(app)
        .delete(`/todos/${todoId}/subtasks/${subtaskId}`)
        .expect(204);

      const listAfterDelete = await request(app)
        .get(`/todos/${todoId}/subtasks`)
        .expect(200);
      expect(listAfterDelete.body).toHaveLength(0);
    });
  });

  describe("GET /api-docs.json", () => {
    it("includes live auth and todo schema fields used by API/UI", async () => {
      const response = await request(app).get("/api-docs.json").expect(200);

      const schemas = response.body?.components?.schemas;
      expect(schemas).toBeDefined();

      expect(schemas.AuthResponse.properties.refreshToken).toBeDefined();
      expect(schemas.User.properties.role).toBeDefined();
      expect(schemas.User.properties.isVerified).toBeDefined();
      expect(schemas.Todo.properties.priority).toBeDefined();
      expect(schemas.Todo.properties.category).toBeDefined();
      expect(schemas.Todo.properties.dueDate).toBeDefined();
      expect(schemas.Todo.properties.notes).toBeDefined();
      expect(schemas.Todo.properties.order).toBeDefined();
      expect(schemas.Todo.properties.subtasks).toBeDefined();
    });

    it("documents todo list query params for filtering and pagination", async () => {
      const response = await request(app).get("/api-docs.json").expect(200);

      const todoListGet = response.body?.paths?.["/todos"]?.get;
      expect(todoListGet).toBeDefined();

      const parameterNames = (todoListGet.parameters || []).map(
        (param: any) => param.name,
      );

      expect(parameterNames).toEqual(
        expect.arrayContaining([
          "completed",
          "priority",
          "category",
          "sortBy",
          "sortOrder",
          "page",
          "limit",
        ]),
      );
    });

    it("includes AI endpoints in the OpenAPI spec", async () => {
      const response = await request(app).get("/api-docs.json").expect(200);

      expect(response.body?.paths?.["/ai/task-critic"]?.post).toBeDefined();
      expect(response.body?.paths?.["/ai/plan-from-goal"]?.post).toBeDefined();
      expect(response.body?.paths?.["/ai/usage"]?.get).toBeDefined();
    });
  });

  describe("AI endpoints", () => {
    it("returns daily AI usage summary", async () => {
      const response = await request(app).get("/ai/usage").expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({
          used: expect.any(Number),
          remaining: expect.any(Number),
          limit: expect.any(Number),
          resetAt: expect.any(String),
        }),
      );
    });

    it("returns critique suggestions for vague tasks", async () => {
      const response = await request(app)
        .post("/ai/task-critic")
        .send({ title: "Docs" })
        .expect(200);

      expect(response.body.qualityScore).toBeLessThan(100);
      expect(response.body.improvedTitle).toContain("Complete");
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.suggestions.length).toBeGreaterThan(0);
      expect(response.body.suggestionId).toBeDefined();
    });

    it("validates task critic payload", async () => {
      await request(app)
        .post("/ai/task-critic")
        .send({ title: "" })
        .expect(400);
    });

    it("generates goal plan with configurable task count", async () => {
      const response = await request(app)
        .post("/ai/plan-from-goal")
        .send({
          goal: "Launch onboarding revamp",
          maxTasks: 4,
          targetDate: "2026-03-15T00:00:00.000Z",
        })
        .expect(200);

      expect(response.body.goal).toBe("Launch onboarding revamp");
      expect(response.body.tasks).toHaveLength(4);
      expect(response.body.summary).toContain("4 steps");
      expect(response.body.suggestionId).toBeDefined();
    });

    it("validates plan generator payload", async () => {
      await request(app)
        .post("/ai/plan-from-goal")
        .send({ goal: "Growth push", maxTasks: 20 })
        .expect(400);
    });

    it("lists and updates suggestion status", async () => {
      const created = await request(app)
        .post("/ai/task-critic")
        .send({ title: "Improve docs" })
        .expect(200);

      const suggestionId = created.body.suggestionId as string;
      expect(suggestionId).toBeDefined();

      const list = await request(app).get("/ai/suggestions").expect(200);
      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body[0].id).toBe(suggestionId);
      expect(list.body[0].status).toBe("pending");

      const updated = await request(app)
        .put(`/ai/suggestions/${suggestionId}/status`)
        .send({ status: "accepted" })
        .expect(200);
      expect(updated.body.status).toBe("accepted");
    });

    it("applies a pending plan suggestion and creates todos", async () => {
      const createdPlan = await request(app)
        .post("/ai/plan-from-goal")
        .send({
          goal: "Improve onboarding",
          maxTasks: 3,
        })
        .expect(200);

      const suggestionId = createdPlan.body.suggestionId as string;
      expect(suggestionId).toBeDefined();

      const applied = await request(app)
        .post(`/ai/suggestions/${suggestionId}/apply`)
        .expect(200);

      expect(applied.body.createdCount).toBe(3);
      expect(Array.isArray(applied.body.todos)).toBe(true);
      expect(applied.body.todos).toHaveLength(3);
      expect(applied.body.suggestion.status).toBe("accepted");
      expect(applied.body.todos[0].category).toBe("AI Plan");

      const todos = await request(app).get("/todos").expect(200);
      expect(todos.body).toHaveLength(3);
    });

    it("prevents applying rejected suggestions", async () => {
      const createdPlan = await request(app)
        .post("/ai/plan-from-goal")
        .send({
          goal: "Refine docs",
          maxTasks: 3,
        })
        .expect(200);
      const suggestionId = createdPlan.body.suggestionId as string;

      await request(app)
        .put(`/ai/suggestions/${suggestionId}/status`)
        .send({ status: "rejected" })
        .expect(200);

      await request(app)
        .post(`/ai/suggestions/${suggestionId}/apply`)
        .expect(409);
    });

    it("enforces daily suggestion quota", async () => {
      const limitedApp = createApp(
        new TodoService(),
        undefined,
        undefined,
        undefined,
        1,
      );

      await request(limitedApp)
        .post("/ai/task-critic")
        .send({ title: "First task" })
        .expect(200);

      const blocked = await request(limitedApp)
        .post("/ai/plan-from-goal")
        .send({ goal: "Second request", maxTasks: 3 })
        .expect(429);

      expect(blocked.body.error).toBe("Daily AI suggestion limit reached");
      expect(blocked.body.usage).toEqual(
        expect.objectContaining({
          used: 1,
          remaining: 0,
          limit: 1,
        }),
      );
    });
  });
});
