import { WorkGraphEngine } from "./workGraphEngine";
import type { Todo } from "../../types";

const USER_ID = "user-1";

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
    archived: false,
    recurrence: { type: "none" },
    userId: USER_ID,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    subtasks: [],
    ...overrides,
  };
}

describe("WorkGraphEngine", () => {
  it("classifies blocked and unblocked tasks and derives a critical path", () => {
    const engine = new WorkGraphEngine();
    const foundation = makeTask("task-1", "Define rollout scope");
    const approval = makeTask("task-2", "Approve launch checklist", {
      dependsOnTaskIds: [foundation.id],
    });
    const announce = makeTask("task-3", "Publish announcement", {
      dependsOnTaskIds: [approval.id],
    });

    const result = engine.analyzeWorkGraph({
      projectTasks: [foundation, approval, announce],
      allTasks: [foundation, approval, announce],
    });

    expect(result.blockedTasks.map((task) => task.taskId)).toEqual(
      expect.arrayContaining(["task-2", "task-3"]),
    );
    expect(result.unblockedTasks.map((task) => task.taskId)).toContain(
      "task-1",
    );
    expect(result.criticalPath.map((task) => task.taskId)).toEqual([
      "task-1",
      "task-2",
      "task-3",
    ]);
  });
});
