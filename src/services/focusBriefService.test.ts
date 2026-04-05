// src/services/focusBriefService.test.ts
import { describe, it, expect } from "@jest/globals";
import {
  computeTodayAgenda,
  computeUnsorted,
  computeDueSoon,
  computeBacklogHygiene,
  computeProjectsToNudge,
  computeTrackOverview,
  computeRescueMode,
} from "./focusBriefService";

const today = new Date("2026-04-05");
const makeTodo = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  title: "Test task",
  priority: "medium",
  dueDate: null,
  scheduledDate: null,
  doDate: null,
  estimateMinutes: null,
  status: "next",
  completed: false,
  archived: false,
  updatedAt: new Date("2026-04-01"),
  projectId: null,
  ...overrides,
});

describe("computeTodayAgenda", () => {
  it("includes tasks due today", () => {
    const todos = [makeTodo({ id: "t1", dueDate: new Date("2026-04-05") })];
    const result = computeTodayAgenda(todos, today);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
    expect(result[0].overdue).toBe(false);
  });

  it("marks overdue tasks", () => {
    const todos = [makeTodo({ id: "t1", dueDate: new Date("2026-04-03") })];
    const result = computeTodayAgenda(todos, today);
    expect(result).toHaveLength(1);
    expect(result[0].overdue).toBe(true);
  });

  it("includes tasks with scheduledDate today", () => {
    const todos = [
      makeTodo({ id: "t1", scheduledDate: new Date("2026-04-05") }),
    ];
    const result = computeTodayAgenda(todos, today);
    expect(result).toHaveLength(1);
  });

  it("excludes tasks not due today", () => {
    const todos = [makeTodo({ id: "t1", dueDate: new Date("2026-04-10") })];
    const result = computeTodayAgenda(todos, today);
    expect(result).toHaveLength(0);
  });
});

describe("computeUnsorted", () => {
  it("returns inbox tasks", () => {
    const todos = [
      makeTodo({ id: "t1", status: "inbox" }),
      makeTodo({ id: "t2", status: "next" }),
    ];
    const result = computeUnsorted(todos);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("t1");
  });
});

describe("computeRescueMode", () => {
  it("returns counts when overcommitted", () => {
    const todos = Array.from({ length: 12 }, (_, i) =>
      makeTodo({
        id: `t${i}`,
        dueDate: i < 4 ? new Date("2026-04-01") : null,
      }),
    );
    const result = computeRescueMode(todos, today);
    expect(result.openCount).toBe(12);
    expect(result.overdueCount).toBe(4);
  });
});
