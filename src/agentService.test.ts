import { AgentService } from "./services/agentService";
import { TodoService } from "./services/todoService";
import type { IProjectService } from "./interfaces/IProjectService";
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
      .mockResolvedValue(projects),
    findById: jest
      .fn<Promise<Project | null>, [string, string]>()
      .mockImplementation(
        async (_userId, id) =>
          projects.find((project) => project.id === id) ?? null,
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

describe("AgentService", () => {
  it("lists waiting tasks by status and waitingOn field", async () => {
    const todoService = new TodoService();
    await todoService.create(USER_ID, {
      title: "Follow up with vendor",
      status: "waiting",
      category: "Ops",
    });
    await todoService.create(USER_ID, {
      title: "Await signed contract",
      waitingOn: "Legal team",
      category: "Ops",
    });
    await todoService.create(USER_ID, {
      title: "Regular next action",
      status: "next",
      category: "Ops",
    });

    const agentService = new AgentService({ todoService });
    const tasks = await agentService.listWaitingOn(USER_ID, {});

    expect(tasks.map((task) => task.title)).toEqual(
      expect.arrayContaining([
        "Follow up with vendor",
        "Await signed contract",
      ]),
    );
    expect(tasks).toHaveLength(2);
  });

  it("lists today tasks from due and scheduled dates", async () => {
    const todoService = new TodoService();
    const now = new Date();
    const todayMidday = new Date(now);
    todayMidday.setHours(12, 0, 0, 0);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);

    await todoService.create(USER_ID, {
      title: "Due today",
      dueDate: todayMidday,
    });
    await todoService.create(USER_ID, {
      title: "Scheduled today",
      scheduledDate: todayMidday,
    });
    await todoService.create(USER_ID, {
      title: "Later this week",
      dueDate: tomorrow,
    });

    const agentService = new AgentService({ todoService });
    const tasks = await agentService.listToday(USER_ID, {
      includeOverdue: true,
      includeCompleted: false,
    });

    expect(tasks.map((task) => task.title)).toEqual(
      expect.arrayContaining(["Due today", "Scheduled today"]),
    );
    expect(tasks.map((task) => task.title)).not.toContain("Later this week");
  });

  it("lists upcoming tasks within the requested horizon", async () => {
    const todoService = new TodoService();
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    const later = new Date();
    later.setDate(later.getDate() + 10);

    await todoService.create(USER_ID, {
      title: "Soon due",
      dueDate: soon,
    });
    await todoService.create(USER_ID, {
      title: "Soon scheduled",
      scheduledDate: soon,
    });
    await todoService.create(USER_ID, {
      title: "Much later",
      dueDate: later,
    });

    const agentService = new AgentService({ todoService });
    const tasks = await agentService.listUpcoming(USER_ID, {
      days: 7,
      includeScheduled: true,
      includeDue: true,
    });

    expect(tasks.map((task) => task.title)).toEqual(
      expect.arrayContaining(["Soon due", "Soon scheduled"]),
    );
    expect(tasks.map((task) => task.title)).not.toContain("Much later");
  });

  it("lists active projects without a next action", async () => {
    const todoService = new TodoService();
    const projects = [
      makeProject("project-1", "Work"),
      makeProject("project-2", "Personal"),
      makeProject("project-3", "Paused", { status: "on_hold" }),
    ];
    const projectService = createProjectServiceMock(projects);

    await todoService.create(USER_ID, {
      title: "Work next action",
      category: "Work",
      status: "next",
    });
    await todoService.create(USER_ID, {
      title: "Personal waiting task",
      category: "Personal",
      status: "waiting",
    });

    const agentService = new AgentService({ todoService, projectService });
    const withoutNextAction = await agentService.listProjectsWithoutNextAction(
      USER_ID,
      { includeOnHold: false },
    );

    expect(withoutNextAction.map((project) => project.name)).toEqual([
      "Personal",
    ]);
  });
});
