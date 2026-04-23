import type { Project, Todo } from "./types";
import {
  buildProjectPlan,
  deriveNextAction,
  findExistingNextAction,
  findWeeklyReviewFindings,
  projectHasNextAction,
  projectTasksForProject,
} from "./services/plannerHeuristics";
import { scoreTaskForDecision } from "./services/planner/plannerHeuristics";

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
    taskCount: 0,
    openTaskCount: 0,
    completedTaskCount: 0,
    todoCount: 0,
    openTodoCount: 0,
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
    priority: "medium",
    archived: false,
    recurrence: { type: "none" },
    userId: USER_ID,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    subtasks: [],
    ...overrides,
  };
}

describe("plannerHeuristics", () => {
  it("builds deterministic project plan suggestions and skips duplicate titles", () => {
    const project = makeProject("project-1", "Vacation", {
      goal: "Plan anniversary vacation",
    });
    const existing = makeTask(
      "task-1",
      "Define success criteria for Plan anniversary vacation",
      {
        projectId: project.id,
        category: project.name,
      },
    );

    const suggestions = buildProjectPlan({
      project,
      tasks: [existing],
      goal: "Plan anniversary vacation",
      constraints: ["Stay under budget", "Travel in June"],
    });

    expect(suggestions).toHaveLength(4);
    expect(suggestions[0].title).toBe(
      "Gather inputs and constraints for Plan anniversary vacation",
    );
    expect(suggestions.every((task) => task.reason.length > 0)).toBe(true);
    expect(
      suggestions.some((task) =>
        String(task.description).includes("Stay under budget"),
      ),
    ).toBe(true);
  });

  it("detects and returns the highest-priority existing next action", () => {
    const tasks = [
      makeTask("task-1", "In progress item", { status: "in_progress" }),
      makeTask("task-2", "High-priority next action", {
        status: "next",
        priority: "high",
      }),
      makeTask("task-3", "Archived next action", {
        status: "next",
        archived: true,
      }),
    ];

    expect(projectHasNextAction(tasks)).toBe(true);
    expect(findExistingNextAction(tasks)?.id).toBe("task-2");
  });

  it("derives a follow-up next action from waiting work", () => {
    const project = makeProject("project-1", "Platform");
    const tasks = [
      makeTask("task-1", "Await vendor quote", {
        projectId: project.id,
        category: project.name,
        status: "waiting",
        waitingOn: "vendor quote",
      }),
    ];

    const suggestion = deriveNextAction(project, tasks);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.title).toBe("Follow up on vendor quote");
    expect(suggestion?.status).toBe("next");
  });

  it("uses canonical projectId when matching project tasks", () => {
    const project = makeProject("project-1", "Platform");
    const matchingTask = makeTask("task-1", "Canonical task", {
      projectId: project.id,
      category: "Platform",
    });
    const legacyOnlyTask = makeTask("task-2", "Legacy category-only task", {
      category: "Platform",
    });

    const projectTasks = projectTasksForProject(project, [
      matchingTask,
      legacyOnlyTask,
    ]);

    expect(projectTasks.map((task) => task.id)).toEqual(["task-1"]);
  });

  it("classifies weekly review findings and recommends safe follow-up actions", () => {
    const now = new Date("2026-03-12T12:00:00.000Z");
    const emptyProject = makeProject("project-1", "Admin");
    const blockedProject = makeProject("project-2", "Launch");
    const waitingTask = makeTask("task-1", "Await legal approval", {
      projectId: blockedProject.id,
      category: blockedProject.name,
      status: "waiting",
      waitingOn: "legal approval",
      updatedAt: new Date("2026-01-01T12:00:00.000Z"),
      dueDate: new Date("2026-03-14T12:00:00.000Z"),
    });

    const review = findWeeklyReviewFindings({
      projects: [emptyProject, blockedProject],
      tasks: [waitingTask],
      now,
      includeArchived: false,
      staleTaskDays: 30,
      upcomingDays: 7,
    });

    expect(review.summary).toEqual({
      projectsWithoutNextAction: 1,
      staleTasks: 1,
      waitingTasks: 1,
      upcomingTasks: 1,
    });
    expect(review.findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining([
        "empty_active_project",
        "missing_next_action",
        "stale_task",
        "waiting_task",
        "upcoming_deadline",
      ]),
    );
    expect(review.recommendedActions.map((action) => action.type)).toEqual(
      expect.arrayContaining([
        "create_next_action",
        "review_stale_task",
        "follow_up_waiting_task",
      ]),
    );
  });

  it("scores directly-linked goals higher than project fallback goals", () => {
    const now = new Date("2026-03-12T12:00:00.000Z");
    const targetDate = new Date("2026-03-20T12:00:00.000Z");
    const directTask = makeTask("task-1", "Direct goal task", {
      projectId: "project-1",
      goalId: "goal-1",
      status: "next",
      priority: "high",
    });
    const fallbackTask = makeTask("task-2", "Project goal fallback task", {
      projectId: "project-2",
      status: "next",
      priority: "high",
    });

    const goalIndex = new Map([
      ["goal-1", { targetDate }],
      ["goal-2", { targetDate }],
    ]);
    const projectGoalMap = new Map([["project-2", "goal-2"]]);

    const directScore = scoreTaskForDecision({
      task: directTask,
      now,
      blocked: false,
      contexts: [],
      dependentCount: 0,
      goalIndex,
      projectGoalMap,
    });
    const fallbackScore = scoreTaskForDecision({
      task: fallbackTask,
      now,
      blocked: false,
      contexts: [],
      dependentCount: 0,
      goalIndex,
      projectGoalMap,
    });

    expect(directScore).toBeGreaterThan(fallbackScore);
  });
});
