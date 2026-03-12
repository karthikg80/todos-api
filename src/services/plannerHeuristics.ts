import type { Project, Todo } from "../types";
import type {
  PlannerTaskSuggestion,
  WeeklyReviewAction,
  WeeklyReviewFinding,
} from "../types/plannerTypes";

function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

function priorityRank(
  priority?: Project["priority"] | Todo["priority"] | null,
) {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 4;
  }
}

function isOpenTask(task: Todo): boolean {
  return !task.archived && !task.completed;
}

function includesProjectTask(project: Project, task: Todo): boolean {
  return task.projectId === project.id || task.category === project.name;
}

function buildConstraintSentence(constraints: string[]): string {
  if (!constraints.length) {
    return "";
  }
  return ` Constraints: ${constraints.join("; ")}.`;
}

export function projectTasksForProject(
  project: Project,
  tasks: Todo[],
): Todo[] {
  return tasks.filter((task) => includesProjectTask(project, task));
}

export function projectHasNextAction(tasks: Todo[]): boolean {
  return tasks.some(
    (task) =>
      isOpenTask(task) &&
      (task.status === "next" || task.status === "in_progress"),
  );
}

export function findExistingNextAction(tasks: Todo[]): Todo | null {
  const candidates = tasks
    .filter(
      (task) =>
        isOpenTask(task) &&
        (task.status === "next" || task.status === "in_progress"),
    )
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "next" ? -1 : 1;
      }
      if (priorityRank(left.priority) !== priorityRank(right.priority)) {
        return priorityRank(left.priority) - priorityRank(right.priority);
      }
      if (left.dueDate && right.dueDate) {
        return left.dueDate.getTime() - right.dueDate.getTime();
      }
      if (left.dueDate) return -1;
      if (right.dueDate) return 1;
      return left.order - right.order;
    });

  return candidates[0] || null;
}

export function buildProjectPlan(input: {
  project: Project;
  tasks: Todo[];
  goal: string;
  constraints: string[];
}): PlannerTaskSuggestion[] {
  const goalLabel = input.goal.trim() || input.project.name;
  const constraintSentence = buildConstraintSentence(input.constraints);
  const baseSuggestions: PlannerTaskSuggestion[] = [
    {
      title: `Define success criteria for ${goalLabel}`,
      description: `Write down what done means, who it serves, and the non-negotiable outcomes.${constraintSentence}`,
      priority: "high",
      status: "next",
      reason: "Clarifies the target before more work is added.",
    },
    {
      title: `Gather inputs and constraints for ${goalLabel}`,
      description: `Collect the facts, dependencies, and open questions needed to plan the project.${constraintSentence}`,
      priority: "medium",
      status: "next",
      reason: "Prevents avoidable rework before decisions are made.",
    },
    {
      title: `Decide the approach for ${input.project.name}`,
      description:
        "Choose the primary direction, tradeoffs, and decision owner so execution can move.",
      priority: "high",
      status: "next",
      reason: "Creates a single decision point that unblocks execution.",
    },
    {
      title: `Draft the first execution milestone for ${goalLabel}`,
      description:
        "Break the first milestone into a concrete deliverable with a clear owner and finish line.",
      priority: "high",
      status: "next",
      reason: "Turns planning into the first actionable delivery step.",
    },
    {
      title: `Review progress and capture follow-up for ${goalLabel}`,
      description:
        "Check what worked, what is blocked, and the next follow-up after the first milestone ships.",
      priority: "medium",
      status: "scheduled",
      reason:
        "Keeps the project reviewable instead of drifting after execution starts.",
    },
  ];

  const existingTitles = new Set(
    input.tasks
      .filter((task) => !task.archived)
      .map((task) => normalizeTitle(task.title)),
  );

  return baseSuggestions.filter(
    (suggestion) => !existingTitles.has(normalizeTitle(suggestion.title)),
  );
}

export function deriveNextAction(
  project: Project,
  tasks: Todo[],
): PlannerTaskSuggestion | null {
  const openTasks = tasks.filter(isOpenTask);
  const waitingTask = openTasks.find(
    (task) =>
      task.status === "waiting" || Boolean(String(task.waitingOn || "").trim()),
  );
  if (waitingTask) {
    const blocker = String(waitingTask.waitingOn || waitingTask.title).trim();
    return {
      title: `Follow up on ${blocker}`,
      description: `Unblock ${project.name} by confirming the external dependency and deciding the next move.`,
      priority: waitingTask.priority || "high",
      status: "next",
      reason:
        "The project is blocked on a waiting item and needs an explicit follow-up.",
    };
  }

  const oldestOpenTask = [...openTasks].sort(
    (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
  )[0];
  if (oldestOpenTask) {
    return {
      title: `Review ${oldestOpenTask.title} and choose the next step`,
      description: `Use the current project state to turn ${oldestOpenTask.title} into one concrete action for ${project.name}.`,
      priority: oldestOpenTask.priority || "medium",
      status: "next",
      reason:
        "The project has open work but nothing explicitly actionable right now.",
    };
  }

  const goalLabel = project.goal || project.description || project.name;
  return {
    title: `Define the first concrete step for ${goalLabel}`,
    description: `Capture the first action that would move ${project.name} forward this week.`,
    priority: project.priority || "medium",
    status: "next",
    reason: "The project has no open tasks yet and needs a starting action.",
  };
}

export function findWeeklyReviewFindings(input: {
  projects: Project[];
  tasks: Todo[];
  now: Date;
  includeArchived: boolean;
  staleTaskDays: number;
  upcomingDays: number;
}): {
  findings: WeeklyReviewFinding[];
  recommendedActions: WeeklyReviewAction[];
  summary: {
    projectsWithoutNextAction: number;
    staleTasks: number;
    waitingTasks: number;
    upcomingTasks: number;
  };
} {
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

  const findings: WeeklyReviewFinding[] = [];
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
      const suggestion = deriveNextAction(project, projectTasks);
      if (suggestion) {
        recommendedActions.push({
          type: "create_next_action",
          projectId: project.id,
          title: suggestion.title,
          reason: suggestion.reason,
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
      const suggestion = deriveNextAction(project, projectTasks);
      if (suggestion) {
        recommendedActions.push({
          type: "create_next_action",
          projectId: project.id,
          title: suggestion.title,
          reason: suggestion.reason,
        });
      }
    }
  }

  const staleTasks = openTasks.filter((task) => task.updatedAt <= staleCutoff);
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
      task.status === "waiting" || Boolean(String(task.waitingOn || "").trim()),
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

  return {
    findings,
    recommendedActions,
    summary: {
      projectsWithoutNextAction,
      staleTasks: staleTasks.length,
      waitingTasks: waitingTasks.length,
      upcomingTasks: upcomingTasks.length,
    },
  };
}
