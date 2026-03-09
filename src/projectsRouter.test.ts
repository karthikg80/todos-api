import request from "supertest";
import { createApp } from "./app";
import { TodoService } from "./services/todoService";
import type { Express } from "express";
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
    create: jest.fn<Promise<Project>, [string, CreateProjectDto]>(),
    update: jest.fn<
      Promise<Project | null>,
      [string, string, UpdateProjectDto]
    >(),
    delete: jest.fn<
      Promise<boolean>,
      [string, string, ProjectTaskDisposition]
    >(),
  };
}

describe("Projects router", () => {
  let app: Express;
  let projectService: jest.Mocked<IProjectService>;

  beforeEach(() => {
    projectService = createProjectServiceMock();
    app = createApp(
      new TodoService(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      projectService,
    );
  });

  it("passes unsorted disposition by default when deleting a project", async () => {
    projectService.delete.mockResolvedValue(true);

    await request(app)
      .delete("/projects/00000000-0000-1000-8000-000000000000")
      .expect(204);

    expect(projectService.delete).toHaveBeenCalledWith(
      "default-user",
      "00000000-0000-1000-8000-000000000000",
      "unsorted",
    );
  });

  it("passes delete disposition when requested", async () => {
    projectService.delete.mockResolvedValue(true);

    await request(app)
      .delete("/projects/00000000-0000-1000-8000-000000000000")
      .query({ taskDisposition: "delete" })
      .expect(204);

    expect(projectService.delete).toHaveBeenCalledWith(
      "default-user",
      "00000000-0000-1000-8000-000000000000",
      "delete",
    );
  });

  it("rejects invalid delete disposition values", async () => {
    await request(app)
      .delete("/projects/00000000-0000-1000-8000-000000000000")
      .query({ taskDisposition: "archive" })
      .expect(400);

    expect(projectService.delete).not.toHaveBeenCalled();
  });
});
