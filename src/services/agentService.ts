import { IProjectService } from "../interfaces/IProjectService";
import { ITodoService } from "../interfaces/ITodoService";
import {
  CreateProjectDto,
  CreateTodoDto,
  FindTodosQuery,
  Project,
  Todo,
  UpdateProjectDto,
  UpdateTodoDto,
} from "../types";

interface AgentServiceDeps {
  todoService: ITodoService;
  projectService?: IProjectService;
}

export class AgentService {
  constructor(private readonly deps: AgentServiceDeps) {}

  async listTasks(userId: string, query: FindTodosQuery): Promise<Todo[]> {
    return this.deps.todoService.findAll(userId, query);
  }

  async searchTasks(userId: string, query: FindTodosQuery): Promise<Todo[]> {
    return this.deps.todoService.findAll(userId, query);
  }

  async getTask(userId: string, id: string): Promise<Todo | null> {
    return this.deps.todoService.findById(userId, id);
  }

  async createTask(userId: string, dto: CreateTodoDto): Promise<Todo> {
    return this.deps.todoService.create(userId, dto);
  }

  async updateTask(
    userId: string,
    id: string,
    dto: UpdateTodoDto,
  ): Promise<Todo | null> {
    return this.deps.todoService.update(userId, id, dto);
  }

  async completeTask(
    userId: string,
    id: string,
    completed: boolean,
  ): Promise<Todo | null> {
    return this.deps.todoService.update(userId, id, { completed });
  }

  async listProjects(userId: string): Promise<Project[]> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    return this.deps.projectService.findAll(userId);
  }

  async createProject(userId: string, dto: CreateProjectDto): Promise<Project> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    return this.deps.projectService.create(userId, dto);
  }

  async updateProject(
    userId: string,
    id: string,
    dto: UpdateProjectDto,
  ): Promise<Project | null> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    return this.deps.projectService.update(userId, id, dto);
  }

  async deleteProject(
    userId: string,
    id: string,
    moveTasksToProjectId?: string | null,
  ): Promise<boolean> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    return this.deps.projectService.delete(
      userId,
      id,
      "unsorted",
      moveTasksToProjectId,
    );
  }

  async moveTaskToProject(
    userId: string,
    taskId: string,
    projectId: string | null,
  ): Promise<Todo | null> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }

    let category: string | null = null;
    if (projectId) {
      const project = await this.deps.projectService.findById(
        userId,
        projectId,
      );
      if (!project) {
        return null;
      }
      category = project.name;
    }

    return this.deps.todoService.update(userId, taskId, {
      category,
      headingId: null,
    });
  }

  async archiveProject(
    userId: string,
    id: string,
    archived: boolean,
  ): Promise<Project | null> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    return this.deps.projectService.setArchived(userId, id, archived);
  }
}
