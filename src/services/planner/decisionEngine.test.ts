import { DecisionEngine } from "./decisionEngine";
import type { Project, Todo } from "../../types";

const USER_ID = "user-1";

function makeProject(
  id: string,
  name: string,
  overrides: Partial<Project> = {},
): Project {
  return {
    id,
    name,
    status: "active",
    archived: false,
    userId: USER_ID,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  };
}

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

describe("DecisionEngine", () => {
  it("ranks available work deterministically with reasons", () => {
    const engine = new DecisionEngine();
    const project = makeProject("project-1", "Platform");

    const result = engine.decideNextWork({
      projects: [project],
      tasks: [
        makeTask("task-1", "Investigate overdue bug", {
          projectId: project.id,
          category: project.name,
          status: "next",
          priority: "high",
          dueDate: new Date("2026-03-11T12:00:00.000Z"),
          context: "computer",
          energy: "medium",
          estimateMinutes: 45,
        }),
        makeTask("task-2", "Deep architecture review", {
          projectId: project.id,
          category: project.name,
          status: "next",
          priority: "medium",
          context: "computer",
          energy: "high",
          estimateMinutes: 180,
        }),
      ],
      now: new Date("2026-03-12T12:00:00.000Z"),
      availableMinutes: 60,
      energy: "medium",
      context: ["computer"],
    });

    expect(result.recommendedTasks).toHaveLength(1);
    expect(result.recommendedTasks[0].taskId).toBe("task-1");
    expect(result.recommendedTasks[0].reason).toContain("overdue");
    expect(result.recommendedTasks[0].impact).toBe("high");
  });

  it("excludes blocked, future, and unavailable tasks from next-work recommendations", () => {
    const engine = new DecisionEngine();
    const project = makeProject("project-1", "Platform");
    const now = new Date("2026-03-12T12:00:00.000Z");
    const dependency = makeTask("task-1", "Open dependency", {
      projectId: project.id,
      status: "next",
      priority: "low",
    });

    const result = engine.decideNextWork({
      projects: [project],
      tasks: [
        dependency,
        makeTask("task-2", "Blocked launch task", {
          projectId: project.id,
          status: "next",
          priority: "urgent",
          dependsOnTaskIds: [dependency.id],
        }),
        makeTask("task-3", "Future start task", {
          projectId: project.id,
          status: "next",
          priority: "urgent",
          startDate: new Date("2026-03-13T12:00:00.000Z"),
        }),
        makeTask("task-4", "Future scheduled task", {
          projectId: project.id,
          status: "scheduled",
          priority: "urgent",
          scheduledDate: new Date("2026-03-13T12:00:00.000Z"),
        }),
        makeTask("task-5", "Wrong context task", {
          projectId: project.id,
          status: "next",
          priority: "urgent",
          context: "office",
        }),
        makeTask("task-6", "Available task", {
          projectId: project.id,
          status: "next",
          priority: "high",
          context: "computer",
          energy: "medium",
          estimateMinutes: 30,
        }),
      ],
      now,
      availableMinutes: 45,
      energy: "medium",
      context: ["computer"],
    });

    expect(result.recommendedTasks.map((task) => task.taskId)).toEqual([
      "task-6",
    ]);
  });
});
