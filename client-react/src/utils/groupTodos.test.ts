import { describe, it, expect } from "vitest";
import { groupTodos, type GroupBy } from "./groupTodos";
import type { Todo } from "../types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    title: "Test",
    status: "next",
    completed: false,
    tags: [],
    dependsOnTaskIds: [],
    order: 0,
    archived: false,
    userId: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupTodos", () => {
  describe("none", () => {
    it("returns a single group with all todos", () => {
      const todos = [makeTodo(), makeTodo()];
      const result = groupTodos(todos, "none");
      expect(result).toHaveLength(1);
      expect(result[0].todos).toHaveLength(2);
    });
  });

  describe("project", () => {
    it("groups by projectId, labels by category", () => {
      const todos = [
        makeTodo({ projectId: "p1", category: "Work" }),
        makeTodo({ projectId: "p1", category: "Work" }),
        makeTodo({ projectId: "p2", category: "Personal" }),
      ];
      const result = groupTodos(todos, "project");
      expect(result).toHaveLength(2);
      expect(result.find((g) => g.key === "p1")!.label).toBe("Work");
      expect(result.find((g) => g.key === "p1")!.todos).toHaveLength(2);
      expect(result.find((g) => g.key === "p2")!.todos).toHaveLength(1);
    });

    it("falls back to category string when projectId is null", () => {
      const todos = [makeTodo({ projectId: null, category: "Misc" })];
      const result = groupTodos(todos, "project");
      expect(result[0].key).toBe("Misc");
    });

    it("groups tasks with no project under __none__", () => {
      const todos = [makeTodo({ projectId: null, category: null })];
      const result = groupTodos(todos, "project");
      expect(result[0].key).toBe("__none__");
      expect(result[0].label).toBe("No Project");
    });
  });

  describe("status", () => {
    it("groups in defined order, hides empty groups", () => {
      const todos = [
        makeTodo({ status: "inbox" }),
        makeTodo({ status: "next" }),
        makeTodo({ status: "next" }),
        makeTodo({ status: "waiting" }),
      ];
      const result = groupTodos(todos, "status");
      expect(result.map((g) => g.key)).toEqual(["next", "waiting", "inbox"]);
      expect(result[0].todos).toHaveLength(2);
    });
  });

  describe("priority", () => {
    it("groups in defined order", () => {
      const todos = [
        makeTodo({ priority: "low" }),
        makeTodo({ priority: "high" }),
        makeTodo({ priority: null }),
      ];
      const result = groupTodos(todos, "priority");
      expect(result.map((g) => g.key)).toEqual(["high", "low", "none"]);
    });
  });

  describe("dueDate", () => {
    it("places past dates in overdue", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const todos = [
        makeTodo({ dueDate: yesterday.toISOString() }),
      ];
      const result = groupTodos(todos, "dueDate");
      expect(result[0].key).toBe("overdue");
    });

    it("places today's date in today bucket", () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      const todos = [makeTodo({ dueDate: now.toISOString() })];
      const result = groupTodos(todos, "dueDate");
      expect(result[0].key).toBe("today");
    });

    it("places null dueDate in no-date", () => {
      const todos = [makeTodo({ dueDate: null })];
      const result = groupTodos(todos, "dueDate");
      expect(result[0].key).toBe("no-date");
    });

    it("orders buckets: overdue, today, this-week, next-week, later, no-date", () => {
      const d = new Date();
      const yesterday = new Date(d);
      yesterday.setDate(d.getDate() - 1);
      const nextMonth = new Date(d);
      nextMonth.setDate(d.getDate() + 30);

      const todos = [
        makeTodo({ dueDate: null }),
        makeTodo({ dueDate: d.toISOString() }),
        makeTodo({ dueDate: yesterday.toISOString() }),
        makeTodo({ dueDate: nextMonth.toISOString() }),
      ];
      const result = groupTodos(todos, "dueDate");
      const keys = result.map((g) => g.key);
      expect(keys.indexOf("overdue")).toBeLessThan(keys.indexOf("today"));
      expect(keys.indexOf("today")).toBeLessThan(keys.indexOf("later"));
      expect(keys.indexOf("later")).toBeLessThan(keys.indexOf("no-date"));
    });
  });
});
