import request from "supertest";
import type { Express } from "express";
import { createApp } from "./app";
import { AuthService } from "./services/authService";
import { TodoService } from "./services/todoService";
import type { IProjectService } from "./interfaces/IProjectService";
import type {
  CreateProjectDto,
  Project,
  ProjectTaskDisposition,
  UpdateProjectDto,
} from "./types";

function createProjectServiceMock(): jest.Mocked<IProjectService> {
  return {
    findAll: jest.fn<Promise<Project[]>, [string]>(),
    findById: jest.fn<Promise<Project | null>, [string, string]>(),
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

describe("Agent router", () => {
  let app: Express;
  let todoService: TodoService;
  let projectService: jest.Mocked<IProjectService>;

  beforeEach(() => {
    todoService = new TodoService();
    projectService = createProjectServiceMock();
    app = createApp(
      todoService,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      projectService,
    );
  });

  it("returns the runtime manifest with enabled project actions", async () => {
    const response = await request(app).get("/agent/manifest").expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.action).toBe("manifest");
    expect(response.body.data.manifest.basePath).toBe("/agent");
    expect(
      response.body.data.manifest.definitions.todo.properties.status,
    ).toEqual(
      expect.objectContaining({
        $ref: "#/definitions/taskStatus",
      }),
    );
    expect(response.body.data.manifest.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "create_project",
          enabled: true,
          readOnly: false,
        }),
        expect.objectContaining({
          name: "archive_task",
          enabled: true,
          readOnly: false,
        }),
        expect.objectContaining({
          name: "list_today",
          enabled: true,
          readOnly: true,
        }),
      ]),
    );
  });

  it("lists tasks through the read surface with a structured envelope", async () => {
    await request(app)
      .post("/todos")
      .send({ title: "Ship report", category: "Work" })
      .expect(201);
    await request(app)
      .post("/todos")
      .send({ title: "Home errand", category: "Home" })
      .expect(201);

    const response = await request(app)
      .post("/agent/read/list_tasks")
      .send({ project: "Work" })
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.action).toBe("list_tasks");
    expect(response.body.readOnly).toBe(true);
    expect(response.body.data.tasks).toHaveLength(1);
    expect(response.body.data.tasks[0].title).toBe("Ship report");
    expect(response.body.trace.requestId).toBeDefined();
  });

  it("returns structured validation errors for unsupported fields", async () => {
    const response = await request(app)
      .post("/agent/read/list_tasks")
      .send({ bogus: true })
      .expect(400);

    expect(response.body.ok).toBe(false);
    expect(response.body.action).toBe("list_tasks");
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(response.body.error.retryable).toBe(false);
    expect(response.body.error.hint).toContain("/agent/manifest");
  });

  it("replays create_task responses for matching idempotency keys", async () => {
    const firstResponse = await request(app)
      .post("/agent/write/create_task")
      .set("Idempotency-Key", "task-create-1")
      .set("X-Agent-Name", "codex-test")
      .send({ title: "Agent created task" })
      .expect(201);

    const replayResponse = await request(app)
      .post("/agent/write/create_task")
      .set("Idempotency-Key", "task-create-1")
      .set("X-Agent-Name", "codex-test")
      .send({ title: "Agent created task" })
      .expect(201);

    expect(firstResponse.body.ok).toBe(true);
    expect(replayResponse.body.ok).toBe(true);
    expect(replayResponse.body.data.task.id).toBe(
      firstResponse.body.data.task.id,
    );
    expect(replayResponse.body.trace.replayed).toBe(true);
    expect(replayResponse.body.trace.originalRequestId).toBe(
      firstResponse.body.trace.requestId,
    );
  });

  it("returns a structured idempotency conflict for mismatched create_task payloads", async () => {
    await request(app)
      .post("/agent/write/create_task")
      .set("Idempotency-Key", "task-create-2")
      .send({ title: "Original task" })
      .expect(201);

    const response = await request(app)
      .post("/agent/write/create_task")
      .set("Idempotency-Key", "task-create-2")
      .send({ title: "Different task" })
      .expect(409);

    expect(response.body.ok).toBe(false);
    expect(response.body.action).toBe("create_task");
    expect(response.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("logs agent-triggered mutations with request trace metadata", async () => {
    const logSpy = jest.spyOn(console, "info").mockImplementation(() => {});

    await request(app)
      .post("/agent/write/create_task")
      .set("X-Agent-Name", "codex-test")
      .set("X-Agent-Request-Id", "req-123")
      .send({ title: "Logged task" })
      .expect(201);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"agent_action"'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"action":"create_task"'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"req-123"'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"actor":"codex-test"'),
    );

    logSpy.mockRestore();
  });

  it("creates projects through the write surface with idempotency support", async () => {
    projectService.create.mockResolvedValue({
      id: "proj-1",
      name: "Platform",
      status: "active",
      archived: false,
      userId: "default-user",
      createdAt: new Date(),
      updatedAt: new Date(),
      todoCount: 0,
      openTodoCount: 0,
    });

    const firstResponse = await request(app)
      .post("/agent/write/create_project")
      .set("Idempotency-Key", "project-create-1")
      .send({ name: "Platform" })
      .expect(201);

    const replayResponse = await request(app)
      .post("/agent/write/create_project")
      .set("Idempotency-Key", "project-create-1")
      .send({ name: "Platform" })
      .expect(201);

    expect(projectService.create).toHaveBeenCalledTimes(1);
    expect(firstResponse.body.data.project.name).toBe("Platform");
    expect(replayResponse.body.trace.replayed).toBe(true);
  });

  it("returns agent auth errors in the structured action envelope", async () => {
    const authService = {
      verifyToken: jest.fn(),
    } as unknown as AuthService;
    const authedApp = createApp(
      new TodoService(),
      authService,
      undefined,
      undefined,
      undefined,
      undefined,
      projectService,
    );

    const response = await request(authedApp)
      .post("/agent/read/list_tasks")
      .send({})
      .expect(401);

    expect(response.body.ok).toBe(false);
    expect(response.body.action).toBe("list_tasks");
    expect(response.body.readOnly).toBe(true);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
    expect(response.body.trace.requestId).toBeDefined();
  });

  it("rejects invalid project rename input before calling the project service", async () => {
    const response = await request(app)
      .post("/agent/write/update_project")
      .send({
        id: "00000000-0000-1000-8000-000000000000",
        name: "   ",
      })
      .expect(400);

    expect(response.body.ok).toBe(false);
    expect(response.body.action).toBe("update_project");
    expect(response.body.error.code).toBe("INVALID_INPUT");
    expect(projectService.update).not.toHaveBeenCalled();
  });

  it("moves a task to another project through the agent surface", async () => {
    const task = await todoService.create("default-user", {
      title: "Move this task",
    });
    projectService.findById.mockResolvedValue({
      id: "00000000-0000-1000-8000-000000000001",
      name: "Platform",
      status: "active",
      archived: false,
      userId: "default-user",
      createdAt: new Date(),
      updatedAt: new Date(),
      todoCount: 3,
      openTodoCount: 2,
    });

    const response = await request(app)
      .post("/agent/write/move_task_to_project")
      .send({
        taskId: task.id,
        projectId: "00000000-0000-1000-8000-000000000001",
      })
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.data.task.category).toBe("Platform");
    expect(projectService.findById).toHaveBeenCalledWith(
      "default-user",
      "00000000-0000-1000-8000-000000000001",
    );
  });

  it("rejects cross-user project moves through the agent surface", async () => {
    const task = await todoService.create("default-user", {
      title: "Private task",
    });
    projectService.findById.mockResolvedValue(null);

    const response = await request(app)
      .post("/agent/write/move_task_to_project")
      .send({
        taskId: task.id,
        projectId: "00000000-0000-1000-8000-000000000002",
      })
      .expect(404);

    expect(response.body.ok).toBe(false);
    expect(response.body.action).toBe("move_task_to_project");
    expect(response.body.error.code).toBe("RESOURCE_NOT_FOUND_OR_FORBIDDEN");
  });

  it("deletes projects with reassignment through the agent surface", async () => {
    projectService.delete.mockResolvedValue(true);

    const response = await request(app)
      .post("/agent/write/delete_project")
      .send({
        id: "00000000-0000-1000-8000-000000000010",
        moveTasksToProjectId: "00000000-0000-1000-8000-000000000011",
      })
      .expect(200);

    expect(projectService.delete).toHaveBeenCalledWith(
      "default-user",
      "00000000-0000-1000-8000-000000000010",
      "unsorted",
      "00000000-0000-1000-8000-000000000011",
    );
    expect(response.body.data.deleted).toBe(true);
    expect(response.body.data.taskDisposition).toBe("reassigned");
  });

  it("archives projects through the agent surface", async () => {
    projectService.setArchived.mockResolvedValue({
      id: "00000000-0000-1000-8000-000000000020",
      name: "Platform",
      status: "archived",
      archived: true,
      userId: "default-user",
      createdAt: new Date(),
      updatedAt: new Date(),
      todoCount: 4,
      openTodoCount: 2,
    });

    const response = await request(app)
      .post("/agent/write/archive_project")
      .send({
        id: "00000000-0000-1000-8000-000000000020",
        archived: true,
      })
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.data.project.archived).toBe(true);
  });
});
