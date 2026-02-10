import { PrismaTodoService } from "./prismaTodoService";
import { prisma } from "./prismaClient";

const TEST_USER_ID = "test-user-123";
const TEST_USER_ID_2 = "test-user-456";

describe("PrismaTodoService (Integration)", () => {
  let service: PrismaTodoService;

  beforeAll(() => {
    service = new PrismaTodoService(prisma);
  });

  beforeEach(async () => {
    // Clean up before each test
    await prisma.todo.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: "test@example.com",
        password: "hashed-password",
        name: "Test User",
      },
    });

    await prisma.user.create({
      data: {
        id: TEST_USER_ID_2,
        email: "test2@example.com",
        password: "hashed-password",
        name: "Test User 2",
      },
    });
  });

  describe("create", () => {
    it("should create a new todo in database", async () => {
      const dto = { title: "Test Todo", description: "Test description" };
      const todo = await service.create(TEST_USER_ID, dto);

      expect(todo.id).toBeDefined();
      expect(todo.title).toBe("Test Todo");
      expect(todo.description).toBe("Test description");
      expect(todo.completed).toBe(false);
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);

      // Verify in database
      const dbTodo = await prisma.todo.findUnique({ where: { id: todo.id } });
      expect(dbTodo).toBeDefined();
      expect(dbTodo!.title).toBe("Test Todo");
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

    it("should persist created todo across sessions", async () => {
      const created = await service.create(TEST_USER_ID, {
        title: "Persistent Todo",
      });

      // Create new service instance to simulate new session
      const newService = new PrismaTodoService(prisma);
      const found = await newService.findById(TEST_USER_ID, created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe("Persistent Todo");
    });
  });

  describe("findAll", () => {
    it("should return empty array when no todos", async () => {
      const todos = await service.findAll(TEST_USER_ID);
      expect(todos).toEqual([]);
    });

    it("should return all todos from database", async () => {
      await service.create(TEST_USER_ID, { title: "Todo 1" });
      await service.create(TEST_USER_ID, { title: "Todo 2" });
      await service.create(TEST_USER_ID, { title: "Todo 3" });

      const todos = await service.findAll(TEST_USER_ID);
      expect(todos).toHaveLength(3);

      const titles = todos.map((t) => t.title);
      expect(titles).toContain("Todo 1");
      expect(titles).toContain("Todo 2");
      expect(titles).toContain("Todo 3");
    });

    it("should return todos in ascending order by order field", async () => {
      const todo1 = await service.create(TEST_USER_ID, { title: "First" });
      const todo2 = await service.create(TEST_USER_ID, { title: "Second" });
      const todo3 = await service.create(TEST_USER_ID, { title: "Third" });

      const todos = await service.findAll(TEST_USER_ID);

      expect(todos[0].id).toBe(todo1.id); // Lowest order first
      expect(todos[1].id).toBe(todo2.id);
      expect(todos[2].id).toBe(todo3.id);
    });

    it("should filter and paginate todos", async () => {
      const first = await service.create(TEST_USER_ID, {
        title: "Alpha",
        priority: "low",
      });
      await service.create(TEST_USER_ID, { title: "Bravo", priority: "high" });
      const third = await service.create(TEST_USER_ID, {
        title: "Charlie",
        priority: "low",
      });

      await service.update(TEST_USER_ID, first.id, { completed: true });
      await service.update(TEST_USER_ID, third.id, { completed: true });

      const todos = await service.findAll(TEST_USER_ID, {
        completed: true,
        priority: "low",
        sortBy: "title",
        sortOrder: "asc",
        page: 2,
        limit: 1,
      });

      expect(todos).toHaveLength(1);
      expect(todos[0].title).toBe("Charlie");
    });
  });

  describe("findById", () => {
    it("should find todo by ID from database", async () => {
      const created = await service.create(TEST_USER_ID, {
        title: "Test Todo",
      });
      const found = await service.findById(TEST_USER_ID, created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe("Test Todo");
    });

    it("should return null for non-existent ID", async () => {
      const found = await service.findById(TEST_USER_ID, "non-existent-id");
      expect(found).toBeNull();
    });

    it("should return null for invalid UUID", async () => {
      const found = await service.findById(TEST_USER_ID, "invalid-uuid");
      expect(found).toBeNull();
    });

    it("should find todo with all fields populated", async () => {
      const created = await service.create(TEST_USER_ID, {
        title: "Full Todo",
        description: "Complete description",
      });

      const found = await service.findById(TEST_USER_ID, created.id);

      expect(found).toBeDefined();
      expect(found!.title).toBe("Full Todo");
      expect(found!.description).toBe("Complete description");
      expect(found!.completed).toBe(false);
      expect(found!.createdAt).toBeInstanceOf(Date);
      expect(found!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("update", () => {
    it("should update todo title in database", async () => {
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

      // Verify in database
      const dbTodo = await prisma.todo.findUnique({
        where: { id: created.id },
      });
      expect(dbTodo!.title).toBe("Updated Title");
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

      // Verify in database
      const dbTodo = await prisma.todo.findUnique({
        where: { id: created.id },
      });
      expect(dbTodo!.completed).toBe(true);
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

    it("should return null for invalid UUID", async () => {
      const updated = await service.update(TEST_USER_ID, "invalid-uuid", {
        title: "Test",
      });
      expect(updated).toBeNull();
    });

    it("should update the updatedAt timestamp", async () => {
      const created = await service.create(TEST_USER_ID, { title: "Test" });
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await service.update(TEST_USER_ID, created.id, {
        title: "Updated",
      });
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });

    it("should persist updates across sessions", async () => {
      const created = await service.create(TEST_USER_ID, { title: "Original" });
      await service.update(TEST_USER_ID, created.id, { title: "Updated" });

      // Create new service instance to simulate new session
      const newService = new PrismaTodoService(prisma);
      const found = await newService.findById(TEST_USER_ID, created.id);

      expect(found!.title).toBe("Updated");
    });
  });

  describe("delete", () => {
    it("should delete todo from database", async () => {
      const created = await service.create(TEST_USER_ID, { title: "Test" });
      const deleted = await service.delete(TEST_USER_ID, created.id);

      expect(deleted).toBe(true);

      // Verify deletion in database
      const dbTodo = await prisma.todo.findUnique({
        where: { id: created.id },
      });
      expect(dbTodo).toBeNull();

      // Verify through service
      const found = await service.findById(TEST_USER_ID, created.id);
      expect(found).toBeNull();
    });

    it("should return false for non-existent ID", async () => {
      const deleted = await service.delete(TEST_USER_ID, "non-existent-id");
      expect(deleted).toBe(false);
    });

    it("should return false for invalid UUID", async () => {
      const deleted = await service.delete(TEST_USER_ID, "invalid-uuid");
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

    it("should persist deletion across sessions", async () => {
      const created = await service.create(TEST_USER_ID, {
        title: "To Delete",
      });
      await service.delete(TEST_USER_ID, created.id);

      // Create new service instance to simulate new session
      const newService = new PrismaTodoService(prisma);
      const found = await newService.findById(TEST_USER_ID, created.id);

      expect(found).toBeNull();
    });
  });

  describe("clear", () => {
    it("should clear all todos from database", async () => {
      await service.create(TEST_USER_ID, { title: "Todo 1" });
      await service.create(TEST_USER_ID, { title: "Todo 2" });
      await service.create(TEST_USER_ID, { title: "Todo 3" });

      await service.clear();

      const todos = await service.findAll(TEST_USER_ID);
      expect(todos).toHaveLength(0);

      // Verify in database
      const dbCount = await prisma.todo.count();
      expect(dbCount).toBe(0);
    });

    it("should work when no todos exist", async () => {
      await expect(service.clear()).resolves.not.toThrow();

      const todos = await service.findAll(TEST_USER_ID);
      expect(todos).toHaveLength(0);
    });
  });

  describe("database constraints", () => {
    it("should enforce title max length (200 chars)", async () => {
      const longTitle = "a".repeat(201);
      await expect(
        service.create(TEST_USER_ID, { title: longTitle }),
      ).rejects.toThrow();
    });

    it("should enforce description max length (1000 chars)", async () => {
      const longDescription = "a".repeat(1001);
      await expect(
        service.create(TEST_USER_ID, {
          title: "Test",
          description: longDescription,
        }),
      ).rejects.toThrow();
    });

    it("should allow null description", async () => {
      const todo = await service.create(TEST_USER_ID, { title: "Test" });
      expect(todo.description).toBeUndefined();

      const dbTodo = await prisma.todo.findUnique({ where: { id: todo.id } });
      expect(dbTodo!.description).toBeNull();
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

      const user1Titles = user1Todos.map((t) => t.title);
      expect(user1Titles).toContain("User 1 Todo 1");
      expect(user1Titles).toContain("User 1 Todo 2");
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

    it("should cascade delete todos when user is deleted", async () => {
      await service.create(TEST_USER_ID, { title: "User 1 Todo 1" });
      await service.create(TEST_USER_ID, { title: "User 1 Todo 2" });

      const todosBeforeDelete = await service.findAll(TEST_USER_ID);
      expect(todosBeforeDelete).toHaveLength(2);

      // Delete user
      await prisma.user.delete({ where: { id: TEST_USER_ID } });

      // Verify todos are also deleted
      const dbTodos = await prisma.todo.findMany({
        where: { userId: TEST_USER_ID },
      });
      expect(dbTodos).toHaveLength(0);
    });
  });
});
