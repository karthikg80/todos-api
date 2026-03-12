import { ProjectPlanningEngine } from "./projectPlanningEngine";
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

describe("ProjectPlanningEngine", () => {
  it("builds deterministic plan suggestions and skips duplicate titles", () => {
    const engine = new ProjectPlanningEngine();
    const project = makeProject("project-1", "Vacation", {
      goal: "Plan anniversary vacation",
    });

    const suggestions = engine.planProject({
      project,
      tasks: [
        makeTask(
          "task-1",
          "Define success criteria for Plan anniversary vacation",
        ),
      ],
      goal: "Plan anniversary vacation",
      constraints: ["Stay under budget"],
    });

    expect(suggestions).toHaveLength(4);
    expect(suggestions[0].title).toBe(
      "Gather inputs and constraints for Plan anniversary vacation",
    );
  });

  it("returns an existing next action instead of deriving a duplicate", () => {
    const engine = new ProjectPlanningEngine();
    const project = makeProject("project-1", "Platform");
    const existingTask = makeTask("task-1", "Ship changelog", {
      projectId: project.id,
      category: project.name,
      status: "next",
      priority: "high",
    });

    const result = engine.ensureNextAction({
      project,
      tasks: [existingTask],
    });

    expect(result.existingTask?.id).toBe(existingTask.id);
    expect(result.suggestion).toBeNull();
  });
});
