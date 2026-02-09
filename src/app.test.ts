import request from "supertest";
import { createApp } from "./app";
import { TodoService } from "./todoService";
import type { Express } from "express";

describe("Todos API", () => {
  let app: Express;
  let todoService: TodoService;

  beforeEach(() => {
    todoService = new TodoService();
    app = createApp(todoService);
  });

  describe("POST /todos", () => {
    it("should create a new todo", async () => {
      const response = await request(app)
        .post("/todos")
        .send({ title: "Test Todo", description: "Test description" })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe("Test Todo");
      expect(response.body.description).toBe("Test description");
      expect(response.body.completed).toBe(false);
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });

    it("should create todo without description", async () => {
      const response = await request(app)
        .post("/todos")
        .send({ title: "Test Todo" })
        .expect(201);

      expect(response.body.title).toBe("Test Todo");
      expect(response.body.description).toBeUndefined();
    });

    it("should return 400 for missing title", async () => {
      const response = await request(app).post("/todos").send({}).expect(400);

      expect(response.body.error).toContain("Title is required");
    });

    it("should return 400 for empty title", async () => {
      const response = await request(app)
        .post("/todos")
        .send({ title: "   " })
        .expect(400);

      expect(response.body.error).toContain("Title cannot be empty");
    });

    it("should return 400 for title exceeding max length", async () => {
      const longTitle = "a".repeat(201);
      const response = await request(app)
        .post("/todos")
        .send({ title: longTitle })
        .expect(400);

      expect(response.body.error).toContain(
        "Title cannot exceed 200 characters",
      );
    });

    it("should return 400 for non-string title", async () => {
      const response = await request(app)
        .post("/todos")
        .send({ title: 123 })
        .expect(400);

      expect(response.body.error).toContain("must be a string");
    });

    it("should return 400 for invalid description", async () => {
      const response = await request(app)
        .post("/todos")
        .send({ title: "Test", description: 123 })
        .expect(400);

      expect(response.body.error).toContain("Description must be a string");
    });
  });

  describe("GET /todos", () => {
    it("should return empty array when no todos", async () => {
      const response = await request(app).get("/todos").expect(200);

      expect(response.body).toEqual([]);
    });

    it("should return all todos", async () => {
      await request(app).post("/todos").send({ title: "Todo 1" });
      await request(app).post("/todos").send({ title: "Todo 2" });
      await request(app).post("/todos").send({ title: "Todo 3" });

      const response = await request(app).get("/todos").expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0].title).toBe("Todo 1");
      expect(response.body[1].title).toBe("Todo 2");
      expect(response.body[2].title).toBe("Todo 3");
    });
  });

  describe("GET /todos/:id", () => {
    it("should return todo by ID", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Test Todo" });

      const id = createResponse.body.id;

      const response = await request(app).get(`/todos/${id}`).expect(200);

      expect(response.body.id).toBe(id);
      expect(response.body.title).toBe("Test Todo");
    });

    it("should return 404 for non-existent UUID", async () => {
      const response = await request(app)
        .get("/todos/00000000-0000-1000-8000-000000000000")
        .expect(404);

      expect(response.body.error).toBe("Todo not found");
    });

    it("should return 400 for invalid ID format", async () => {
      const response = await request(app)
        .get("/todos/non-existent-id")
        .expect(400);

      expect(response.body.error).toContain("Invalid ID format");
    });
  });

  describe("PUT /todos/:id", () => {
    it("should update todo title", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Original Title" });

      const id = createResponse.body.id;

      const response = await request(app)
        .put(`/todos/${id}`)
        .send({ title: "Updated Title" })
        .expect(200);

      expect(response.body.title).toBe("Updated Title");
      expect(response.body.id).toBe(id);
    });

    it("should update todo description", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Test", description: "Original" });

      const id = createResponse.body.id;

      const response = await request(app)
        .put(`/todos/${id}`)
        .send({ description: "Updated" })
        .expect(200);

      expect(response.body.description).toBe("Updated");
      expect(response.body.title).toBe("Test");
    });

    it("should update todo completed status", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Test" });

      const id = createResponse.body.id;

      const response = await request(app)
        .put(`/todos/${id}`)
        .send({ completed: true })
        .expect(200);

      expect(response.body.completed).toBe(true);
    });

    it("should update multiple fields", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Original" });

      const id = createResponse.body.id;

      const response = await request(app)
        .put(`/todos/${id}`)
        .send({
          title: "Updated",
          description: "New description",
          completed: true,
        })
        .expect(200);

      expect(response.body.title).toBe("Updated");
      expect(response.body.description).toBe("New description");
      expect(response.body.completed).toBe(true);
    });

    it("should return 404 for non-existent UUID", async () => {
      const response = await request(app)
        .put("/todos/00000000-0000-1000-8000-000000000000")
        .send({ title: "Updated" })
        .expect(404);

      expect(response.body.error).toBe("Todo not found");
    });

    it("should return 400 for invalid ID format", async () => {
      const response = await request(app)
        .put("/todos/non-existent-id")
        .send({ title: "Updated" })
        .expect(400);

      expect(response.body.error).toContain("Invalid ID format");
    });

    it("should return 400 for empty update", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Test" });

      const id = createResponse.body.id;

      const response = await request(app)
        .put(`/todos/${id}`)
        .send({})
        .expect(400);

      expect(response.body.error).toContain(
        "At least one field must be provided",
      );
    });

    it("should return 400 for invalid title", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Test" });

      const id = createResponse.body.id;

      const response = await request(app)
        .put(`/todos/${id}`)
        .send({ title: "   " })
        .expect(400);

      expect(response.body.error).toContain("Title cannot be empty");
    });

    it("should return 400 for invalid completed value", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Test" });

      const id = createResponse.body.id;

      const response = await request(app)
        .put(`/todos/${id}`)
        .send({ completed: "true" })
        .expect(400);

      expect(response.body.error).toContain("Completed must be a boolean");
    });
  });

  describe("DELETE /todos/:id", () => {
    it("should delete todo", async () => {
      const createResponse = await request(app)
        .post("/todos")
        .send({ title: "Test" });

      const id = createResponse.body.id;

      await request(app).delete(`/todos/${id}`).expect(204);

      await request(app).get(`/todos/${id}`).expect(404);
    });

    it("should return 404 for non-existent UUID", async () => {
      const response = await request(app)
        .delete("/todos/00000000-0000-1000-8000-000000000000")
        .expect(404);

      expect(response.body.error).toBe("Todo not found");
    });

    it("should return 400 for invalid ID format", async () => {
      const response = await request(app)
        .delete("/todos/non-existent-id")
        .expect(400);

      expect(response.body.error).toContain("Invalid ID format");
    });

    it("should remove todo from list", async () => {
      const createResponse1 = await request(app)
        .post("/todos")
        .send({ title: "Todo 1" });

      await request(app).post("/todos").send({ title: "Todo 2" });

      await request(app)
        .delete(`/todos/${createResponse1.body.id}`)
        .expect(204);

      const response = await request(app).get("/todos").expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe("Todo 2");
    });
  });

  describe("Auth email normalization", () => {
    it("should normalize email for /auth/resend-verification", async () => {
      const mockAuthService = {
        getUserByEmail: jest.fn().mockResolvedValue({
          id: "user-1",
          isVerified: false,
        }),
        sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      } as any;

      const authApp = createApp(new TodoService(), mockAuthService);

      await request(authApp)
        .post("/auth/resend-verification")
        .send({ email: "  MiXeD@Example.COM  " })
        .expect(200);

      expect(mockAuthService.getUserByEmail).toHaveBeenCalledWith(
        "mixed@example.com",
      );
    });

    it("should normalize email for /auth/forgot-password", async () => {
      const mockAuthService = {
        requestPasswordReset: jest.fn().mockResolvedValue(undefined),
      } as any;

      const authApp = createApp(new TodoService(), mockAuthService);

      await request(authApp)
        .post("/auth/forgot-password")
        .send({ email: "  MiXeD@Example.COM  " })
        .expect(200);

      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith(
        "mixed@example.com",
      );
    });
  });
});
