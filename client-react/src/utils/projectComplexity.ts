/**
 * Project complexity classification and utility functions.
 *
 * This module implements adaptive UI behavior based on project complexity:
 * - Classifies projects as Simple, Structured, or Complex
 * - Provides UI state (default tabs, visible controls) based on complexity
 * - Calculates "next step" recommendations with effort estimates
 */

import type { Todo, Project, Heading } from "../types";

// ---------------------------------------------------------------------------
// Complexity Classification Constants
// ---------------------------------------------------------------------------

export const COMPLEXITY_LEVELS = {
  SIMPLE: "simple",
  STRUCTURED: "structured",
  COMPLEX: "complex",
} as const;

export type ComplexityLevel =
  (typeof COMPLEXITY_LEVELS)[keyof typeof COMPLEXITY_LEVELS];

export const COMPLEXITY_LABELS: Record<ComplexityLevel, string> = {
  simple: "Simple project",
  structured: "Structured project",
  complex: "Complex project",
};

export const TAB_LABELS = {
  overview: "Overview",
  sections: "Sections",
  tasks: "Tasks",
} as const;

export type ProjectTab = keyof typeof TAB_LABELS;

export const TAB_DESCRIPTIONS: Record<ProjectTab, string> = {
  overview: "Best for deciding what to do next.",
  sections: "Best when the project has distinct phases.",
  tasks: "Best for sorting, batching, and bulk edits.",
};

// ---------------------------------------------------------------------------
// Complexity Thresholds
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  SIMPLE_MAX_TASKS: 5,
  STRUCTURED_MAX_TASKS: 12,
  // Complex: 12+ tasks or multiple dates/priorities
} as const;

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Get todos that belong to a specific project.
 */
function getProjectTodos(
  todos: Todo[],
  projectId: string | null | undefined,
): Todo[] {
  if (!projectId) return [];
  return todos.filter((todo) => {
    if (todo.completed) return false;
    if (todo.projectId) {
      return todo.projectId === projectId;
    }
    return false;
  });
}

/**
 * Count unique priorities among todos.
 */
function countUniquePriorities(todos: Todo[]): number {
  const priorities = new Set(
    todos
      .map((t) => t.priority)
      .filter((p) => p && p !== undefined && p !== null),
  );
  return priorities.size;
}

/**
 * Count unique due dates among todos.
 */
function countUniqueDueDates(todos: Todo[]): number {
  const dates = new Set(
    todos
      .map((t) => t.dueDate)
      .filter((d) => d),
  );
  return dates.size;
}

/**
 * Check if any todos have subtasks.
 */
function hasSubtasks(todos: Todo[]): boolean {
  return todos.some((t) => t.subtasks && t.subtasks.length > 0);
}

/**
 * Get all tasks (including completed) for a project.
 */
function getAllProjectTodos(
  todos: Todo[],
  projectId: string | null | undefined,
): Todo[] {
  if (!projectId) return [];
  return todos.filter((todo) => {
    if (todo.projectId) {
      return todo.projectId === projectId;
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// Complexity Classification
// ---------------------------------------------------------------------------

/**
 * Calculate project complexity level based on task count, structure,
 * and metadata diversity.
 */
export function classifyProjectComplexity(
  todos: Todo[],
  projectId: string | null | undefined,
  headings: Heading[] = [],
): ComplexityLevel {
  const projectTodos = getProjectTodos(todos, projectId);
  const taskCount = projectTodos.length;
  const headingCount = headings.length;
  const priorityCount = countUniquePriorities(projectTodos);
  const dueDateCount = countUniqueDueDates(projectTodos);
  const hasTaskSubtasks = hasSubtasks(projectTodos);

  // Simple: Few tasks, no structure, simple metadata
  if (
    taskCount <= THRESHOLDS.SIMPLE_MAX_TASKS &&
    headingCount === 0 &&
    priorityCount <= 1 &&
    dueDateCount <= 1 &&
    !hasTaskSubtasks
  ) {
    return COMPLEXITY_LEVELS.SIMPLE;
  }

  // Complex: Many tasks, complex metadata, or rich structure
  if (
    taskCount > THRESHOLDS.STRUCTURED_MAX_TASKS ||
    (priorityCount >= 3 && taskCount >= 5) ||
    (dueDateCount >= 4 && taskCount >= 5) ||
    (headingCount >= 3 && taskCount >= 8) ||
    (hasTaskSubtasks && taskCount >= 8)
  ) {
    return COMPLEXITY_LEVELS.COMPLEX;
  }

  // Structured: Between simple and complex
  return COMPLEXITY_LEVELS.STRUCTURED;
}

/**
 * Get the default tab for a project based on its complexity.
 */
export function getDefaultTabForProject(
  todos: Todo[],
  projectId: string | null | undefined,
  headings: Heading[] = [],
): ProjectTab {
  const complexity = classifyProjectComplexity(todos, projectId, headings);

  switch (complexity) {
    case COMPLEXITY_LEVELS.SIMPLE:
      return "overview";
    case COMPLEXITY_LEVELS.STRUCTURED:
      return "sections";
    case COMPLEXITY_LEVELS.COMPLEX:
      return "tasks";
    default:
      return "overview";
  }
}

/**
 * Check if advanced controls should be visible for a project.
 */
export function shouldShowAdvancedControls(
  todos: Todo[],
  projectId: string | null | undefined,
  headings: Heading[] = [],
): boolean {
  const complexity = classifyProjectComplexity(todos, projectId, headings);
  const projectTodos = getProjectTodos(todos, projectId);
  return (
    complexity !== COMPLEXITY_LEVELS.SIMPLE ||
    projectTodos.length > THRESHOLDS.SIMPLE_MAX_TASKS
  );
}

// ---------------------------------------------------------------------------
// Next Step Recommendation
// ---------------------------------------------------------------------------

/**
 * Estimate effort in minutes for a task.
 */
export function estimateTaskEffort(todo: Todo): { minutes: number; label: string } {
  if (!todo) {
    return { minutes: 0, label: "Unknown" };
  }

  // Base estimate from subtasks
  const subtaskCount = todo?.subtasks?.length ?? 0;
  let baseMinutes = 5 + subtaskCount * 3;

  // Adjust for priority
  if (todo?.priority === "urgent") {
    baseMinutes *= 1.5;
  } else if (todo?.priority === "high") {
    baseMinutes *= 1.2;
  }

  // Adjust for notes length (more notes = more complexity)
  const notesLength = (todo?.notes ?? "").length;
  if (notesLength > 200) {
    baseMinutes += 5;
  } else if (notesLength > 100) {
    baseMinutes += 2;
  }

  // Round to nearest 5 minutes
  const roundedMinutes = Math.round(baseMinutes / 5) * 5;

  // Format label
  let label: string;
  if (roundedMinutes <= 5) {
    label = "Quick win";
  } else if (roundedMinutes <= 15) {
    label = "Short";
  } else if (roundedMinutes <= 30) {
    label = "Medium";
  } else if (roundedMinutes <= 60) {
    label = "Long";
  } else {
    label = "Extended";
  }

  return { minutes: roundedMinutes, label };
}

/**
 * Find the next recommended task for a project.
 */
export function findNextTaskForProject(
  todos: Todo[],
  projectId: string | null | undefined,
): { todo: Todo; effort: { minutes: number; label: string }; reason: string } | null {
  const projectTodos = getProjectTodos(todos, projectId);
  if (projectTodos.length === 0) return null;

  // Priority order: urgent > high > medium > low > none
  const priorityOrder: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
    "": 4,
  };

  const sortedTodos = [...projectTodos].sort((a, b) => {
    // First by priority
    const priorityDiff =
      (priorityOrder[a?.priority ?? "none"] ?? 4) -
      (priorityOrder[b?.priority ?? "none"] ?? 4);
    if (priorityDiff !== 0) return priorityDiff;

    // Then by due date (earlier is better)
    if (a?.dueDate && b?.dueDate) {
      return (
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
    }
    if (a?.dueDate) return -1;
    if (b?.dueDate) return 1;

    // Then by creation date (older first)
    if (a?.createdAt && b?.createdAt) {
      return (
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    return 0;
  });

  const nextTodo = sortedTodos[0];
  if (!nextTodo) return null;

  // Determine why this task is next
  const reasons: string[] = [];
  if (nextTodo?.priority === "urgent") {
    reasons.push("urgent priority");
  } else if (nextTodo?.priority === "high") {
    reasons.push("high priority");
  }

  if (nextTodo?.dueDate) {
    const dueDate = new Date(nextTodo.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilDue <= 1) {
      reasons.push("due soon");
    } else if (daysUntilDue <= 3) {
      reasons.push(`due in ${daysUntilDue} days`);
    }
  }

  // Check for blocking other tasks
  const blockedTodos = projectTodos.filter((t) =>
    t?.dependsOnTaskIds?.includes(nextTodo?.id ?? ""),
  );
  if (blockedTodos.length > 0) {
    reasons.push(
      `unblocks ${blockedTodos.length} other task${blockedTodos.length > 1 ? "s" : ""}`,
    );
  }

  return {
    todo: nextTodo,
    effort: estimateTaskEffort(nextTodo),
    reason: reasons.length > 0 ? reasons[0] : "next in queue",
  };
}

// ---------------------------------------------------------------------------
// Metrics Display Enhancement
// ---------------------------------------------------------------------------

/**
 * Get formatted metrics for a project.
 */
export function getProjectMetrics(
  todos: Todo[],
  projectId: string | null | undefined,
): {
  openCount: number;
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  nextScheduled: Date | null;
  hasScheduledTasks: boolean;
} {
  const allProjectTodos = getAllProjectTodos(todos, projectId);
  const openTodos = getProjectTodos(todos, projectId);
  const completedTodos = allProjectTodos.filter((t) => t.completed);

  const openCount = openTodos.length;
  const completedCount = completedTodos.length;
  const totalCount = openCount + completedCount;

  // Find next scheduled task
  const nextScheduled = openTodos
    .filter((t) => t.dueDate)
    .sort((a, b) => {
      const dateA = new Date(a.dueDate ?? "").getTime();
      const dateB = new Date(b.dueDate ?? "").getTime();
      return dateA - dateB;
    })[0];

  return {
    openCount,
    completedCount,
    totalCount,
    completionPercent:
      totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
    nextScheduled: nextScheduled?.dueDate ? new Date(nextScheduled.dueDate) : null,
    hasScheduledTasks: openTodos.some((t) => t.dueDate),
  };
}

/**
 * Get enhanced metrics text for display.
 */
export function getEnhancedMetricsText(
  metrics: ReturnType<typeof getProjectMetrics>,
): string {
  const { openCount, completedCount, totalCount, completionPercent, nextScheduled } =
    metrics;

  const parts: string[] = [];

  // Open tasks
  if (openCount === 1) {
    parts.push("1 open task");
  } else if (openCount > 1) {
    parts.push(`${openCount} open tasks`);
  }

  // Completion status
  if (completedCount === 0 && openCount > 0) {
    parts.push("Nothing completed yet");
  } else if (completedCount > 0) {
    parts.push(`${completionPercent}% complete`);
  }

  // Next scheduled
  if (nextScheduled) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    if (nextScheduled < today) {
      parts.push("Overdue task(s)");
    } else if (nextScheduled < tomorrow) {
      parts.push("Due today");
    } else if (nextScheduled < nextWeek) {
      const dayName = nextScheduled.toLocaleDateString("en-US", { weekday: "short" });
      parts.push(`Next: ${dayName}`);
    } else {
      const dateStr = nextScheduled.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      parts.push(`Next: ${dateStr}`);
    }
  }

  return parts.length > 0 ? parts.join(" • ") : "";
}
