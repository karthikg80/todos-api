// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  filterVisibleTodos,
  computeHorizonCounts,
  computeViewCounts,
  getQuickEntryPlaceholder,
} from "./appShellFilters";
import type { Todo } from "../../types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  const today = new Date().toISOString().split("T")[0];
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
    estimateMinutes: overrides.estimateMinutes ?? null,
    waitingOn: null,
    dependsOnTaskIds: [],
    order: 0,
    priority: overrides.priority ?? null,
    archived: overrides.archived ?? false,
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
  priority: null as string | null,
  status: null as string | null,
  tag: null as string | null,
};

describe("appShellFilters", () => {
  describe("filterVisibleTodos", () => {
    it("returns all todos for home view", () => {
      const todos = [makeTodo({ id: "t1" }), makeTodo({ id: "t2", completed: true })];
      const result = filterVisibleTodos({
        todos,
        activeView: "home",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(2);
    });

    it("filters today view by due date", () => {
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const todos = [
        makeTodo({ id: "t1", title: "Due today", dueDate: today + "T12:00:00.000Z" }),
        makeTodo({ id: "t2", title: "Due tomorrow", dueDate: tomorrow.toISOString() }),
        makeTodo({ id: "t3", title: "No date" }),
        makeTodo({ id: "t4", title: "Completed", dueDate: today + "T12:00:00.000Z", completed: true }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "today",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Due today");
    });

    it("filters horizon/due segment by upcoming 14 days", () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextMonth = new Date(today);
      nextMonth.setDate(nextMonth.getDate() + 30);

      const todos = [
        makeTodo({ id: "t1", title: "Next week", dueDate: nextWeek.toISOString() }),
        makeTodo({ id: "t2", title: "Next month", dueDate: nextMonth.toISOString() }),
        makeTodo({ id: "t3", title: "Completed", dueDate: nextWeek.toISOString(), completed: true }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "horizon",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Next week");
    });

    it("filters horizon/pending by waiting status", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Waiting", status: "waiting" }),
        makeTodo({ id: "t2", title: "Next", status: "next" }),
        makeTodo({ id: "t3", title: "Completed", status: "waiting", completed: true }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "horizon",
        horizonSegment: "pending",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Waiting");
    });

    it("filters horizon/planned by scheduledDate", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Scheduled", scheduledDate: "2026-05-01T12:00:00.000Z" }),
        makeTodo({ id: "t2", title: "Not scheduled" }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "horizon",
        horizonSegment: "planned",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Scheduled");
    });

    it("filters horizon/later by someday status", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Someday", status: "someday" }),
        makeTodo({ id: "t2", title: "Next", status: "next" }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "horizon",
        horizonSegment: "later",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Someday");
    });

    it("filters completed view", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Done", completed: true }),
        makeTodo({ id: "t2", title: "Open" }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "completed",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Done");
    });

    it("filters by search query across title, description, category, notes, and tags", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Write report", description: "Important report" }),
        makeTodo({ id: "t2", title: "Buy groceries", category: "Errands" }),
        makeTodo({ id: "t3", title: "Call dentist", notes: "Remember to book" }),
        makeTodo({ id: "t4", title: "Review PR", tags: ["work"] }),
      ];
      const result1 = filterVisibleTodos({
        todos,
        activeView: "all",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "report",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result1).toHaveLength(1);
      expect(result1[0].title).toBe("Write report");

      const result2 = filterVisibleTodos({
        todos,
        activeView: "all",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "errands",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result2).toHaveLength(1);
      expect(result2[0].title).toBe("Buy groceries");

      const result3 = filterVisibleTodos({
        todos,
        activeView: "all",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "work",
        activeTagFilter: null,
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result3).toHaveLength(1);
      expect(result3[0].title).toBe("Review PR");
    });

    it("filters by tag", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Task 1", tags: ["work", "urgent"] }),
        makeTodo({ id: "t2", title: "Task 2", tags: ["home"] }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "all",
        horizonSegment: "due",
        selectedProjectId: null,
        searchQuery: "",
        activeTagFilter: "work",
        activeHeadingId: null,
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Task 1");
    });

    it("filters by heading when project selected", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Under heading", headingId: "h1" }),
        makeTodo({ id: "t2", title: "No heading" }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "all",
        horizonSegment: "due",
        selectedProjectId: "p1",
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: "h1",
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Under heading");
    });

    it("filters backlog when heading is sentinel", () => {
      const todos = [
        makeTodo({ id: "t1", title: "No heading", headingId: null }),
        makeTodo({ id: "t2", title: "Under heading", headingId: "h1" }),
      ];
      const result = filterVisibleTodos({
        todos,
        activeView: "all",
        horizonSegment: "due",
        selectedProjectId: "p1",
        searchQuery: "",
        activeTagFilter: null,
        activeHeadingId: "__unplaced__",
        activeFilters: defaultFilters,
      });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("No heading");
    });
  });

  describe("computeHorizonCounts", () => {
    it("returns zero counts for empty todos", () => {
      const counts = computeHorizonCounts([]);
      expect(counts).toEqual({ due: 0, pending: 0, planned: 0, later: 0 });
    });

    it("counts due tasks within next 14 days", () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);

      const todos = [
        makeTodo({ id: "t1", title: "Next week", dueDate: nextWeek.toISOString() }),
        makeTodo({ id: "t2", title: "Next month", dueDate: nextMonth.toISOString() }),
        makeTodo({ id: "t3", title: "Completed", dueDate: nextWeek.toISOString(), completed: true }),
      ];
      const counts = computeHorizonCounts(todos);
      expect(counts.due).toBe(1);
    });

    it("counts pending (waiting) tasks", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Waiting", status: "waiting" }),
        makeTodo({ id: "t2", title: "Next", status: "next" }),
      ];
      const counts = computeHorizonCounts(todos);
      expect(counts.pending).toBe(1);
    });

    it("counts planned (scheduled) tasks", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Scheduled", scheduledDate: "2026-05-01T12:00:00.000Z" }),
        makeTodo({ id: "t2", title: "Not scheduled" }),
      ];
      const counts = computeHorizonCounts(todos);
      expect(counts.planned).toBe(1);
    });

    it("counts later (someday) tasks", () => {
      const todos = [
        makeTodo({ id: "t1", title: "Someday", status: "someday" }),
        makeTodo({ id: "t2", title: "Next", status: "next" }),
      ];
      const counts = computeHorizonCounts(todos);
      expect(counts.later).toBe(1);
    });
  });

  describe("computeViewCounts", () => {
    it("returns zero counts for empty todos", () => {
      const counts = computeViewCounts([]);
      expect(counts).toEqual({ today: 0, horizon: 0 });
    });

    it("counts today tasks (due today or earlier)", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todos = [
        makeTodo({ id: "t1", title: "Yesterday", dueDate: yesterday.toISOString() }),
        makeTodo({ id: "t2", title: "Today", dueDate: today.toISOString() }),
        makeTodo({ id: "t3", title: "Tomorrow", dueDate: tomorrow.toISOString() }),
        makeTodo({ id: "t4", title: "Completed", dueDate: today.toISOString(), completed: true }),
      ];
      const counts = computeViewCounts(todos);
      expect(counts.today).toBe(2);
    });

    it("counts horizon tasks (union of due/pending/planned/later)", () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const todos = [
        makeTodo({ id: "t1", title: "Due next week", dueDate: nextWeek.toISOString() }),
        makeTodo({ id: "t2", title: "Waiting", status: "waiting" }),
        makeTodo({ id: "t3", title: "Someday", status: "someday" }),
        makeTodo({ id: "t4", title: "Next", status: "next" }),
      ];
      const counts = computeViewCounts(todos);
      expect(counts.horizon).toBe(3);
    });
  });

  describe("getQuickEntryPlaceholder", () => {
    it("shows project-specific placeholder", () => {
      const placeholder = getQuickEntryPlaceholder(
        "p1",
        [{ id: "p1", name: "My Project" }],
        "home",
        "due",
      );
      expect(placeholder).toBe("Add a task to My Project…");
    });

    it("shows generic placeholder for unknown project", () => {
      const placeholder = getQuickEntryPlaceholder(
        "p1",
        [],
        "home",
        "due",
      );
      expect(placeholder).toBe("Add a task…");
    });

    it("shows home view placeholder", () => {
      const placeholder = getQuickEntryPlaceholder(null, [], "home", "due");
      expect(placeholder).toBe("What needs your focus today?");
    });

    it("shows today view placeholder", () => {
      const placeholder = getQuickEntryPlaceholder(null, [], "today", "due");
      expect(placeholder).toBe("Add a task for today…");
    });

    it("shows horizon/pending placeholder", () => {
      const placeholder = getQuickEntryPlaceholder(null, [], "horizon", "pending");
      expect(placeholder).toContain("waiting");
    });

    it("shows horizon/planned placeholder", () => {
      const placeholder = getQuickEntryPlaceholder(null, [], "horizon", "planned");
      expect(placeholder).toContain("planned");
    });

    it("shows horizon/later placeholder", () => {
      const placeholder = getQuickEntryPlaceholder(null, [], "horizon", "later");
      expect(placeholder).toContain("later");
    });

    it("shows horizon/default placeholder", () => {
      const placeholder = getQuickEntryPlaceholder(null, [], "horizon", "due");
      expect(placeholder).toContain("horizon");
    });

    it("shows default placeholder for all view", () => {
      const placeholder = getQuickEntryPlaceholder(null, [], "all", "due");
      expect(placeholder).toBe("Add a task…");
    });
  });
});
