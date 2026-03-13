import type { IPlannerService } from "../interfaces/IPlannerService";
import type { IProjectService } from "../interfaces/IProjectService";
import type { ITodoService } from "../interfaces/ITodoService";
import type {
  AnalyzeProjectHealthInput,
  AnalyzeProjectHealthResult,
  AnalyzeWorkGraphInput,
  AnalyzeWorkGraphResult,
  DecideNextWorkInput,
  DecideNextWorkResult,
  EnsureNextActionInput,
  EnsureNextActionResult,
  PlanProjectInput,
  PlanProjectResult,
  WeeklyReviewAction,
  WeeklyReviewInput,
  WeeklyReviewResult,
} from "../types/plannerTypes";
import { DecisionEngine } from "./planner/decisionEngine";
import { ProjectPlanningEngine } from "./planner/projectPlanningEngine";
import { projectTasksForProject } from "./planner/plannerHeuristics";
import { ReviewEngine } from "./planner/reviewEngine";
import { WorkGraphEngine } from "./planner/workGraphEngine";

interface PlannerServiceDeps {
  projectService?: IProjectService;
  todoService: ITodoService;
  projectPlanningEngine?: ProjectPlanningEngine;
  reviewEngine?: ReviewEngine;
  decisionEngine?: DecisionEngine;
  workGraphEngine?: WorkGraphEngine;
}

export class PlannerService implements IPlannerService {
  private readonly projectPlanningEngine: ProjectPlanningEngine;
  private readonly reviewEngine: ReviewEngine;
  private readonly decisionEngine: DecisionEngine;
  private readonly workGraphEngine: WorkGraphEngine;

  constructor(private readonly deps: PlannerServiceDeps) {
    this.projectPlanningEngine =
      deps.projectPlanningEngine || new ProjectPlanningEngine();
    this.reviewEngine =
      deps.reviewEngine ||
      new ReviewEngine({
        projectPlanningEngine: this.projectPlanningEngine,
      });
    this.decisionEngine = deps.decisionEngine || new DecisionEngine();
    this.workGraphEngine = deps.workGraphEngine || new WorkGraphEngine();
  }

  private getProjectService(): IProjectService {
    if (!this.deps.projectService) {
      throw new Error("Projects not configured");
    }
    return this.deps.projectService;
  }

  private async loadProjectContext(userId: string, projectId: string) {
    const projectService = this.getProjectService();
    const project = await projectService.findById(userId, projectId);
    if (!project) {
      return null;
    }
    const tasks = await this.deps.todoService.findAll(userId, {
      archived: false,
    });
    return {
      project,
      tasks,
      projectTasks: projectTasksForProject(project, tasks),
    };
  }

  async planProject(
    input: PlanProjectInput,
  ): Promise<PlanProjectResult | null> {
    const mode = input.mode || "suggest";
    const context = await this.loadProjectContext(
      input.userId,
      input.projectId,
    );
    if (!context) {
      return null;
    }

    const goal =
      String(
        input.goal ||
          context.project.goal ||
          context.project.description ||
          context.project.name,
      ).trim() || context.project.name;
    const suggestedTasks = this.projectPlanningEngine.planProject({
      project: context.project,
      tasks: context.projectTasks,
      goal,
      constraints: input.constraints || [],
    });

    if (mode !== "apply") {
      return {
        project: {
          id: context.project.id,
          name: context.project.name,
        },
        summary: suggestedTasks.length
          ? `Generated ${suggestedTasks.length} planning steps for ${context.project.name}.`
          : `No additional planning steps are needed for ${context.project.name}.`,
        suggestedTasks,
        createdTaskIds: [],
      };
    }

    const createdTaskIds: string[] = [];
    for (const suggestion of suggestedTasks) {
      const createdTask = await this.deps.todoService.create(input.userId, {
        title: suggestion.title,
        description: suggestion.description ?? null,
        projectId: context.project.id,
        status: suggestion.status ?? "next",
        priority: suggestion.priority ?? "medium",
      });
      createdTaskIds.push(createdTask.id);
    }

    return {
      project: {
        id: context.project.id,
        name: context.project.name,
      },
      summary: createdTaskIds.length
        ? `Created ${createdTaskIds.length} planning tasks for ${context.project.name}.`
        : `No new planning tasks were needed for ${context.project.name}.`,
      suggestedTasks,
      createdTaskIds,
    };
  }

  async ensureNextAction(
    input: EnsureNextActionInput,
  ): Promise<EnsureNextActionResult | null> {
    const mode = input.mode || "suggest";
    const context = await this.loadProjectContext(
      input.userId,
      input.projectId,
    );
    if (!context) {
      return null;
    }

    const planningResult = this.projectPlanningEngine.ensureNextAction({
      project: context.project,
      tasks: context.projectTasks,
    });
    const existing = planningResult.existingTask;
    if (existing) {
      return {
        projectId: context.project.id,
        hasNextAction: true,
        created: false,
        task: {
          id: existing.id,
          title: existing.title,
          status: existing.status === "in_progress" ? "in_progress" : "next",
        },
        reason: "The project already has an actionable next step.",
      };
    }

    const suggestion = planningResult.suggestion;
    if (!suggestion) {
      return {
        projectId: context.project.id,
        hasNextAction: false,
        created: false,
        task: null,
        reason:
          "No concrete next action could be derived from the current project state.",
      };
    }

    if (mode !== "apply") {
      return {
        projectId: context.project.id,
        hasNextAction: false,
        created: false,
        task: {
          id: null,
          title: suggestion.title,
          status: "next",
        },
        reason: suggestion.reason,
      };
    }

    const createdTask = await this.deps.todoService.create(input.userId, {
      title: suggestion.title,
      description: suggestion.description ?? null,
      projectId: context.project.id,
      status: suggestion.status ?? "next",
      priority: suggestion.priority ?? "medium",
    });

    return {
      projectId: context.project.id,
      hasNextAction: true,
      created: true,
      task: {
        id: createdTask.id,
        title: createdTask.title,
        status: createdTask.status === "in_progress" ? "in_progress" : "next",
      },
      reason: suggestion.reason,
    };
  }

  async weeklyReview(input: WeeklyReviewInput): Promise<WeeklyReviewResult> {
    const mode = input.mode || "suggest";
    const includeArchived = input.includeArchived === true;
    const projectService = this.getProjectService();
    const [projects, activeTasks, archivedTasks] = await Promise.all([
      projectService.findAll(input.userId),
      this.deps.todoService.findAll(input.userId, {
        archived: false,
      }),
      includeArchived
        ? this.deps.todoService.findAll(input.userId, {
            archived: true,
          })
        : Promise.resolve([]),
    ]);
    const tasks = includeArchived
      ? [...activeTasks, ...archivedTasks]
      : activeTasks;

    const base = this.reviewEngine.weeklyReview({
      projects,
      tasks,
      now: new Date(),
      includeArchived,
      staleTaskDays: 30,
      upcomingDays: 7,
    });

    if (mode !== "apply") {
      return {
        summary: base.summary,
        findings: base.findings,
        recommendedActions: base.recommendedActions,
        appliedActions: [],
      };
    }

    const appliedActions: WeeklyReviewAction[] = [];
    for (const action of base.recommendedActions) {
      if (action.type !== "create_next_action" || !action.projectId) {
        continue;
      }
      const ensured = await this.ensureNextAction({
        userId: input.userId,
        projectId: action.projectId,
        mode: "apply",
      });
      if (!ensured?.created || !ensured.task?.id) {
        continue;
      }
      appliedActions.push({
        ...action,
        createdTaskId: ensured.task.id,
      });
    }

    return {
      summary: base.summary,
      findings: base.findings,
      recommendedActions: base.recommendedActions,
      appliedActions,
    };
  }

  async decideNextWork(
    input: DecideNextWorkInput,
  ): Promise<DecideNextWorkResult> {
    const projectService = this.deps.projectService;
    const [tasks, projects] = await Promise.all([
      this.deps.todoService.findAll(input.userId, {
        archived: false,
      }),
      projectService
        ? projectService.findAll(input.userId)
        : Promise.resolve([]),
    ]);

    return this.decisionEngine.decideNextWork({
      projects,
      tasks,
      now: new Date(),
      availableMinutes: input.availableMinutes,
      energy: input.energy,
      context: input.context || [],
    });
  }

  async analyzeProjectHealth(
    input: AnalyzeProjectHealthInput,
  ): Promise<AnalyzeProjectHealthResult | null> {
    const context = await this.loadProjectContext(
      input.userId,
      input.projectId,
    );
    if (!context) {
      return null;
    }

    return this.reviewEngine.analyzeProjectHealth({
      project: context.project,
      tasks: context.projectTasks,
      now: new Date(),
    });
  }

  async analyzeWorkGraph(
    input: AnalyzeWorkGraphInput,
  ): Promise<AnalyzeWorkGraphResult | null> {
    const context = await this.loadProjectContext(
      input.userId,
      input.projectId,
    );
    if (!context) {
      return null;
    }

    return this.workGraphEngine.analyzeWorkGraph({
      projectTasks: context.projectTasks,
      allTasks: context.tasks,
    });
  }
}
