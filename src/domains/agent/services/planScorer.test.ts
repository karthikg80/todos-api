import type { Todo } from "../../../types";
import { scorePlan } from "./planScorer";

function makeTask(
  id: string,
  title: string,
  overrides: Partial<Todo> = {},
): Todo {
  return {
    id,
    title,
    status: "next",
    completed: false,
    tags: [],
    dependsOnTaskIds: [],
    order: 0,
    priority: "medium",
    archived: false,
    recurrence: { type: "none" },
    userId: "user-1",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    subtasks: [],
    ...overrides,
  };
}

describe("planScorer", () => {
  it("applies a larger goal-alignment boost for directly linked goals than project fallback goals", () => {
    const targetDate = new Date(Date.now() + 7 * 86_400_000);
    const directTask = makeTask("task-1", "Direct goal task", {
      projectId: "project-1",
      goalId: "goal-1",
      effortScore: 30,
    });
    const fallbackTask = makeTask("task-2", "Fallback goal task", {
      projectId: "project-2",
      effortScore: 30,
    });

    const result = scorePlan(
      [directTask, fallbackTask],
      "2026-03-12",
      90,
      undefined,
      undefined,
      undefined,
      undefined,
      new Map([
        ["goal-1", { targetDate }],
        ["goal-2", { targetDate }],
      ]),
      new Map([["project-2", "goal-2"]]),
    );

    const selectedById = new Map(
      result.selected.map((item) => [item.task.id, item]),
    );
    const direct = selectedById.get("task-1");
    const fallback = selectedById.get("task-2");

    expect(direct?.scoreBreakdown.goalAlignment).toBe(20);
    expect(fallback?.scoreBreakdown.goalAlignment).toBe(15);
    expect(direct?.score).toBeGreaterThan(fallback?.score ?? 0);
  });
});
