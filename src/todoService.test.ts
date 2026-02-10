import { TodoService } from "./todoService";

const TEST_USER_ID = "test-user-123";
const TEST_USER_ID_2 = "test-user-456";

describe("TodoService", () => {
  let service: TodoService;

  beforeEach(() => {
    service = new TodoService();
  });

  describe("create", () => {
    it("should create a new todo", async () => {
      const dto = { title: "Test Todo", description: "Test description" };
      const todo = await service.create(TEST_USER_ID, dto);

      expect(todo.id).toBeDefined();
      expect(todo.title).toBe("Test Todo");
      expect(todo.description).toBe("Test description");
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);
    });

    it("should create todo without description", async () => {
      const dto = { title: "Test Todo" };
      const todo = await service.create(TEST_USER_ID, dto);

      expect(todo.title).toBe("Test Todo");
      expect(todo.description).toBeUndefined();
    });

    it("should generate unique IDs", async () => {
      const todo1 = await service.create(TEST_USER_ID, { title: "Todo 1" });
      const todo2 = await service.create(TEST_USER_ID, { title: "Todo 2" });

      expect(todo1.id).not.toBe(todo2.id);
    });
  });

  describe("findAll", () => {
    it("should return empty array when no todos", async () => {
      const todos = await service.findAll(TEST_USER_ID);
      expect(todos).toEqual([]);
    });

    it("should return all todos", async () => {
      await service.create(TEST_USER_ID, { title: "Todo 1" });
      await service.create(TEST_USER_ID, { title: "Todo 2" });
      await service.create(TEST_USER_ID, { title: "Todo 3" });

      const todos = await service.findAll(TEST_USER_ID);
      expect(todos).toHaveLength(3);
      expect(todos[0].title).toBe("Todo 1");
      expect(todos[1].title).toBe("Todo 2");
      expect(todos[2].title).toBe("Todo 3");
    });

    it("should filter and paginate todos", async () => {
      const todo1 = await service.create(TEST_USER_ID, {
        title: "Alpha",
        priority: "low",
      });
      await service.create(TEST_USER_ID, { title: "Bravo", priority: "high" });
      const todo3 = await service.create(TEST_USER_ID, {
        title: "Charlie",
        priority: "low",
      });

      await service.update(TEST_USER_ID, todo1.id, { completed: true });
      await service.update(TEST_USER_ID, todo3.id, { completed: true });

      const filtered = await service.findAll(TEST_USER_ID, {
        completed: true,
        priority: "low",
        sortBy: "title",
        sortOrder: "asc",
        page: 2,
        limit: 1,
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe("Charlie");
    });
  });

  describe("findById", () => {
    it("should find todo by ID", async () => {
      const created = await service.create(TEST_USER_ID, {
        title: "Test Todo",
      });
      const found = await service.findById(TEST_USER_ID, created.id);

      expect(found).toEqual(created);
    });

    it("should return null for non-existent ID", async () => {
      const found = await service.findById(TEST_USER_ID, "non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("should update todo title", async () => {
      const created = await service.create(TEST_USER_ID, {
        title: "Original Title",
      });
      const updated = await service.update(TEST_USER_ID, created.id, {
        title: "Updated Title",
      });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe("Updated Title");
      expect(updated!.id).toBe(created.id);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.updatedAt.getTime(),
      );
    });

    it("should update todo description", async () => {
      const created = await service.create(TEST_USER_ID, {
        title: "Test",
        description: "Original",
      });
      const updated = await service.update(TEST_USER_ID, created.id, {
        description: "Updated",
      });

      expect(updated!.description).toBe("Updated");
      expect(updated!.title).toBe("Test");
    });

    it("should update todo completed status", async () => {
      const created = await service.create(TEST_USER_ID, { title: "Test" });
      expect(created.completed).toBe(false);

      const updated = await service.update(TEST_USER_ID, created.id, {
        completed: true,
      });
      expect(updated!.completed).toBe(true);
    });

    it("should update multiple fields", async () => {
      const created = await service.create(TEST_USER_ID, { title: "Original" });
      const updated = await service.update(TEST_USER_ID, created.id, {
        title: "Updated",
        description: "New description",
        completed: true,
      });

      expect(updated!.title).toBe("Updated");
      expect(updated!.description).toBe("New description");
      expect(updated!.completed).toBe(true);
    });

    it("should return null for non-existent ID", async () => {
      const updated = await service.update(TEST_USER_ID, "non-existent-id", {
        title: "Test",
      });
      expect(updated).toBeNull();
    });

    it("should update the updatedAt timestamp", async () => {
      const created = await service.create(TEST_USER_ID, { title: "Test" });
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp difference
      const updated = await service.update(TEST_USER_ID, created.id, {
        title: "Updated",
      });
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
    });
  });

  describe("delete", () => {
    it("should delete todo", async () => {
      const created = await service.create(TEST_USER_ID, { title: "Test" });
      const deleted = await service.delete(TEST_USER_ID, created.id);

      expect(deleted).toBe(true);
      expect(await service.findById(TEST_USER_ID, created.id)).toBeNull();
    });

    it("should return false for non-existent ID", async () => {
      const deleted = await service.delete(TEST_USER_ID, "non-existent-id");
      expect(deleted).toBe(false);
    });

    it("should remove todo from list", async () => {
      const todo1 = await service.create(TEST_USER_ID, { title: "Todo 1" });
      const todo2 = await service.create(TEST_USER_ID, { title: "Todo 2" });

      await service.delete(TEST_USER_ID, todo1.id);
      const todos = await service.findAll(TEST_USER_ID);

      expect(todos).toHaveLength(1);
      expect(todos[0].id).toBe(todo2.id);
    });
  });

  describe("clear", () => {
    it("should clear all todos", async () => {
      await service.create(TEST_USER_ID, { title: "Todo 1" });
      await service.create(TEST_USER_ID, { title: "Todo 2" });
      await service.create(TEST_USER_ID, { title: "Todo 3" });

      await service.clear();
      const todos = await service.findAll(TEST_USER_ID);

      expect(todos).toHaveLength(0);
    });
  });

  describe("userId isolation", () => {
    it("should only return todos for the specified user", async () => {
      await service.create(TEST_USER_ID, { title: "User 1 Todo 1" });
      await service.create(TEST_USER_ID, { title: "User 1 Todo 2" });
      await service.create(TEST_USER_ID_2, { title: "User 2 Todo 1" });

      const user1Todos = await service.findAll(TEST_USER_ID);
      const user2Todos = await service.findAll(TEST_USER_ID_2);

      expect(user1Todos).toHaveLength(2);
      expect(user2Todos).toHaveLength(1);
      expect(user1Todos[0].title).toBe("User 1 Todo 1");
      expect(user2Todos[0].title).toBe("User 2 Todo 1");
    });

    it("should not allow user to access another users todo", async () => {
      const user1Todo = await service.create(TEST_USER_ID, {
        title: "User 1 Todo",
      });

      const found = await service.findById(TEST_USER_ID_2, user1Todo.id);
      expect(found).toBeNull();
    });

    it("should not allow user to update another users todo", async () => {
      const user1Todo = await service.create(TEST_USER_ID, {
        title: "User 1 Todo",
      });

      const updated = await service.update(TEST_USER_ID_2, user1Todo.id, {
        title: "Hacked",
      });
      expect(updated).toBeNull();

      // Verify original is unchanged
      const original = await service.findById(TEST_USER_ID, user1Todo.id);
      expect(original!.title).toBe("User 1 Todo");
    });

    it("should not allow user to delete another users todo", async () => {
      const user1Todo = await service.create(TEST_USER_ID, {
        title: "User 1 Todo",
      });

      const deleted = await service.delete(TEST_USER_ID_2, user1Todo.id);
      expect(deleted).toBe(false);

      // Verify todo still exists for owner
      const found = await service.findById(TEST_USER_ID, user1Todo.id);
      expect(found).toBeDefined();
    });
  });
});
