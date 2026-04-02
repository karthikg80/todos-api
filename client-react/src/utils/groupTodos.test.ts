import { describe, it, expect } from "vitest";
import { groupTodos, type GroupBy } from "./groupTodos";
import type { Todo } from "../types";

// Fixed reference date used across all time-sensitive tests so results are
// deterministic regardless of when the suite runs.
// 2026-04-01 (Wednesday)
const REF_DATE = new Date("2026-04-01T12:00:00Z");

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

    it("appends done/cancelled after ordered groups when they slip through", () => {
      // The Everything view filters out done/cancelled upstream; this test
      // verifies graceful handling if they reach groupTodos anyway.
      const todos = [
        makeTodo({ status: "done" }),
        makeTodo({ status: "cancelled" }),
        makeTodo({ status: "next" }),
      ];
      const result = groupTodos(todos, "status");
      const keys = result.map((g) => g.key);
      // "next" comes first (it is in STATUS_ORDER)
      expect(keys[0]).toBe("next");
      // done and cancelled land at the end via the fallback path
      expect(keys).toContain("done");
      expect(keys).toContain("cancelled");
      expect(keys.indexOf("next")).toBeLessThan(keys.indexOf("done"));
      expect(keys.indexOf("next")).toBeLessThan(keys.indexOf("cancelled"));
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
    // All date tests use REF_DATE (2026-04-01, Wednesday) as "now" so results
    // do not change depending on the calendar day the suite runs.

    it("places past dates in overdue", () => {
      const yesterday = new Date(REF_DATE);
      yesterday.setDate(yesterday.getDate() - 1);
      const todos = [makeTodo({ dueDate: yesterday.toISOString() })];
      const result = groupTodos(todos, "dueDate", REF_DATE);
      expect(result[0].key).toBe("overdue");
    });

    it("places today's date in today bucket", () => {
      const today = new Date(REF_DATE);
      today.setHours(12, 0, 0, 0);
      const todos = [makeTodo({ dueDate: today.toISOString() })];
      const result = groupTodos(todos, "dueDate", REF_DATE);
      expect(result[0].key).toBe("today");
    });

    it("places null dueDate in no-date", () => {
      const todos = [makeTodo({ dueDate: null })];
      const result = groupTodos(todos, "dueDate", REF_DATE);
      expect(result[0].key).toBe("no-date");
    });

    it("orders buckets: overdue, today, this-week, next-week, later, no-date", () => {
      // REF_DATE is 2026-04-01 (Wednesday)
      const yesterday = new Date("2026-03-31T12:00:00Z"); // overdue
      const today = new Date("2026-04-01T12:00:00Z");     // today
      const nextMonth = new Date("2026-05-01T12:00:00Z"); // later

      const todos = [
        makeTodo({ dueDate: null }),
        makeTodo({ dueDate: today.toISOString() }),
        makeTodo({ dueDate: yesterday.toISOString() }),
        makeTodo({ dueDate: nextMonth.toISOString() }),
      ];
      const result = groupTodos(todos, "dueDate", REF_DATE);
      const keys = result.map((g) => g.key);
      expect(keys.indexOf("overdue")).toBeLessThan(keys.indexOf("today"));
      expect(keys.indexOf("today")).toBeLessThan(keys.indexOf("later"));
      expect(keys.indexOf("later")).toBeLessThan(keys.indexOf("no-date"));
    });
  });
});
