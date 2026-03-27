import { TodoService } from "./services/todoService";

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

    it("should create a todo with the expanded task fields", async () => {
      const dueDate = new Date("2026-03-20T10:00:00.000Z");
      const scheduledDate = new Date("2026-03-18T09:00:00.000Z");
      const reviewDate = new Date("2026-03-19T08:00:00.000Z");
      const todo = await service.create(TEST_USER_ID, {
        title: "Plan trip",
        description: "Book hotel and flights",
        status: "scheduled",
        projectId: "project-1",
        category: "Travel",
        tags: ["travel", "planning"],
        context: "computer",
        energy: "medium",
        dueDate,
        scheduledDate,
        reviewDate,
        estimateMinutes: 45,
        waitingOn: "Airline sale",
        dependsOnTaskIds: ["task-a"],
        archived: false,
        recurrence: { type: "weekly", interval: 1 },
        source: "chat",
        createdByPrompt: "Plan my vacation",
        notes: "Use miles if possible",
      });

      expect(todo.status).toBe("scheduled");
      expect(todo.projectId).toBe("project-1");
      expect(todo.tags).toEqual(["travel", "planning"]);
      expect(todo.context).toBe("computer");
      expect(todo.energy).toBe("medium");
      expect(todo.dueDate).toEqual(dueDate);
      expect(todo.scheduledDate).toEqual(scheduledDate);
      expect(todo.reviewDate).toEqual(reviewDate);
      expect(todo.estimateMinutes).toBe(45);
      expect(todo.waitingOn).toBe("Airline sale");
      expect(todo.dependsOnTaskIds).toEqual(["task-a"]);
      expect(todo.recurrence).toEqual({
        type: "weekly",
        interval: 1,
        rrule: undefined,
        nextOccurrence: undefined,
      });
      expect(todo.source).toBe("chat");
      expect(todo.createdByPrompt).toBe("Plan my vacation");
      expect(todo.notes).toBe("Use miles if possible");
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

    it("should filter tasks that still need triage", async () => {
      await service.create(TEST_USER_ID, {
        title: "Captured task",
        status: "inbox",
        projectId: "project-1",
        category: "Work",
      });
      await service.create(TEST_USER_ID, {
        title: "Loose task",
      });
      await service.create(TEST_USER_ID, {
        title: "Organized task",
        status: "next",
        projectId: "project-2",
        category: "Ops",
      });

      const triageTodos = await service.findAll(TEST_USER_ID, {
        needsOrganizing: true,
      });

      expect(triageTodos.map((todo) => todo.title)).toEqual(
        expect.arrayContaining(["Captured task", "Loose task"]),
      );
      expect(triageTodos.map((todo) => todo.title)).not.toContain(
        "Organized task",
      );
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

    it("should update the expanded task fields", async () => {
      const created = await service.create(TEST_USER_ID, { title: "Original" });
      const scheduledDate = new Date("2026-03-21T09:30:00.000Z");
      const updated = await service.update(TEST_USER_ID, created.id, {
        status: "waiting",
        projectId: "project-2",
        category: "Personal",
        tags: ["home"],
        context: "phone",
        energy: "low",
        scheduledDate,
        estimateMinutes: 15,
        waitingOn: "Landlord reply",
        dependsOnTaskIds: ["dep-1", "dep-2"],
        archived: true,
        recurrence: { type: "monthly", interval: 1 },
        source: "automation",
        createdByPrompt: "Keep following up",
        notes: "Ping again if no reply",
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("waiting");
      expect(updated!.projectId).toBe("project-2");
      expect(updated!.category).toBe("Personal");
      expect(updated!.tags).toEqual(["home"]);
      expect(updated!.context).toBe("phone");
      expect(updated!.energy).toBe("low");
      expect(updated!.scheduledDate).toEqual(scheduledDate);
      expect(updated!.estimateMinutes).toBe(15);
      expect(updated!.waitingOn).toBe("Landlord reply");
      expect(updated!.dependsOnTaskIds).toEqual(["dep-1", "dep-2"]);
      expect(updated!.archived).toBe(true);
      expect(updated!.recurrence.type).toBe("monthly");
      expect(updated!.source).toBe("automation");
      expect(updated!.createdByPrompt).toBe("Keep following up");
      expect(updated!.notes).toBe("Ping again if no reply");
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

    it("should set status=done and completedAt when completing a task", async () => {
      const created = await service.create(TEST_USER_ID, {
        title: "Finish taxes",
      });

      const updated = await service.update(TEST_USER_ID, created.id, {
        completed: true,
      });

      expect(updated).not.toBeNull();
      expect(updated!.completed).toBe(true);
      expect(updated!.status).toBe("done");
      expect(updated!.completedAt).toBeInstanceOf(Date);
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
