import { describe, it, expect } from "vitest";
import { buildChips } from "./buildChips";
import type { Todo } from "../types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "t1",
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

describe("buildChips", () => {
  it("returns empty for compact density", () => {
    const todo = makeTodo({ priority: "high", category: "Work" });
    expect(buildChips(todo, "compact")).toEqual([]);
  });

  it("orders overdue before blocked before priority", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const todo = makeTodo({
      dueDate: yesterday.toISOString(),
      dependsOnTaskIds: ["dep1"],
      priority: "high",
    });
    const chips = buildChips(todo, "spacious");
    expect(chips[0].variant).toBe("overdue");
    expect(chips[1].variant).toBe("blocked");
    expect(chips[2].variant).toBe("priority-high");
  });

  it("truncates to 4 + overflow in normal mode", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const todo = makeTodo({
      dueDate: yesterday.toISOString(),
      dependsOnTaskIds: ["dep1"],
      priority: "high",
      category: "Work",
      tags: ["a", "b", "c"],
    });
    const chips = buildChips(todo, "normal");
    expect(chips).toHaveLength(5); // 4 shown + overflow
    expect(chips[4].variant).toBe("overflow");
    expect(chips[4].label).toBe("+3"); // 3 tags overflow (project fits in first 4)
  });

  it("shows all chips in spacious mode", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const todo = makeTodo({
      dueDate: yesterday.toISOString(),
      dependsOnTaskIds: ["dep1"],
      priority: "high",
      category: "Work",
      tags: ["a", "b"],
    });
    const chips = buildChips(todo, "spacious");
    expect(chips.length).toBeGreaterThan(4);
    expect(chips.find((c) => c.variant === "overflow")).toBeUndefined();
  });

  it("shows waiting-on chip", () => {
    const todo = makeTodo({ waitingOn: "Alice" });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.variant === "waiting")?.label).toBe("@Alice");
  });

  it("skips low priority", () => {
    const todo = makeTodo({ priority: "low" });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.key === "priority")).toBeUndefined();
  });

  it("shows subtask count in normal mode", () => {
    const todo = makeTodo({
      subtasks: [
        { id: "s1", title: "A", completed: true, order: 0, todoId: "t1", createdAt: "", updatedAt: "" },
        { id: "s2", title: "B", completed: false, order: 1, todoId: "t1", createdAt: "", updatedAt: "" },
      ],
    });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.variant === "subtask")?.label).toBe("1/2");
  });
});
