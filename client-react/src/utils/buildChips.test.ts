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

  it("skips medium and low priority", () => {
    expect(buildChips(makeTodo({ priority: "medium" }), "normal").find((c) => c.key === "priority")).toBeUndefined();
    expect(buildChips(makeTodo({ priority: "low" }), "normal").find((c) => c.key === "priority")).toBeUndefined();
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

  it("hides project chip when grouped by project", () => {
    const todo = makeTodo({ category: "Work" });
    expect(buildChips(todo, "normal", "project").find((c) => c.variant === "project")).toBeUndefined();
    expect(buildChips(todo, "normal", "none").find((c) => c.variant === "project")?.label).toBe("Work");
  });

  it("hides priority chip when grouped by priority", () => {
    const todo = makeTodo({ priority: "high" });
    expect(buildChips(todo, "normal", "priority").find((c) => c.variant === "priority-high")).toBeUndefined();
    expect(buildChips(todo, "normal", "none").find((c) => c.variant === "priority-high")?.label).toBe("high");
  });

  it("hides date chips when grouped by dueDate", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todo = makeTodo({ dueDate: tomorrow.toISOString() });
    expect(buildChips(todo, "normal", "dueDate").find((c) => c.variant === "date")).toBeUndefined();
    expect(buildChips(todo, "normal", "none").find((c) => c.variant === "date")).toBeDefined();
  });

  it("hides overdue chip when grouped by dueDate", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const todo = makeTodo({ dueDate: yesterday.toISOString() });
    expect(buildChips(todo, "normal", "dueDate").find((c) => c.variant === "overdue")).toBeUndefined();
    expect(buildChips(todo, "normal", "none").find((c) => c.variant === "overdue")).toBeDefined();
  });

  it("caps tags at 2 with overflow", () => {
    const todo = makeTodo({ tags: ["a", "b", "c", "d"] });
    const chips = buildChips(todo, "spacious");
    const tagChips = chips.filter((c) => c.variant === "tag");
    expect(tagChips).toHaveLength(2);
    expect(chips.find((c) => c.key === "tag-overflow")?.label).toBe("+2 tags");
  });

  it("shows energy chip", () => {
    const todo = makeTodo({ energy: "high" });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.variant === "energy")?.label).toBe("⚡ High");
  });

  it("shows estimate chip", () => {
    const todo = makeTodo({ estimateMinutes: 30 });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.variant === "estimate")?.label).toBe("~30m");
  });

  it("formats estimate in hours", () => {
    const todo = makeTodo({ estimateMinutes: 120 });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.variant === "estimate")?.label).toBe("~2h");
  });

  it("shows recurrence chip", () => {
    const todo = makeTodo({ recurrence: { type: "daily" } });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.variant === "recurrence")?.label).toBe("↻");
  });
});
