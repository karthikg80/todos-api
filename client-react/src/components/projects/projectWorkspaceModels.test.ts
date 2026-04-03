import { afterEach, describe, expect, it, vi } from "vitest";
import type { Heading, Todo } from "../../types";
import { buildSectionGroups, pickTopTasks } from "./projectWorkspaceModels";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: overrides.id ?? "todo-1",
    title: overrides.title ?? "Task",
    status: overrides.status ?? "next",
    completed: overrides.completed ?? false,
    tags: overrides.tags ?? [],
    dependsOnTaskIds: overrides.dependsOnTaskIds ?? [],
    order: overrides.order ?? 0,
    archived: overrides.archived ?? false,
    userId: overrides.userId ?? "user-1",
    createdAt: overrides.createdAt ?? "2026-04-01T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-01T09:00:00.000Z",
    ...overrides,
  };
}

function makeHeading(overrides: Partial<Heading> = {}): Heading {
  return {
    id: overrides.id ?? "heading-1",
    projectId: overrides.projectId ?? "project-1",
    name: overrides.name ?? "Section",
    sortOrder: overrides.sortOrder ?? 0,
    ...overrides,
  };
}

describe("projectWorkspaceModels", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("buildSectionGroups keeps headings in order and surfaces unplaced work first", () => {
    const headings = [
      makeHeading({ id: "h1", name: "Prep", sortOrder: 0 }),
      makeHeading({ id: "h2", name: "Launch", sortOrder: 1 }),
    ];

    const groups = buildSectionGroups(
      [
        makeTodo({ id: "t1", title: "Unplaced", headingId: undefined }),
        makeTodo({ id: "t2", title: "Draft plan", headingId: "h1" }),
        makeTodo({ id: "t3", title: "Ship", headingId: "h2" }),
      ],
      headings,
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Unplaced work",
      "Prep",
      "Launch",
    ]);
    expect(groups[0]?.todos.map((todo) => todo.id)).toEqual(["t1"]);
    expect(groups[1]?.todos.map((todo) => todo.id)).toEqual(["t2"]);
    expect(groups[2]?.todos.map((todo) => todo.id)).toEqual(["t3"]);
  });

  it("pickTopTasks prioritizes overdue, then active status, then priority", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T12:00:00.000Z"));

    const ranked = pickTopTasks([
      makeTodo({
        id: "overdue",
        title: "Fix blocker",
        dueDate: "2026-04-02T09:00:00.000Z",
        priority: "low",
        status: "next",
      }),
      makeTodo({
        id: "doing",
        title: "Active work",
        dueDate: "2026-04-05T09:00:00.000Z",
        priority: "low",
        status: "in_progress",
      }),
      makeTodo({
        id: "next-urgent",
        title: "Prepare launch",
        dueDate: "2026-04-04T09:00:00.000Z",
        priority: "urgent",
        status: "next",
      }),
      makeTodo({
        id: "backlog",
        title: "Nice to have",
        dueDate: "2026-04-04T09:00:00.000Z",
        priority: "urgent",
        status: "inbox",
      }),
      makeTodo({
        id: "done",
        title: "Completed",
        completed: true,
        status: "done",
        dueDate: "2026-04-01T09:00:00.000Z",
      }),
    ]);

    expect(ranked.map((todo) => todo.id)).toEqual([
      "overdue",
      "doing",
      "next-urgent",
      "backlog",
    ]);
  });
});
