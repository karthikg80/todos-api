import { describe, it, expect, vi } from "vitest";
import { applyFilters, type ActiveFilters, type DateFilter } from "./FilterPanel";

interface MockTodo {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string | null;
  priority?: string | null;
  status: string;
  scheduledDate?: string | null;
}

const makeTodo = (overrides: Partial<MockTodo> = {}): MockTodo => ({
  id: overrides.id ?? "todo-default",
  title: overrides.title ?? "Untitled",
  completed: false,
  dueDate: null,
  priority: null,
  status: "next",
  scheduledDate: null,
  ...overrides,
});

describe("applyFilters", () => {
  const today = new Date();
  const todayIso = today.toISOString().split("T")[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 5);
  const noDueDate = makeTodo({ id: "1", title: "No due date", dueDate: null });
  const overdue = makeTodo({ id: "2", title: "Overdue", dueDate: yesterday.toISOString() });
  const dueToday = makeTodo({ id: "3", title: "Due today", dueDate: todayIso + "T00:00:00.000Z" });
  const upcoming = makeTodo({ id: "4", title: "Upcoming", dueDate: tomorrow.toISOString() });
  const planned = makeTodo({ id: "5", title: "Planned", dueDate: null, scheduledDate: tomorrow.toISOString() });
  const nextMonthTodo = makeTodo({ id: "6", title: "Next month", dueDate: nextMonth.toISOString() });
  const completed = makeTodo({ id: "7", title: "Completed", dueDate: yesterday.toISOString(), completed: true });
  const waiting = makeTodo({ id: "8", title: "Waiting", status: "waiting" });
  const highPriority = makeTodo({ id: "9", title: "High", priority: "high" });

  describe("no filters", () => {
    it("returns all todos when all filters are default", () => {
      const filters: ActiveFilters = { dateFilter: "all", priority: "", status: "" };
      const todos = [noDueDate, overdue, dueToday];
      expect(applyFilters(todos, filters)).toHaveLength(3);
    });
  });

  describe("date filters", () => {
    it("filters 'today' to include due today and overdue (not completed)", () => {
      const filters: ActiveFilters = { dateFilter: "today", priority: "", status: "" };
      const result = applyFilters([overdue, dueToday, upcoming, completed, noDueDate], filters);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.title)).toContain("Overdue");
      expect(result.map((t) => t.title)).toContain("Due today");
    });

    it("filters 'upcoming' to next 14 days (not today, not completed)", () => {
      const filters: ActiveFilters = { dateFilter: "upcoming", priority: "", status: "" };
      const result = applyFilters([overdue, dueToday, upcoming, completed], filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Upcoming");
    });

    it("filters 'later' to todos without due date (not completed)", () => {
      const filters: ActiveFilters = { dateFilter: "later", priority: "", status: "" };
      const result = applyFilters([noDueDate, overdue, dueToday, completed], filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("No due date");
    });

    it("filters 'pending' to waiting status only", () => {
      const filters: ActiveFilters = { dateFilter: "pending", priority: "", status: "" };
      const result = applyFilters([waiting, noDueDate, overdue], filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Waiting");
    });

    it("filters 'planned' to todos with scheduled date", () => {
      const filters: ActiveFilters = { dateFilter: "planned", priority: "", status: "" };
      const result = applyFilters([planned, noDueDate, overdue], filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Planned");
    });

    it("filters 'next-month' to next calendar month", () => {
      const filters: ActiveFilters = { dateFilter: "next-month", priority: "", status: "" };
      const result = applyFilters([nextMonthTodo, upcoming, overdue], filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Next month");
    });

    it("excludes completed todos from all date filters", () => {
      const filters: ActiveFilters = { dateFilter: "today", priority: "", status: "" };
      const result = applyFilters([completed, overdue], filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Overdue");
    });
  });

  describe("priority filter", () => {
    it("filters by priority when set", () => {
      const filters: ActiveFilters = { dateFilter: "all", priority: "high", status: "" };
      const result = applyFilters([highPriority, makeTodo({ id: "a", title: "Low", priority: "low" })], filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("High");
    });

    it("does not filter priority when empty", () => {
      const filters: ActiveFilters = { dateFilter: "all", priority: "", status: "" };
      const result = applyFilters([highPriority, makeTodo({ id: "a", title: "Low", priority: "low" })], filters);
      expect(result).toHaveLength(2);
    });
  });

  describe("status filter", () => {
    it("filters by status when set", () => {
      const filters: ActiveFilters = { dateFilter: "all", priority: "", status: "waiting" };
      const result = applyFilters([waiting, noDueDate], filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Waiting");
    });

    it("does not filter status when empty", () => {
      const filters: ActiveFilters = { dateFilter: "all", priority: "", status: "" };
      const result = applyFilters([waiting, noDueDate], filters);
      expect(result).toHaveLength(2);
    });
  });

  describe("combined filters", () => {
    it("applies all filters together", () => {
      const filters: ActiveFilters = { dateFilter: "all", priority: "high", status: "waiting" };
      const todos = [
        makeTodo({ id: "1", title: "Both", priority: "high", status: "waiting" }),
        makeTodo({ id: "2", title: "Only priority", priority: "high", status: "next" }),
        makeTodo({ id: "3", title: "Only status", priority: "low", status: "waiting" }),
      ];
      const result = applyFilters(todos, filters);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Both");
    });
  });
});
