import type { Energy, Priority, Project, Todo } from "../../types";
import type {
  PlannerEffort,
  PlannerImpact,
  PlannerTaskSuggestion,
  WorkGraphTaskNode,
} from "../../types/plannerTypes";

export function normalizeTitle(value: string): string {
  return value.trim().toLowerCase();
}

export function priorityRank(
  priority?: Priority | Project["priority"] | Todo["priority"] | null,
): number {
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

export function energyRank(energy?: Energy | null): number {
  switch (energy) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    default:
      return 1;
  }
}

export function isOpenTask(task: Todo): boolean {
  return !task.archived && !task.completed && task.status !== "done";
}

export function includesProjectTask(project: Project, task: Todo): boolean {
  return task.projectId === project.id;
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

export function buildConstraintSentence(constraints: string[]): string {
  if (!constraints.length) {
    return "";
  }
  return ` Constraints: ${constraints.join("; ")}.`;
}

export function sortOpenTaskCandidates(tasks: Todo[]): Todo[] {
  return [...tasks].sort((left, right) => {
    if (left.status !== right.status) {
      if (left.status === "next") return -1;
      if (right.status === "next") return 1;
      if (left.status === "in_progress") return -1;
      if (right.status === "in_progress") return 1;
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
}

export function findExistingNextAction(tasks: Todo[]): Todo | null {
  return (
    sortOpenTaskCandidates(
      tasks.filter(
        (task) =>
          isOpenTask(task) &&
          (task.status === "next" || task.status === "in_progress"),
      ),
    )[0] || null
  );
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

export function buildTaskIndex(tasks: Todo[]): Map<string, Todo> {
  return new Map(tasks.map((task) => [task.id, task]));
}

export function openDependencyIdsForTask(
  task: Todo,
  taskIndex: Map<string, Todo>,
): string[] {
  return task.dependsOnTaskIds.filter((dependencyId) => {
    const dependency = taskIndex.get(dependencyId);
    return Boolean(dependency && isOpenTask(dependency));
  });
}

export function taskFitsContext(task: Todo, contexts: string[]): boolean {
  if (!contexts.length) {
    return true;
  }
  const taskContext = String(task.context || "")
    .trim()
    .toLowerCase();
  if (!taskContext) {
    return false;
  }
  return contexts.some((context) => normalizeTitle(context) === taskContext);
}

export function taskFitsEnergy(
  task: Todo,
  availableEnergy?: Energy | null,
): boolean {
  if (!availableEnergy || !task.energy) {
    return true;
  }
  return energyRank(task.energy) <= energyRank(availableEnergy);
}

export function taskFitsAvailableMinutes(
  task: Todo,
  availableMinutes?: number | null,
): boolean {
  if (availableMinutes === undefined || availableMinutes === null) {
    return true;
  }
  if (task.estimateMinutes === null || task.estimateMinutes === undefined) {
    return true;
  }
  return task.estimateMinutes <= availableMinutes;
}

export function classifyTaskEffort(task: Todo): PlannerEffort {
  const estimate = task.estimateMinutes;
  if (typeof estimate === "number") {
    if (estimate <= 30) return "low";
    if (estimate <= 90) return "medium";
    return "high";
  }
  if ((task.subtasks?.length || 0) >= 4) {
    return "high";
  }
  return "medium";
}

export function classifyTaskImpact(task: Todo, now: Date): PlannerImpact {
  const dueTime = task.dueDate?.getTime();
  if (typeof dueTime === "number") {
    const diffDays = (dueTime - now.getTime()) / 86_400_000;
    if (diffDays < 0) return "high";
    if (diffDays <= 2) return "high";
  }
  if (task.priority === "urgent" || task.priority === "high") {
    return "high";
  }
  if (task.status === "in_progress" || task.status === "next") {
    return "medium";
  }
  return "low";
}

export function scoreTaskForDecision(input: {
  task: Todo;
  now: Date;
  blocked: boolean;
  availableMinutes?: number | null;
  availableEnergy?: Energy | null;
  contexts: string[];
  dependentCount: number;
}): number {
  const { task, now, blocked, dependentCount } = input;
  let score = 0;

  if (blocked) score -= 200;
  if (task.status === "in_progress") score += 60;
  if (task.status === "next") score += 45;
  if (task.status === "scheduled") score += 15;

  score += Math.max(0, 30 - priorityRank(task.priority) * 8);

  if (task.dueDate) {
    const diffDays = Math.floor(
      (task.dueDate.getTime() - now.getTime()) / 86_400_000,
    );
    if (diffDays < 0) score += 70;
    else if (diffDays === 0) score += 55;
    else if (diffDays <= 2) score += 35;
    else if (diffDays <= 7) score += 15;
  }

  if (task.scheduledDate && task.scheduledDate <= now) {
    score += 15;
  }

  if (taskFitsContext(task, input.contexts)) {
    score += input.contexts.length ? 20 : 0;
  } else if (input.contexts.length) {
    score -= 30;
  }

  if (taskFitsEnergy(task, input.availableEnergy)) {
    score += input.availableEnergy ? 15 : 0;
  } else if (input.availableEnergy) {
    score -= 30;
  }

  if (taskFitsAvailableMinutes(task, input.availableMinutes)) {
    score += input.availableMinutes !== undefined ? 10 : 0;
  } else {
    score -= 25;
  }

  score += dependentCount * 8;
  return score;
}

export function buildDecisionReason(input: {
  task: Todo;
  now: Date;
  blocked: boolean;
  dependentCount: number;
}): string {
  const reasons: string[] = [];
  if (input.blocked) {
    reasons.push("it is still blocked by an open dependency");
  } else if (input.task.status === "in_progress") {
    reasons.push("it is already in progress");
  } else if (input.task.status === "next") {
    reasons.push("it is already marked as a next action");
  }

  if (input.task.dueDate) {
    const diffMs = input.task.dueDate.getTime() - input.now.getTime();
    if (diffMs < 0) {
      reasons.push("it is overdue");
    } else if (diffMs <= 172_800_000) {
      reasons.push("it is due soon");
    }
  }

  if (input.dependentCount > 0) {
    reasons.push(
      `it unblocks ${input.dependentCount} other task${input.dependentCount === 1 ? "" : "s"}`,
    );
  }

  if (input.task.priority === "urgent" || input.task.priority === "high") {
    reasons.push("it has elevated priority");
  }

  if (!reasons.length) {
    return "It is one of the clearest actionable tasks available right now.";
  }

  const [first, ...rest] = reasons;
  if (!rest.length) {
    return `${capitalize(first)}.`;
  }
  return `${capitalize(first)} and ${rest.join(", ")}.`;
}

export function dependentCounts(tasks: Todo[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const dependencyId of task.dependsOnTaskIds) {
      counts.set(dependencyId, (counts.get(dependencyId) || 0) + 1);
    }
  }
  return counts;
}

export function toWorkGraphNode(task: Todo, reason: string): WorkGraphTaskNode {
  return {
    taskId: task.id,
    title: task.title,
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    reason,
  };
}

export function dependencyTitles(
  task: Todo,
  taskIndex: Map<string, Todo>,
): string[] {
  return openDependencyIdsForTask(task, taskIndex)
    .map((dependencyId) => taskIndex.get(dependencyId)?.title)
    .filter((title): title is string => Boolean(title));
}

export function buildCriticalPath(tasks: Todo[]): Todo[] {
  const taskIndex = buildTaskIndex(tasks);
  const projectTaskIds = new Set(tasks.map((task) => task.id));
  const visiting = new Set<string>();
  const memo = new Map<string, Todo[]>();

  function visit(task: Todo): Todo[] {
    if (memo.has(task.id)) {
      return memo.get(task.id) as Todo[];
    }
    if (visiting.has(task.id)) {
      return [task];
    }
    visiting.add(task.id);

    let best: Todo[] = [task];
    for (const dependencyId of task.dependsOnTaskIds) {
      if (!projectTaskIds.has(dependencyId)) {
        continue;
      }
      const dependency = taskIndex.get(dependencyId);
      if (!dependency || !isOpenTask(dependency)) {
        continue;
      }
      const candidate = [...visit(dependency), task];
      if (candidate.length > best.length) {
        best = candidate;
      }
    }

    visiting.delete(task.id);
    memo.set(task.id, best);
    return best;
  }

  return tasks.reduce<Todo[]>((best, task) => {
    const candidate = visit(task);
    return candidate.length > best.length ? candidate : best;
  }, []);
}

export function clampHealthScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
