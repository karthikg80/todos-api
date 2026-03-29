/**
 * Pure domain module for task lifecycle state management.
 *
 * Defines valid lifecycle states and transition rules.
 * Zero external dependencies — fully testable without mocks.
 */

import { TaskStatus } from "../../types";

/**
 * Canonical transition rules: which states can move to which other states.
 *
 * Design rationale:
 * - inbox  → clarification targets (next, scheduled, someday, cancelled)
 * - next   → execution states (in_progress, scheduled, waiting) or terminal (done, cancelled)
 * - scheduled → can start, defer, or complete
 * - in_progress → can pause (next, waiting), complete, or cancel
 * - waiting → resume (next, in_progress) or skip (done, cancelled)
 * - someday → reactivate (inbox, next, scheduled) or drop (cancelled)
 * - done   → reopen only (next)
 * - cancelled → resurrect only (inbox)
 */
const VALID_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  inbox: ["next", "scheduled", "in_progress", "someday", "done", "cancelled"],
  next: [
    "inbox",
    "in_progress",
    "scheduled",
    "waiting",
    "someday",
    "done",
    "cancelled",
  ],
  scheduled: [
    "inbox",
    "next",
    "in_progress",
    "waiting",
    "someday",
    "done",
    "cancelled",
  ],
  in_progress: ["next", "waiting", "done", "cancelled"],
  waiting: [
    "inbox",
    "next",
    "in_progress",
    "scheduled",
    "someday",
    "done",
    "cancelled",
  ],
  someday: ["inbox", "next", "scheduled", "cancelled"],
  done: ["next", "inbox"],
  cancelled: ["inbox", "next"],
};

/**
 * All valid task statuses in lifecycle order.
 */
export const ALL_STATUSES: readonly TaskStatus[] = [
  "inbox",
  "next",
  "scheduled",
  "in_progress",
  "waiting",
  "someday",
  "done",
  "cancelled",
] as const;

/**
 * Statuses considered "open" (not terminal).
 */
export const OPEN_STATUSES: readonly TaskStatus[] = [
  "inbox",
  "next",
  "scheduled",
  "in_progress",
  "waiting",
  "someday",
] as const;

/**
 * Statuses considered "terminal" (work is finished or abandoned).
 */
export const TERMINAL_STATUSES: readonly TaskStatus[] = [
  "done",
  "cancelled",
] as const;

/**
 * Statuses that indicate active execution.
 */
export const ACTIVE_STATUSES: readonly TaskStatus[] = [
  "next",
  "in_progress",
  "scheduled",
] as const;

/**
 * Statuses that indicate the task is blocked or deferred.
 */
export const BLOCKED_STATUSES: readonly TaskStatus[] = [
  "waiting",
  "someday",
] as const;

/**
 * Check whether a lifecycle transition is valid.
 */
export function isValidTransition(
  from: TaskStatus,
  to: TaskStatus,
): boolean {
  if (from === to) return true; // no-op transitions are always valid
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Return all statuses reachable from a given state.
 */
export function availableTransitions(status: TaskStatus): readonly TaskStatus[] {
  return VALID_TRANSITIONS[status] ?? [];
}

/**
 * Classify a status as open, terminal, active, or blocked.
 */
export function classifyStatus(status: TaskStatus): {
  isOpen: boolean;
  isTerminal: boolean;
  isActive: boolean;
  isBlocked: boolean;
} {
  return {
    isOpen: (OPEN_STATUSES as readonly string[]).includes(status),
    isTerminal: (TERMINAL_STATUSES as readonly string[]).includes(status),
    isActive: (ACTIVE_STATUSES as readonly string[]).includes(status),
    isBlocked: (BLOCKED_STATUSES as readonly string[]).includes(status),
  };
}

/**
 * Reconcile status and completed flag, maintaining invariants:
 * - completed === true  ↔ status === "done"
 * - completed === false ↔ status !== "done"
 *
 * This replicates the logic from PrismaTodoService.buildTodoState() as a
 * pure function, making it testable without database dependencies.
 */
export function reconcileStatusAndCompletion(input: {
  currentStatus?: TaskStatus;
  currentCompleted?: boolean;
  currentCompletedAt?: Date | null;
  nextStatus?: TaskStatus;
  nextCompleted?: boolean;
}): {
  status: TaskStatus;
  completed: boolean;
  completedAt: Date | null;
} {
  let status = input.nextStatus ?? input.currentStatus ?? "next";
  let completed = input.nextCompleted ?? input.currentCompleted ?? false;
  let completedAt = input.currentCompletedAt ?? null;

  // If explicitly setting a non-done status, ensure completed is false
  if (input.nextStatus !== undefined && input.nextStatus !== "done") {
    completed = input.nextCompleted ?? false;
  }

  // Maintain the status ↔ completed invariant
  if (completed) {
    status = "done";
    if (!completedAt) {
      completedAt = new Date();
    }
  } else if (status === "done") {
    // Un-completing: revert to previous non-done status
    status =
      input.currentStatus && input.currentStatus !== "done"
        ? input.currentStatus
        : "next";
    completedAt = null;
  } else {
    completedAt = null;
  }

  return { status, completed, completedAt };
}

/**
 * Derive lifecycle status from legacy fields for backward compatibility.
 * Used during migration when tasks have completed flag but no explicit status.
 */
export function deriveStatusFromLegacyFields(todo: {
  completed: boolean;
  scheduledDate?: Date | null;
  waitingOn?: string | null;
  status?: TaskStatus | null;
}): TaskStatus {
  // If explicit status exists and is valid, use it
  if (todo.status && ALL_STATUSES.includes(todo.status)) {
    return todo.status;
  }
  if (todo.completed) return "done";
  if (todo.waitingOn) return "waiting";
  if (todo.scheduledDate) return "scheduled";
  return "inbox";
}
