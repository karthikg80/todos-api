import type { Project, Todo } from "../../types";
import type {
  AnalyzeProjectHealthIntervention,
  AnalyzeProjectHealthResult,
  PlannerFinding,
  WeeklyReviewAnchorSuggestion,
  WeeklyReviewAction,
  WeeklyReviewRolloverGroup,
  WeeklyReviewResult,
} from "../../types/plannerTypes";
import { ProjectPlanningEngine } from "./projectPlanningEngine";
import {
  clampHealthScore,
  isOpenTask,
  projectHasNextAction,
  projectTasksForProject,
} from "./plannerHeuristics";

interface ReviewEngineDeps {
  projectPlanningEngine: ProjectPlanningEngine;
}

export class ReviewEngine {
  constructor(private readonly deps: ReviewEngineDeps) {}

  weeklyReview(input: {
    projects: Project[];
    tasks: Todo[];
    now: Date;
    includeArchived: boolean;
    staleTaskDays: number;
    upcomingDays: number;
  }): Omit<WeeklyReviewResult, "appliedActions"> {
    const activeProjects = input.projects.filter((project) => {
      if (input.includeArchived) {
        return true;
      }
      return !project.archived && project.status !== "archived";
    });
    const activeTasks = input.tasks.filter(
      (task) => !task.archived || input.includeArchived,
    );
    const openTasks = activeTasks.filter(isOpenTask);
    const staleCutoff = new Date(input.now);
    staleCutoff.setDate(staleCutoff.getDate() - input.staleTaskDays);
    const upcomingCutoff = new Date(input.now);
    upcomingCutoff.setDate(upcomingCutoff.getDate() + input.upcomingDays);

    const findings: PlannerFinding[] = [];
    const recommendedActions: WeeklyReviewAction[] = [];
    let projectsWithoutNextAction = 0;

    for (const project of activeProjects) {
      const projectTasks = projectTasksForProject(project, activeTasks);
      const openProjectTasks = projectTasks.filter(isOpenTask);

      if (openProjectTasks.length === 0 && project.status === "active") {
        findings.push({
          type: "empty_active_project",
          projectId: project.id,
          projectName: project.name,
          reason:
            "This active project has no open tasks, so it cannot move forward without a starter action.",
        });
        const nextAction = this.deps.projectPlanningEngine.ensureNextAction({
          project,
          tasks: projectTasks,
        }).suggestion;
        if (nextAction) {
          recommendedActions.push({
            type: "create_next_action",
            projectId: project.id,
            title: nextAction.title,
            reason: nextAction.reason,
          });
        }
        continue;
      }

      if (!projectHasNextAction(projectTasks)) {
        projectsWithoutNextAction += 1;
        findings.push({
          type: "missing_next_action",
          projectId: project.id,
          projectName: project.name,
          reason:
            "The project has open work, but nothing is marked next or in progress.",
        });
        const nextAction = this.deps.projectPlanningEngine.ensureNextAction({
          project,
          tasks: projectTasks,
        }).suggestion;
        if (nextAction) {
          recommendedActions.push({
            type: "create_next_action",
            projectId: project.id,
            title: nextAction.title,
            reason: nextAction.reason,
          });
        }
      }
    }

    const staleTasks = openTasks.filter(
      (task) => task.updatedAt <= staleCutoff,
    );
    staleTasks.forEach((task) => {
      findings.push({
        type: "stale_task",
        projectId: task.projectId || undefined,
        taskId: task.id,
        taskTitle: task.title,
        reason: `This task has not been updated in at least ${input.staleTaskDays} days.`,
      });
      recommendedActions.push({
        type: "review_stale_task",
        projectId: task.projectId || undefined,
        taskId: task.id,
        title: `Review stale task: ${task.title}`,
        reason: "Stale work should be clarified, rescheduled, or closed.",
      });
    });

    const waitingTasks = openTasks.filter(
      (task) =>
        task.status === "waiting" ||
        Boolean(String(task.waitingOn || "").trim()),
    );
    waitingTasks.forEach((task) => {
      findings.push({
        type: "waiting_task",
        projectId: task.projectId || undefined,
        taskId: task.id,
        taskTitle: task.title,
        reason:
          "This task is waiting on an external dependency and needs follow-up.",
      });
      recommendedActions.push({
        type: "follow_up_waiting_task",
        projectId: task.projectId || undefined,
        taskId: task.id,
        title: `Follow up on ${String(task.waitingOn || task.title).trim()}`,
        reason: "Waiting tasks only move when someone explicitly follows up.",
      });
    });

    const upcomingTasks = openTasks.filter((task) => {
      const dueMatch =
        !!task.dueDate &&
        task.dueDate >= input.now &&
        task.dueDate <= upcomingCutoff;
      const scheduledMatch =
        !!task.scheduledDate &&
        task.scheduledDate >= input.now &&
        task.scheduledDate <= upcomingCutoff;
      return dueMatch || scheduledMatch;
    });
    upcomingTasks.forEach((task) => {
      findings.push({
        type: "upcoming_deadline",
        projectId: task.projectId || undefined,
        taskId: task.id,
        taskTitle: task.title,
        reason: `This task is due or scheduled within the next ${input.upcomingDays} days.`,
      });
    });

    const rolloverGroups = this.buildRolloverGroups(openTasks, input.now);
    const anchorSuggestions = this.buildAnchorSuggestions(openTasks, input.now);
    const behaviorAdjustment = this.buildBehaviorAdjustment(
      rolloverGroups,
      openTasks,
    );
    const reflectionSummary = this.buildReflectionSummary(
      openTasks,
      waitingTasks.length,
      staleTasks.length,
      anchorSuggestions,
    );

    return {
      summary: {
        projectsWithoutNextAction,
        staleTasks: staleTasks.length,
        waitingTasks: waitingTasks.length,
        upcomingTasks: upcomingTasks.length,
      },
      findings,
      recommendedActions,
      rolloverGroups,
      anchorSuggestions,
      behaviorAdjustment,
      reflectionSummary,
    };
  }

  private buildRolloverGroups(
    openTasks: Todo[],
    now: Date,
  ): WeeklyReviewRolloverGroup[] {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const staleCutoff = new Date(now);
    staleCutoff.setDate(staleCutoff.getDate() - 30);
    const overdueTasks = openTasks.filter(
      (task) => task.dueDate && task.dueDate < today,
    );
    const staleTasks = openTasks.filter(
      (task) => task.updatedAt <= staleCutoff,
    );

    return [
      {
        key: "do",
        title: "Do this week",
        items: overdueTasks
          .filter((task) => (task.priority ?? "medium") !== "low")
          .slice(0, 4)
          .map((task) => ({
            taskId: task.id,
            title: task.title,
            reason: "It is still waiting and may need a clear restart.",
          })),
      },
      {
        key: "defer",
        title: "Move later",
        items: openTasks
          .filter(
            (task) => task.status === "waiting" || task.status === "scheduled",
          )
          .slice(0, 4)
          .map((task) => ({
            taskId: task.id,
            title: task.title,
            reason: "It looks like a candidate to move with intention.",
          })),
      },
      {
        key: "shrink",
        title: "Make smaller",
        items: openTasks
          .filter(
            (task) =>
              (task.effortScore ?? 0) >= 3 ||
              Boolean(String(task.blockedReason || "").trim()),
          )
          .slice(0, 4)
          .map((task) => ({
            taskId: task.id,
            title: task.title,
            reason: "This may move faster with a smaller first step.",
          })),
      },
      {
        key: "drop",
        title: "Let go",
        items: staleTasks
          .filter((task) => (task.priority ?? "medium") === "low")
          .slice(0, 4)
          .map((task) => ({
            taskId: task.id,
            title: task.title,
            reason:
              "If it no longer matters, it may be okay to let this leave the list.",
          })),
      },
    ];
  }

  private buildAnchorSuggestions(
    openTasks: Todo[],
    now: Date,
  ): WeeklyReviewAnchorSuggestion[] {
    return [...openTasks]
      .sort((a, b) => {
        const aDue = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        const bDue = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
        if (aDue !== bDue) return aDue - bDue;
        const aPriority =
          a.priority === "high" || a.priority === "urgent" ? 1 : 0;
        const bPriority =
          b.priority === "high" || b.priority === "urgent" ? 1 : 0;
        return bPriority - aPriority;
      })
      .slice(0, 5)
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        reason:
          task.dueDate && task.dueDate < now
            ? "A rolled-over item that needs a clean decision."
            : task.status === "in_progress"
              ? "Already moving, so it can anchor momentum."
              : "A good candidate for a smaller focus list next week.",
      }));
  }

  private buildBehaviorAdjustment(
    rolloverGroups: WeeklyReviewRolloverGroup[],
    openTasks: Todo[],
  ): string {
    const shrinkCount =
      rolloverGroups.find((group) => group.key === "shrink")?.items.length ?? 0;
    const waitingCount = openTasks.filter(
      (task) =>
        task.status === "waiting" || String(task.waitingOn || "").trim(),
    ).length;
    if (shrinkCount >= 3) {
      return "Keep next week’s focus list smaller and start the heavier work with a tiny first step.";
    }
    if (waitingCount >= 3) {
      return "Clear the waiting items early so they stop dragging across the week.";
    }
    return "A smaller focus list will probably feel steadier than trying to carry everything forward.";
  }

  private buildReflectionSummary(
    openTasks: Todo[],
    waitingCount: number,
    staleCount: number,
    anchorSuggestions: WeeklyReviewAnchorSuggestion[],
  ): string | null {
    if (openTasks.length === 0) {
      return "Your list looks light right now. Keep next week simple.";
    }
    if (staleCount > 0 && waitingCount > 0) {
      return "The week carried some drag, but you still have a clear chance to reset by shrinking stale work and following up on what is blocked.";
    }
    if (anchorSuggestions.length > 0) {
      return "You kept enough signal in the system to choose a smaller, steadier focus for next week.";
    }
    return null;
  }

  analyzeProjectHealth(input: {
    project: Project;
    tasks: Todo[];
    now: Date;
  }): AnalyzeProjectHealthResult {
    const openTasks = input.tasks.filter(isOpenTask);
    const risks: string[] = [];
    const recommendedInterventions: AnalyzeProjectHealthIntervention[] = [];
    let score = 100;

    if (!openTasks.length && input.project.status === "active") {
      risks.push("No active tasks in this project");
      score -= 30;
      const suggestion = this.deps.projectPlanningEngine.ensureNextAction({
        project: input.project,
        tasks: input.tasks,
      }).suggestion;
      if (suggestion) {
        recommendedInterventions.push({
          type: "create_next_action",
          projectId: input.project.id,
          title: suggestion.title,
          reason: suggestion.reason,
        });
      }
    }

    if (!projectHasNextAction(input.tasks)) {
      risks.push("No next action defined");
      score -= 25;
      const suggestion = this.deps.projectPlanningEngine.ensureNextAction({
        project: input.project,
        tasks: input.tasks,
      }).suggestion;
      if (
        suggestion &&
        !recommendedInterventions.some(
          (item) => item.title === suggestion.title,
        )
      ) {
        recommendedInterventions.push({
          type: "create_next_action",
          projectId: input.project.id,
          title: suggestion.title,
          reason: suggestion.reason,
        });
      }
    }

    const staleCutoff = new Date(input.now);
    staleCutoff.setDate(staleCutoff.getDate() - 30);
    const staleOpenTasks = openTasks.filter(
      (task) => task.updatedAt <= staleCutoff,
    );
    if (staleOpenTasks.length > 0) {
      risks.push("No recent activity");
      score -= 20;
      recommendedInterventions.push({
        type: "review_project",
        projectId: input.project.id,
        taskId: staleOpenTasks[0].id,
        title: `Review project activity for ${input.project.name}`,
        reason:
          "Recent activity has stalled, so the project needs a review pass.",
      });
    }

    const waitingTask = openTasks.find(
      (task) =>
        task.status === "waiting" ||
        Boolean(String(task.waitingOn || "").trim()),
    );
    if (waitingTask) {
      risks.push("Key work is waiting on an external dependency");
      score -= 15;
      recommendedInterventions.push({
        type: "follow_up_waiting_task",
        projectId: input.project.id,
        taskId: waitingTask.id,
        title: `Follow up on ${String(waitingTask.waitingOn || waitingTask.title).trim()}`,
        reason: "Waiting work needs an explicit follow-up to move again.",
      });
    }

    return {
      projectId: input.project.id,
      healthScore: clampHealthScore(score),
      risks,
      recommendedInterventions,
    };
  }
}
