import { IProjectService } from "../interfaces/IProjectService";
import { IPlannerService } from "../interfaces/IPlannerService";
import { ITodoService } from "../interfaces/ITodoService";
import { PlannerService } from "./plannerService";
import {
  CreateProjectDto,
  CreateSubtaskDto,
  CreateTodoDto,
  Energy,
  FindTodosQuery,
  Project,
  Subtask,
  Todo,
  UpdateProjectDto,
  UpdateSubtaskDto,
  UpdateTodoDto,
} from "../types";
import {
  AnalyzeProjectHealthResult,
  AnalyzeWorkGraphResult,
  DecideNextWorkResult,
  EnsureNextActionResult,
  PlanProjectResult,
  WeeklyReviewResult,
} from "../types/plannerTypes";
import { applyLegacyCategoryProjectWriteCompatibility } from "./projectWriteCompatibility";

interface AgentServiceDeps {
  todoService: ITodoService;
  projectService?: IProjectService;
  plannerService?: IPlannerService;
}

export class AgentService {
  private readonly plannerService?: IPlannerService;

  constructor(private readonly deps: AgentServiceDeps) {
    this.plannerService =
      deps.plannerService ||
      (deps.projectService
        ? new PlannerService({
            todoService: deps.todoService,
            projectService: deps.projectService,
          })
        : undefined);
  }

  private startOfDay(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  private endOfDay(date: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999,
    );
  }

  private projectMatchesTask(project: Project, task: Todo): boolean {
    return task.projectId === project.id;
  }

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
    const compatibleDto = await applyLegacyCategoryProjectWriteCompatibility(
      userId,
      dto,
      this.deps.projectService,
    );
    return this.deps.todoService.create(userId, compatibleDto);
  }

  async updateTask(
    userId: string,
    id: string,
    dto: UpdateTodoDto,
  ): Promise<Todo | null> {
    const compatibleDto = await applyLegacyCategoryProjectWriteCompatibility(
      userId,
      dto,
      this.deps.projectService,
    );
    return this.deps.todoService.update(userId, id, compatibleDto);
  }

  async completeTask(
    userId: string,
    id: string,
    completed: boolean,
  ): Promise<Todo | null> {
    return this.deps.todoService.update(userId, id, { completed });
  }

  async archiveTask(
    userId: string,
    id: string,
    archived: boolean,
  ): Promise<Todo | null> {
    return this.deps.todoService.update(userId, id, { archived });
  }

  async deleteTask(
    userId: string,
    id: string,
    hardDelete: boolean,
  ): Promise<boolean | Todo | null> {
    if (hardDelete) {
      return this.deps.todoService.delete(userId, id);
    }
    return this.deps.todoService.update(userId, id, { archived: true });
  }

  async addSubtask(
    userId: string,
    taskId: string,
    dto: CreateSubtaskDto,
  ): Promise<Subtask | null> {
    return this.deps.todoService.createSubtask(userId, taskId, dto);
  }

  async updateSubtask(
    userId: string,
    taskId: string,
    subtaskId: string,
    dto: UpdateSubtaskDto,
  ): Promise<Subtask | null> {
    return this.deps.todoService.updateSubtask(userId, taskId, subtaskId, dto);
  }

  async deleteSubtask(
    userId: string,
    taskId: string,
    subtaskId: string,
  ): Promise<boolean> {
    return this.deps.todoService.deleteSubtask(userId, taskId, subtaskId);
  }

  async listProjects(
    userId: string,
    filters?: {
      statuses?: Project["status"][];
      archived?: boolean;
      reviewCadences?: Project["reviewCadence"][];
    },
  ): Promise<Project[]> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    let projects = await this.deps.projectService.findAll(userId);
    if (filters?.statuses?.length) {
      projects = projects.filter((project) =>
        filters.statuses?.includes(project.status),
      );
    }
    if (filters?.archived !== undefined) {
      projects = projects.filter(
        (project) => project.archived === filters.archived,
      );
    }
    if (filters?.reviewCadences?.length) {
      projects = projects.filter((project) =>
        project.reviewCadence
          ? filters.reviewCadences?.includes(project.reviewCadence)
          : false,
      );
    }
    return projects;
  }

  async createProject(userId: string, dto: CreateProjectDto): Promise<Project> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    return this.deps.projectService.create(userId, dto);
  }

  async getProject(userId: string, id: string): Promise<Project | null> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    return this.deps.projectService.findById(userId, id);
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

  async renameProject(
    userId: string,
    id: string,
    name: string,
  ): Promise<Project | null> {
    return this.updateProject(userId, id, { name });
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
    let category: string | null | undefined = undefined;
    if (projectId !== null) {
      if (!this.deps.projectService) {
        throw new Error("Projects not configured");
      }
      const project = await this.deps.projectService.findById(
        userId,
        projectId,
      );
      if (!project) {
        return null;
      }
      category = project.name;
    } else {
      category = null;
    }

    return this.deps.todoService.update(userId, taskId, {
      projectId,
      ...(category !== undefined ? { category } : {}),
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

  async listToday(
    userId: string,
    input: { includeOverdue: boolean; includeCompleted: boolean },
  ): Promise<Todo[]> {
    const now = new Date();
    const start = this.startOfDay(now);
    const end = this.endOfDay(now);
    const tasks = await this.deps.todoService.findAll(userId, {
      archived: false,
      ...(input.includeCompleted ? {} : { completed: false }),
    });
    return tasks.filter((task) => {
      const dueDate = task.dueDate;
      const scheduledDate = task.scheduledDate;
      const dueMatch =
        !!dueDate &&
        dueDate <= end &&
        (input.includeOverdue || dueDate >= start);
      const scheduledMatch =
        !!scheduledDate && scheduledDate >= start && scheduledDate <= end;
      return dueMatch || scheduledMatch;
    });
  }

  async listNextActions(
    userId: string,
    input: {
      projectId?: string | null;
      contexts?: string[];
      energies?: string[];
      limit?: number;
    },
  ): Promise<Todo[]> {
    const tasks = await this.deps.todoService.findAll(userId, {
      archived: false,
      completed: false,
      statuses: ["next", "in_progress"],
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.contexts?.length ? { contexts: input.contexts } : {}),
      ...(input.energies?.length
        ? { energies: input.energies as Energy[] }
        : {}),
    });
    return typeof input.limit === "number"
      ? tasks.slice(0, input.limit)
      : tasks;
  }

  async listWaitingOn(
    userId: string,
    input: { projectId?: string | null },
  ): Promise<Todo[]> {
    const tasks = await this.deps.todoService.findAll(userId, {
      archived: false,
      completed: false,
      ...(input.projectId ? { projectId: input.projectId } : {}),
    });
    return tasks.filter(
      (task) =>
        task.status === "waiting" ||
        Boolean(String(task.waitingOn || "").trim()),
    );
  }

  async listUpcoming(
    userId: string,
    input: { days: number; includeScheduled: boolean; includeDue: boolean },
  ): Promise<Todo[]> {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + input.days);
    const tasks = await this.deps.todoService.findAll(userId, {
      archived: false,
      completed: false,
      ...(input.includeDue ? { dueDateTo: end } : {}),
      ...(input.includeScheduled ? { scheduledDateTo: end } : {}),
    });
    return tasks.filter((task) => {
      const dueMatch =
        input.includeDue && !!task.dueDate && task.dueDate <= end;
      const scheduledMatch =
        input.includeScheduled &&
        !!task.scheduledDate &&
        task.scheduledDate <= end;
      return Boolean(dueMatch || scheduledMatch);
    });
  }

  async listStaleTasks(
    userId: string,
    input: { daysSinceUpdate: number; completed: boolean },
  ): Promise<Todo[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - input.daysSinceUpdate);
    return this.deps.todoService.findAll(userId, {
      archived: false,
      completed: input.completed,
      updatedBefore: cutoff,
    });
  }

  async listProjectsWithoutNextAction(
    userId: string,
    input: { includeOnHold: boolean },
  ): Promise<Project[]> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    const [projects, tasks] = await Promise.all([
      this.deps.projectService.findAll(userId),
      this.deps.todoService.findAll(userId, {
        archived: false,
        completed: false,
      }),
    ]);
    return projects.filter((project) => {
      if (project.archived || project.status === "archived") {
        return false;
      }
      if (!input.includeOnHold && project.status === "on_hold") {
        return false;
      }
      return !tasks.some(
        (task) =>
          this.projectMatchesTask(project, task) &&
          (task.status === "next" || task.status === "in_progress"),
      );
    });
  }

  async reviewProjects(
    userId: string,
    input: { dueForReviewOnly: boolean },
  ): Promise<Project[]> {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    const now = new Date();
    const cadenceDays: Record<string, number> = {
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      quarterly: 90,
    };
    const projects = await this.deps.projectService.findAll(userId);
    return projects.filter((project) => {
      if (project.archived || project.status === "archived") {
        return false;
      }
      if (!input.dueForReviewOnly) {
        return true;
      }
      if (!project.reviewCadence) {
        return false;
      }
      const lastReviewedAt = project.lastReviewedAt || project.createdAt;
      const nextReview = new Date(lastReviewedAt);
      nextReview.setDate(
        nextReview.getDate() + cadenceDays[project.reviewCadence],
      );
      return nextReview <= now;
    });
  }

  async planProjectForUser(
    userId: string,
    input: {
      projectId: string;
      goal?: string | null;
      constraints?: string[];
      mode?: "suggest" | "apply";
    },
  ): Promise<PlanProjectResult | null> {
    if (!this.plannerService) {
      throw new Error("Projects not configured");
    }
    return this.plannerService.planProject({
      userId,
      projectId: input.projectId,
      goal: input.goal,
      constraints: input.constraints,
      mode: input.mode,
    });
  }

  async ensureNextActionForUser(
    userId: string,
    input: {
      projectId: string;
      mode?: "suggest" | "apply";
    },
  ): Promise<EnsureNextActionResult | null> {
    if (!this.plannerService) {
      throw new Error("Projects not configured");
    }
    return this.plannerService.ensureNextAction({
      userId,
      projectId: input.projectId,
      mode: input.mode,
    });
  }

  async weeklyReviewForUser(
    userId: string,
    input: {
      mode?: "suggest" | "apply";
      includeArchived?: boolean;
    },
  ): Promise<WeeklyReviewResult> {
    if (!this.plannerService) {
      throw new Error("Projects not configured");
    }
    return this.plannerService.weeklyReview({
      userId,
      mode: input.mode,
      includeArchived: input.includeArchived,
    });
  }

  async decideNextWorkForUser(
    userId: string,
    input: {
      availableMinutes?: number | null;
      energy?: Energy | null;
      context?: string[];
      mode?: "suggest" | "apply";
      weights?: { priority?: number; dueDate?: number; energyMatch?: number };
      goalIndex?: Map<string, { targetDate: Date | null }>;
    },
  ): Promise<DecideNextWorkResult> {
    if (!this.plannerService) {
      throw new Error("Projects not configured");
    }
    return this.plannerService.decideNextWork({
      userId,
      availableMinutes: input.availableMinutes,
      energy: input.energy,
      context: input.context,
      mode: input.mode,
      weights: input.weights,
      goalIndex: input.goalIndex,
    });
  }

  async analyzeProjectHealthForUser(
    userId: string,
    input: { projectId: string },
  ): Promise<AnalyzeProjectHealthResult | null> {
    if (!this.plannerService) {
      throw new Error("Projects not configured");
    }
    return this.plannerService.analyzeProjectHealth({
      userId,
      projectId: input.projectId,
    });
  }

  async analyzeWorkGraphForUser(
    userId: string,
    input: { projectId: string },
  ): Promise<AnalyzeWorkGraphResult | null> {
    if (!this.plannerService) {
      throw new Error("Projects not configured");
    }
    return this.plannerService.analyzeWorkGraph({
      userId,
      projectId: input.projectId,
    });
  }
}
