import type { Todo } from "../types";

export interface RoutineGroup {
  pattern: string;
  frequency: string;
  tasks: Array<{
    id: string;
    title: string;
    recurrenceType: string;
    recurrenceInterval: number | null;
    nextOccurrence: Date | null;
    completed: boolean;
  }>;
  taskCount: number;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  yearly: "Every year",
  rrule: "Custom schedule",
};

/**
 * Detect routines from recurring tasks — computation-only, no schema changes.
 * Groups tasks by recurrence pattern and returns summary.
 */
export function detectRoutines(tasks: Todo[]): RoutineGroup[] {
  const recurring = tasks.filter(
    (t) => t.recurrence?.type && t.recurrence.type !== "none" && !t.archived,
  );

  const groups = new Map<string, RoutineGroup>();

  for (const task of recurring) {
    const pattern = task.recurrence?.type ?? "none";
    if (!groups.has(pattern)) {
      groups.set(pattern, {
        pattern,
        frequency: FREQUENCY_LABELS[pattern] ?? pattern,
        tasks: [],
        taskCount: 0,
      });
    }
    const group = groups.get(pattern)!;
    group.tasks.push({
      id: task.id,
      title: task.title,
      recurrenceType: task.recurrence?.type ?? "none",
      recurrenceInterval: task.recurrence?.interval ?? null,
      nextOccurrence: task.recurrence?.nextOccurrence ?? null,
      completed: task.completed,
    });
    group.taskCount++;
  }

  return Array.from(groups.values()).sort((a, b) => b.taskCount - a.taskCount);
}
