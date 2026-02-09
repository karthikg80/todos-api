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
  });
});
