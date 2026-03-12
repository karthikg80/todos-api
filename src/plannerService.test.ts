import type { IProjectService } from "./interfaces/IProjectService";
import { PlannerService } from "./services/plannerService";
import { TodoService } from "./services/todoService";
import type {
  CreateProjectDto,
  Project,
  ProjectTaskDisposition,
  UpdateProjectDto,
} from "./types";

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

function createProjectServiceMock(
  projects: Project[],
): jest.Mocked<IProjectService> {
  return {
    findAll: jest
      .fn<Promise<Project[]>, [string]>()
      .mockImplementation(async () => projects),
    findById: jest
      .fn<Promise<Project | null>, [string, string]>()
      .mockImplementation(
        async (_userId, projectId) =>
          projects.find((project) => project.id === projectId) ?? null,
      ),
    create: jest.fn<Promise<Project>, [string, CreateProjectDto]>(),
    update: jest.fn<
      Promise<Project | null>,
      [string, string, UpdateProjectDto]
    >(),
    setArchived: jest.fn<Promise<Project | null>, [string, string, boolean]>(),
    delete: jest.fn<
      Promise<boolean>,
      [string, string, ProjectTaskDisposition, (string | null)?]
    >(),
  };
}

describe("PlannerService", () => {
  it("returns project planning suggestions in suggest mode", async () => {
    const todoService = new TodoService();
    const project = makeProject("project-1", "Vacation", {
      goal: "Plan anniversary vacation",
    });
    const plannerService = new PlannerService({
      todoService,
      projectService: createProjectServiceMock([project]),
    });

    await todoService.create(USER_ID, {
      title: "Define success criteria for Plan anniversary vacation",
      projectId: project.id,
      category: project.name,
    });

    const result = await plannerService.planProject({
      userId: USER_ID,
      projectId: project.id,
      goal: "Plan anniversary vacation",
      mode: "suggest",
    });

    expect(result).not.toBeNull();
    expect(result?.project).toEqual({
      id: project.id,
      name: project.name,
    });
    expect(result?.createdTaskIds).toEqual([]);
    expect(result?.suggestedTasks).toHaveLength(4);
  });

  it("creates missing plan tasks in apply mode", async () => {
    const todoService = new TodoService();
    const project = makeProject("project-1", "Launch");
    const plannerService = new PlannerService({
      todoService,
      projectService: createProjectServiceMock([project]),
    });

    const result = await plannerService.planProject({
      userId: USER_ID,
      projectId: project.id,
      goal: "Launch customer beta",
      mode: "apply",
    });

    expect(result).not.toBeNull();
    expect(result?.createdTaskIds.length).toBeGreaterThan(0);

    const createdTasks = await todoService.findAll(USER_ID, {
      archived: false,
      projectId: project.id,
    });
    expect(createdTasks).toHaveLength(result?.createdTaskIds.length || 0);
  });

  it("returns an existing next action when one already exists", async () => {
    const todoService = new TodoService();
    const project = makeProject("project-1", "Platform");
    const plannerService = new PlannerService({
      todoService,
      projectService: createProjectServiceMock([project]),
    });
    const existingTask = await todoService.create(USER_ID, {
      title: "Ship changelog",
      projectId: project.id,
      category: project.name,
      status: "next",
    });

    const result = await plannerService.ensureNextAction({
      userId: USER_ID,
      projectId: project.id,
      mode: "apply",
    });

    expect(result).toEqual({
      projectId: project.id,
      hasNextAction: true,
      created: false,
      task: {
        id: existingTask.id,
        title: existingTask.title,
        status: "next",
      },
      reason: "The project already has an actionable next step.",
    });
  });

  it("creates a concrete next action when none exists", async () => {
    const todoService = new TodoService();
    const project = makeProject("project-1", "Ops");
    const plannerService = new PlannerService({
      todoService,
      projectService: createProjectServiceMock([project]),
    });

    await todoService.create(USER_ID, {
      title: "Await vendor quote",
      projectId: project.id,
      category: project.name,
      status: "waiting",
      waitingOn: "vendor quote",
    });

    const result = await plannerService.ensureNextAction({
      userId: USER_ID,
      projectId: project.id,
      mode: "apply",
    });

    expect(result?.created).toBe(true);
    expect(result?.hasNextAction).toBe(true);
    expect(result?.task?.id).toBeDefined();
    expect(result?.task?.title).toBe("Follow up on vendor quote");

    const tasks = await todoService.findAll(USER_ID, {
      archived: false,
      projectId: project.id,
    });
    expect(tasks.map((task) => task.title)).toEqual(
      expect.arrayContaining(["Follow up on vendor quote"]),
    );
  });

  it("returns expected weekly review categories and can apply next-action fixes", async () => {
    const todoService = new TodoService();
    const emptyProject = makeProject("project-1", "Admin");
    const blockedProject = makeProject("project-2", "Launch");
    const plannerService = new PlannerService({
      todoService,
      projectService: createProjectServiceMock([emptyProject, blockedProject]),
    });

    const waitingTask = await todoService.create(USER_ID, {
      title: "Await legal approval",
      projectId: blockedProject.id,
      category: blockedProject.name,
      status: "waiting",
      waitingOn: "legal approval",
      dueDate: new Date("2026-03-14T12:00:00.000Z"),
    });
    waitingTask.updatedAt = new Date("2026-01-01T12:00:00.000Z");

    const suggested = await plannerService.weeklyReview({
      userId: USER_ID,
      mode: "suggest",
      includeArchived: false,
    });

    expect(suggested.summary).toEqual({
      projectsWithoutNextAction: 1,
      staleTasks: 1,
      waitingTasks: 1,
      upcomingTasks: 1,
    });
    expect(suggested.findings.map((finding) => finding.type)).toEqual(
      expect.arrayContaining([
        "empty_active_project",
        "missing_next_action",
        "stale_task",
        "waiting_task",
        "upcoming_deadline",
      ]),
    );

    const applied = await plannerService.weeklyReview({
      userId: USER_ID,
      mode: "apply",
      includeArchived: false,
    });

    expect(applied.appliedActions.map((action) => action.type)).toContain(
      "create_next_action",
    );
    const tasks = await todoService.findAll(USER_ID, { archived: false });
    expect(
      tasks.some(
        (task) => task.status === "next" && task.projectId === emptyProject.id,
      ),
    ).toBe(true);
  });

  it("ranks next work recommendations deterministically", async () => {
    const todoService = new TodoService();
    const project = makeProject("project-1", "Platform");
    const plannerService = new PlannerService({
      todoService,
      projectService: createProjectServiceMock([project]),
    });

    await todoService.create(USER_ID, {
      title: "Investigate overdue bug",
      projectId: project.id,
      category: project.name,
      status: "next",
      priority: "high",
      dueDate: new Date("2026-03-11T12:00:00.000Z"),
      context: "computer",
      energy: "medium",
      estimateMinutes: 45,
    });
    await todoService.create(USER_ID, {
      title: "Long workshop",
      projectId: project.id,
      category: project.name,
      status: "next",
      priority: "medium",
      context: "office",
      energy: "high",
      estimateMinutes: 180,
    });

    const result = await plannerService.decideNextWork({
      userId: USER_ID,
      availableMinutes: 60,
      energy: "medium",
      context: ["computer"],
      mode: "suggest",
    });

    expect(result.recommendedTasks).toHaveLength(1);
    expect(result.recommendedTasks[0].title).toBe("Investigate overdue bug");
    expect(result.recommendedTasks[0].reason).toContain("overdue");
  });

  it("analyzes project health and returns explainable risks", async () => {
    const todoService = new TodoService();
    const project = makeProject("project-1", "Migration");
    const plannerService = new PlannerService({
      todoService,
      projectService: createProjectServiceMock([project]),
    });

    const waitingTask = await todoService.create(USER_ID, {
      title: "Await vendor answer",
      projectId: project.id,
      category: project.name,
      status: "waiting",
      waitingOn: "vendor answer",
    });
    waitingTask.updatedAt = new Date("2026-01-01T12:00:00.000Z");

    const result = await plannerService.analyzeProjectHealth({
      userId: USER_ID,
      projectId: project.id,
    });

    expect(result).not.toBeNull();
    expect(result?.healthScore).toBeLessThan(100);
    expect(result?.risks).toEqual(
      expect.arrayContaining([
        "No next action defined",
        "No recent activity",
        "Key work is waiting on an external dependency",
      ]),
    );
  });

  it("analyzes the work graph for blocked and unblocked tasks", async () => {
    const todoService = new TodoService();
    const project = makeProject("project-1", "Launch");
    const plannerService = new PlannerService({
      todoService,
      projectService: createProjectServiceMock([project]),
    });

    const foundation = await todoService.create(USER_ID, {
      title: "Define rollout scope",
      projectId: project.id,
      category: project.name,
      status: "next",
    });
    const dependency = await todoService.create(USER_ID, {
      title: "Approve launch checklist",
      projectId: project.id,
      category: project.name,
      status: "next",
      dependsOnTaskIds: [foundation.id],
    });
    await todoService.create(USER_ID, {
      title: "Publish announcement",
      projectId: project.id,
      category: project.name,
      status: "next",
      dependsOnTaskIds: [dependency.id],
    });

    const result = await plannerService.analyzeWorkGraph({
      userId: USER_ID,
      projectId: project.id,
    });

    expect(result).not.toBeNull();
    expect(result?.blockedTasks.map((task) => task.title)).toEqual(
      expect.arrayContaining([
        "Approve launch checklist",
        "Publish announcement",
      ]),
    );
    expect(result?.unblockedTasks.map((task) => task.title)).toContain(
      "Define rollout scope",
    );
    expect(result?.criticalPath.map((task) => task.title)).toEqual([
      "Define rollout scope",
      "Approve launch checklist",
      "Publish announcement",
    ]);
  });
});
