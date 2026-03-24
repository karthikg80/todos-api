import { ProjectPlanningEngine } from "./projectPlanningEngine";
import { ReviewEngine } from "./reviewEngine";
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

describe("ReviewEngine", () => {
  const engine = new ReviewEngine({
    projectPlanningEngine: new ProjectPlanningEngine(),
  });

  it("returns weekly review findings and safe recommended actions", () => {
    const now = new Date("2026-03-12T12:00:00.000Z");
    const project = makeProject("project-1", "Launch");
    const task = makeTask("task-1", "Await legal approval", {
      projectId: project.id,
      category: project.name,
      status: "waiting",
      waitingOn: "legal approval",
      updatedAt: new Date("2026-01-01T12:00:00.000Z"),
      dueDate: new Date("2026-03-14T12:00:00.000Z"),
    });

    const result = engine.weeklyReview({
      projects: [project],
      tasks: [task],
      now,
      includeArchived: false,
      staleTaskDays: 30,
      upcomingDays: 7,
    });

    expect(result.summary).toEqual({
      projectsWithoutNextAction: 1,
      staleTasks: 1,
      waitingTasks: 1,
      upcomingTasks: 1,
    });
    expect(result.findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining([
        "missing_next_action",
        "stale_task",
        "waiting_task",
        "upcoming_deadline",
      ]),
    );
    expect(result.rolloverGroups).toHaveLength(4);
    expect(result.anchorSuggestions.length).toBeLessThanOrEqual(5);
    expect(result.behaviorAdjustment).toBeTruthy();
  });

  it("calculates project health risks and interventions", () => {
    const project = makeProject("project-1", "Migration");
    const task = makeTask("task-1", "Await vendor answer", {
      projectId: project.id,
      category: project.name,
      status: "waiting",
      waitingOn: "vendor answer",
      updatedAt: new Date("2026-01-01T12:00:00.000Z"),
    });

    const result = engine.analyzeProjectHealth({
      project,
      tasks: [task],
      now: new Date("2026-03-12T12:00:00.000Z"),
    });

    expect(result.healthScore).toBeLessThan(100);
    expect(result.risks).toEqual(
      expect.arrayContaining([
        "No next action defined",
        "No recent activity",
        "Key work is waiting on an external dependency",
      ]),
    );
    expect(result.recommendedInterventions.map((item) => item.type)).toEqual(
      expect.arrayContaining(["create_next_action", "review_project"]),
    );
  });
});
