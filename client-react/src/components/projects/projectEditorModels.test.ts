// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  defaultViewStorageKey,
  readDefaultView,
  writeDefaultView,
  buildProjectEditorStats,
  countOpenTasksInSection,
  sectionRowsForRail,
  todoStatusLabel,
  TODO_STATUS_OPTIONS,
  formatDueFriendly,
  effortDisplayLabel,
  toDateInputValue,
  fromDateInputValue,
  projectStatusLabel,
  PROJECT_RAIL_BACKLOG_SENTINEL,
} from "./projectEditorModels";
import type { Todo, Heading } from "../../types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Test task",
    description: null,
    notes: null,
    status: overrides.status ?? "next",
    completed: overrides.completed ?? false,
    completedAt: null,
    projectId: overrides.projectId ?? "p1",
    category: null,
    headingId: overrides.headingId ?? null,
    tags: [],
    context: null,
    energy: null,
    dueDate: overrides.dueDate ?? null,
    startDate: null,
    scheduledDate: null,
    reviewDate: null,
    doDate: null,
    estimateMinutes: overrides.estimateMinutes ?? null,
    waitingOn: null,
    dependsOnTaskIds: [],
    order: 0,
    priority: null,
    archived: overrides.archived ?? false,
    firstStep: null,
    emotionalState: null,
    effortScore: overrides.effortScore ?? null,
    source: null,
    recurrence: { type: "none" },
    subtasks: [],
    userId: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeHeading(overrides: Partial<Heading> = {}): Heading {
  return {
    id: overrides.id ?? "h1",
    name: overrides.name ?? "Section",
    projectId: overrides.projectId ?? "p1",
    sortOrder: overrides.sortOrder ?? 0,
  };
}

describe("projectEditorModels", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("defaultViewStorageKey", () => {
    it("returns correct key format", () => {
      expect(defaultViewStorageKey("proj-1")).toBe("todos:project-editor:defaultView:proj-1");
    });
  });

  describe("readDefaultView / writeDefaultView", () => {
    it("returns editor as default", () => {
      expect(readDefaultView("proj-1")).toBe("editor");
    });

    it("reads written value", () => {
      writeDefaultView("proj-1", "list");
      expect(readDefaultView("proj-1")).toBe("list");
    });

    it("accepts board view", () => {
      writeDefaultView("proj-1", "board");
      expect(readDefaultView("proj-1")).toBe("board");
    });

    it("ignores invalid values", () => {
      localStorage.setItem("todos:project-editor:defaultView:proj-1", "invalid");
      expect(readDefaultView("proj-1")).toBe("editor");
    });
  });

  describe("buildProjectEditorStats", () => {
    it("returns empty stats for no tasks", () => {
      const stats = buildProjectEditorStats([]);
      expect(stats).toEqual({
        openCount: 0,
        completedCount: 0,
        nextStepTitle: "—",
        progressLabel: "No tasks yet",
        progressPercent: 0,
      });
    });

    it("calculates progress for mixed tasks", () => {
      const todos = [
        makeTodo({ id: "t1", completed: true }),
        makeTodo({ id: "t2", completed: false }),
        makeTodo({ id: "t3", completed: false }),
      ];
      const stats = buildProjectEditorStats(todos);
      expect(stats.openCount).toBe(2);
      expect(stats.completedCount).toBe(1);
      expect(stats.progressPercent).toBe(33);
      expect(stats.progressLabel).toBe("33%");
    });

    it("shows complete for all done", () => {
      const todos = [
        makeTodo({ id: "t1", completed: true }),
        makeTodo({ id: "t2", completed: true }),
      ];
      const stats = buildProjectEditorStats(todos);
      expect(stats.progressPercent).toBe(100);
      expect(stats.progressLabel).toBe("Complete");
    });

    it("excludes archived tasks", () => {
      const todos = [
        makeTodo({ id: "t1", completed: true, archived: true }),
        makeTodo({ id: "t2", completed: false }),
      ];
      const stats = buildProjectEditorStats(todos);
      expect(stats.openCount).toBe(1);
      expect(stats.completedCount).toBe(0);
    });

    it("shows next step title from top task", () => {
      const todos = [makeTodo({ id: "t1", title: "First task" })];
      const stats = buildProjectEditorStats(todos);
      expect(stats.nextStepTitle).toBe("First task");
    });
  });

  describe("countOpenTasksInSection", () => {
    it("counts tasks without heading", () => {
      const todos = [
        makeTodo({ id: "t1", completed: false, headingId: null }),
        makeTodo({ id: "t2", completed: false, headingId: null }),
        makeTodo({ id: "t3", completed: true, headingId: null }),
      ];
      expect(countOpenTasksInSection(todos, null)).toBe(2);
    });

    it("counts tasks with specific heading", () => {
      const todos = [
        makeTodo({ id: "t1", completed: false, headingId: "h1" }),
        makeTodo({ id: "t2", completed: false, headingId: "h1" }),
        makeTodo({ id: "t3", completed: false, headingId: "h2" }),
      ];
      expect(countOpenTasksInSection(todos, "h1")).toBe(2);
    });

    it("excludes archived tasks", () => {
      const todos = [
        makeTodo({ id: "t1", completed: false, headingId: null, archived: true }),
        makeTodo({ id: "t2", completed: false, headingId: null }),
      ];
      expect(countOpenTasksInSection(todos, null)).toBe(1);
    });
  });

  describe("sectionRowsForRail", () => {
    it("returns backlog row first", () => {
      const rows = sectionRowsForRail([], []);
      expect(rows[0].label).toBe("Backlog");
      expect(rows[0].key).toBe(PROJECT_RAIL_BACKLOG_SENTINEL);
    });

    it("includes heading rows", () => {
      const headings = [makeHeading({ id: "h1", name: "Phase 1" })];
      const rows = sectionRowsForRail(headings, []);
      expect(rows).toHaveLength(2);
      expect(rows[1].label).toBe("Phase 1");
      expect(rows[1].heading).toEqual(headings[0]);
    });
  });

  describe("todoStatusLabel", () => {
    it("returns label for each status", () => {
      expect(todoStatusLabel("inbox")).toBe("Inbox");
      expect(todoStatusLabel("next")).toBe("Next up");
      expect(todoStatusLabel("in_progress")).toBe("In progress");
      expect(todoStatusLabel("waiting")).toBe("Waiting");
      expect(todoStatusLabel("scheduled")).toBe("Scheduled");
      expect(todoStatusLabel("someday")).toBe("Someday");
      expect(todoStatusLabel("done")).toBe("Done");
      expect(todoStatusLabel("cancelled")).toBe("Cancelled");
    });
  });

  describe("TODO_STATUS_OPTIONS", () => {
    it("has 8 status options", () => {
      expect(TODO_STATUS_OPTIONS).toHaveLength(8);
    });

    it("each option has value and label", () => {
      TODO_STATUS_OPTIONS.forEach((opt) => {
        expect(opt).toHaveProperty("value");
        expect(opt).toHaveProperty("label");
      });
    });
  });

  describe("formatDueFriendly", () => {
    it("returns No date for null", () => {
      expect(formatDueFriendly(null)).toBe("No date");
    });

    it("returns Today for a date today", () => {
      const today = new Date();
      // Use local date string to avoid timezone issues
      const localDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      expect(formatDueFriendly(localDate, today)).toBe("Today");
    });

    it("returns Tomorrow for tomorrow", () => {
      const today = new Date();
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const dateStr = tomorrow.toISOString();
      expect(formatDueFriendly(dateStr, today)).toBe("Tomorrow");
    });

    it("returns Overdue for past date", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];
      expect(formatDueFriendly(dateStr, today)).toContain("Overdue");
    });

    it("returns This week for 3 days", () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + 3);
      const dateStr = future.toISOString().split("T")[0];
      expect(formatDueFriendly(dateStr, today)).toBe("This week");
    });

    it("returns Next week for 10 days", () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + 10);
      const dateStr = future.toISOString().split("T")[0];
      expect(formatDueFriendly(dateStr, today)).toBe("Next week");
    });
  });

  describe("effortDisplayLabel", () => {
    it("returns label for todo with no effort score", () => {
      const todo = makeTodo({ effortScore: null });
      expect(typeof effortDisplayLabel(todo)).toBe("string");
    });

    it("returns label for todo with effort score", () => {
      const todo = makeTodo({ effortScore: 5 });
      expect(typeof effortDisplayLabel(todo)).toBe("string");
    });
  });

  describe("toDateInputValue", () => {
    it("returns empty string for null", () => {
      expect(toDateInputValue(null)).toBe("");
    });

    it("extracts date from ISO string", () => {
      expect(toDateInputValue("2026-04-10T12:00:00.000Z")).toBe("2026-04-10");
    });
  });

  describe("fromDateInputValue", () => {
    it("returns null for empty string", () => {
      expect(fromDateInputValue("")).toBeNull();
    });

    it("converts date to ISO", () => {
      expect(fromDateInputValue("2026-04-10")).toBe("2026-04-10T12:00:00.000Z");
    });
  });

  describe("projectStatusLabel", () => {
    it("returns label for each status", () => {
      expect(projectStatusLabel("active")).toBe("Active");
      expect(projectStatusLabel("on_hold")).toBe("On hold");
      expect(projectStatusLabel("completed")).toBe("Completed");
      expect(projectStatusLabel("archived")).toBe("Archived");
    });
  });
});
