// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  filterVisibleTodos,
  computeHorizonCounts,
  computeViewCounts,
  getQuickEntryPlaceholder,
} from "./appShellFilters";
import type { Todo } from "../../types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: overrides.id ?? `t-${Math.random()}`,
    title: overrides.title ?? "Test task",
    description: overrides.description ?? null,
    notes: overrides.notes ?? null,
    status: overrides.status ?? "next",
    completed: overrides.completed ?? false,
    completedAt: null,
    projectId: overrides.projectId ?? null,
    category: overrides.category ?? null,
    headingId: overrides.headingId ?? null,
    tags: overrides.tags ?? [],
    context: null,
    energy: null,
    dueDate: overrides.dueDate ?? null,
    startDate: null,
    scheduledDate: overrides.scheduledDate ?? null,
    reviewDate: null,
    doDate: null,
    estimateMinutes: null,
    waitingOn: null,
    dependsOnTaskIds: [],
    order: 0,
    priority: overrides.priority ?? null,
    archived: false,
    firstStep: null,
    emotionalState: null,
    effortScore: null,
    source: null,
    recurrence: { type: "none" },
    subtasks: [],
    userId: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const defaultFilters = {
  dateFilter: "all" as const,
  priority: "" as const,
  status: "" as const,
};

describe("appShellFilters — expanded", () => {
  describe("filterVisibleTodos — edge cases", () => {
    it("returns empty array for empty todos", () => {
      const result = filterVisibleTodos({
        todos: [],
        activeView: "all",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toEqual([]);
    });

    it("does not filter by date when project is selected", () => {
      const today = new Date().toISOString().split("T")[0];
      const todos = [
        makeTodo({ id: "t1", title: "Due today", dueDate: today + "T12:00:00.000Z" }),
        makeTodo({ id: "t2", title: "No date" }),
        makeTodo({ id: "t3", title: "Completed", completed: true }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "today",
        horizonSegment: "due",
        selectedProjectId: "p1",
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      // Project view: no date filtering, only project filter applies (none here)
      expect(result).toHaveLength(3);
    });

    it("combines search query with view filter", () => {
      const today = new Date().toISOString().split("T")[0];
      const todos = [
        makeTodo({ id: "t1", title: "Meeting today", dueDate: today + "T12:00:00.000Z" }),
        makeTodo({ id: "t2", title: "Call dentist", dueDate: today + "T12:00:00.000Z" }),
        makeTodo({ id: "t3", title: "Meeting tomorrow", dueDate: "2026-12-31T12:00:00.000Z" }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "today",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "meeting",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Meeting today");
    });

    it("combines tag filter with view filter", () => {
      const today = new Date().toISOString().split("T")[0];
      const todos = [
        makeTodo({ id: "t1", title: "Task 1", dueDate: today + "T12:00:00.000Z", tags: ["work"] }),
        makeTodo({ id: "t2", title: "Task 2", dueDate: today + "T12:00:00.000Z", tags: ["home"] }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "today",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: "home",
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Task 2");
    });

    it("search is case-insensitive", () => {
      const todos = [
        makeTodo({ id: "t1", title: "IMPORTANT task" }),
        makeTodo({ id: "t2", title: "Regular task" }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "all",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "important",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe("computeHorizonCounts — edge cases", () => {
    it("excludes completed tasks from all counts", () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const todos = [
        makeTodo({ id: "t1", title: "Waiting, completed", status: "waiting", completed: true }),
        makeTodo({ id: "t2", title: "Someday, completed", status: "someday", completed: true }),
        makeTodo({ id: "t3", title: "Scheduled, completed", scheduledDate: "2026-05-01", completed: true }),
        makeTodo({ id: "t4", title: "Due, completed", dueDate: nextWeek.toISOString(), completed: true }),
      ];
      const counts = computeHorizonCounts(todos);
      expect(counts).toEqual({ due: 0, pending: 0, planned: 0, later: 0 });
    });

    it("counts tasks that fall into multiple horizon categories", () => {
      // A task with both dueDate and scheduledDate counts in both 'due' and 'planned'
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const todos = [
        makeTodo({ id: "t1", title: "Multi", dueDate: nextWeek.toISOString(), scheduledDate: "2026-05-01" }),
      ];
      const counts = computeHorizonCounts(todos);
      expect(counts.due).toBe(1);
      expect(counts.planned).toBe(1);
    });
  });

  describe("computeViewCounts — edge cases", () => {
    it("excludes completed tasks from today count", () => {
      const today = new Date();
      const todos = [
        makeTodo({ id: "t1", title: "Done today", dueDate: today.toISOString(), completed: true }),
      ];
      const counts = computeViewCounts(todos);
      expect(counts.today).toBe(0);
    });

    it("excludes completed tasks from horizon count", () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const todos = [
        makeTodo({ id: "t1", title: "Done next week", dueDate: nextWeek.toISOString(), completed: true }),
      ];
      const counts = computeViewCounts(todos);
      expect(counts.horizon).toBe(0);
    });

    it("counts unique horizon IDs (no double counting)", () => {
      // A task that is both 'due' and 'planned' should count once
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const todos = [
        makeTodo({ id: "t1", title: "Multi", dueDate: nextWeek.toISOString(), scheduledDate: "2026-05-01" }),
      ];
      const counts = computeViewCounts(todos);
      expect(counts.horizon).toBe(1);
    });
  });

  describe("getQuickEntryPlaceholder — edge cases", () => {
    it("shows horizon/default placeholder for due segment", () => {
      const placeholder = getQuickEntryPlaceholder(null, [], "horizon", "due");
      expect(placeholder).toBe("Add something on the horizon…");
    });

    it("shows project placeholder when project exists", () => {
      const placeholder = getQuickEntryPlaceholder(
        "p1",
        [{ id: "p1", name: "My Project" }],
        "today",
        "due",
      );
      expect(placeholder).toBe("Add a task to My Project…");
    });

    it("shows generic placeholder when project not found", () => {
      const placeholder = getQuickEntryPlaceholder(
        "missing",
        [{ id: "p1", name: "Other" }],
        "home",
        "due",
      );
      expect(placeholder).toBe("Add a task…");
    });
  });
});
