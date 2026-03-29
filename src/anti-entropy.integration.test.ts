import request from "supertest";
import type { Express } from "express";
import { createApp } from "./app";
import { TodoService } from "./services/todoService";
import type { IProjectService } from "./interfaces/IProjectService";
import type {
  CreateProjectDto,
  Project,
  ProjectTaskDisposition,
  UpdateProjectDto,
} from "./types";

const USER_ID = "default-user";

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
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
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

describe("Anti-entropy analyzers", () => {
  let app: Express;
  let todoService: TodoService;
  let projectService: jest.Mocked<IProjectService>;

  beforeEach(() => {
    todoService = new TodoService();
    projectService = createProjectServiceMock([]);
    app = createApp({ todoService, projectService });
  });

  describe("analyze_task_quality", () => {
    it("returns results array in structured envelope", async () => {
      await request(app)
        .post("/todos")
        .send({ title: "Fix the login bug" })
        .expect(201);

      const response = await request(app)
        .post("/agent/read/analyze_task_quality")
        .send({})
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.action).toBe("analyze_task_quality");
      expect(response.body.readOnly).toBe(true);
      expect(Array.isArray(response.body.data.results)).toBe(true);
    });

    it("flags a vague task title without an action verb", async () => {
      const created = await request(app)
        .post("/todos")
        .send({ title: "The login situation" })
        .expect(201);

      const response = await request(app)
        .post("/agent/read/analyze_task_quality")
        .send({ taskIds: [created.body.id] })
        .expect(200);

      const results = response.body.data.results as Array<{
        id: string;
        qualityScore: number;
        issues: string[];
      }>;
      expect(results).toHaveLength(1);
      const result = results[0];
      expect(result.qualityScore).toBeLessThan(5);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes("action verb"))).toBe(true);
    });

    it("gives a good score to a well-formed task", async () => {
      const created = await request(app)
        .post("/todos")
        .send({ title: "Review quarterly report" })
        .expect(201);

      const response = await request(app)
        .post("/agent/read/analyze_task_quality")
        .send({ taskIds: [created.body.id] })
        .expect(200);

      const results = response.body.data.results as Array<{
        qualityScore: number;
      }>;
      expect(results[0].qualityScore).toBeGreaterThanOrEqual(4);
    });

    it("rejects taskIds that are not strings", async () => {
      const response = await request(app)
        .post("/agent/read/analyze_task_quality")
        .send({ taskIds: [123] })
        .expect(400);

      expect(response.body.ok).toBe(false);
    });
  });

  describe("find_duplicate_tasks", () => {
    it("returns groups array in structured envelope", async () => {
      const response = await request(app)
        .post("/agent/read/find_duplicate_tasks")
        .send({})
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.action).toBe("find_duplicate_tasks");
      expect(response.body.readOnly).toBe(true);
      expect(Array.isArray(response.body.data.groups)).toBe(true);
    });

    it("finds exact duplicate tasks", async () => {
      await request(app)
        .post("/todos")
        .send({ title: "Buy groceries" })
        .expect(201);
      await request(app)
        .post("/todos")
        .send({ title: "Buy groceries" })
        .expect(201);

      const response = await request(app)
        .post("/agent/read/find_duplicate_tasks")
        .send({ scope: "active" })
        .expect(200);

      const groups = response.body.data.groups as Array<{
        confidence: number;
        reason: string;
        tasks: Array<{ id: string; title: string }>;
        suggestedAction: string;
      }>;

      expect(groups.length).toBeGreaterThanOrEqual(1);
      const exactMatch = groups.find((g) => g.confidence === 1.0);
      expect(exactMatch).toBeDefined();
      expect(exactMatch?.reason).toBe("Exact title match");
      expect(exactMatch?.suggestedAction).toBe("archive-older");
    });

    it("scopes to active tasks by default", async () => {
      await request(app)
        .post("/todos")
        .send({ title: "Call dentist" })
        .expect(201);
      await request(app)
        .post("/todos")
        .send({ title: "Call dentist" })
        .expect(201);

      // default scope = active — should still find duplicates
      const response = await request(app)
        .post("/agent/read/find_duplicate_tasks")
        .send({})
        .expect(200);

      expect(response.body.data.groups.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("find_stale_items", () => {
    it("returns correct structure in envelope", async () => {
      const response = await request(app)
        .post("/agent/read/find_stale_items")
        .send({})
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.action).toBe("find_stale_items");
      expect(response.body.readOnly).toBe(true);
      // Without prisma, throws "Projects not configured"
      // but structure is validated in agentService; here test just checks route responds
      // In environments without prisma the call returns error envelope
      // So we just check the envelope contract exists
      expect(typeof response.body.ok).toBe("boolean");
    });
  });

  describe("taxonomy_cleanup_suggestions", () => {
    it("returns correct structure in envelope", async () => {
      const response = await request(app)
        .post("/agent/read/taxonomy_cleanup_suggestions")
        .send({})
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.action).toBe("taxonomy_cleanup_suggestions");
      expect(response.body.readOnly).toBe(true);
      // Without prisma, throws "Projects not configured"
      // Similar to find_stale_items; check envelope contract
      expect(typeof response.body.ok).toBe("boolean");
    });
  });
});
