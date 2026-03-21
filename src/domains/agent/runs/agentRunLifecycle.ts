/**
 * Agent Run Lifecycle — clean state machine documentation and helpers.
 *
 * This module documents the canonical run state transitions and provides
 * type-safe helpers for the AgentJobRun lifecycle. It complements the
 * existing AgentJobRunService without replacing it.
 *
 * Current states (from Prisma): running, completed, failed
 * Target states: queued → running → waiting_for_tool → succeeded / failed / cancelled
 *
 * The Python agent-runner/ worker also uses this lifecycle via the same
 * AgentJobRun table in Postgres.
 */

/**
 * Canonical run states. The Prisma schema currently supports
 * running/completed/failed. Additional states (queued, waiting_for_tool,
 * cancelled) can be added when the schema is extended.
 */
export type AgentRunStatus =
  | "queued"
  | "running"
  | "waiting_for_tool"
  | "succeeded"
  | "failed"
  | "cancelled";

/**
 * Valid state transitions.
 */
export const VALID_TRANSITIONS: Record<AgentRunStatus, AgentRunStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["waiting_for_tool", "succeeded", "failed", "cancelled"],
  waiting_for_tool: ["running", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

/**
 * Terminal states — no further transitions allowed.
 */
export const TERMINAL_STATES: Set<AgentRunStatus> = new Set([
  "succeeded",
  "failed",
  "cancelled",
]);

/**
 * Check if a state transition is valid.
 */
export function isValidTransition(
  from: AgentRunStatus,
  to: AgentRunStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a run is in a terminal state.
 */
export function isTerminal(status: AgentRunStatus): boolean {
  return TERMINAL_STATES.has(status);
}

/**
 * Map current Prisma status values to canonical states.
 * The Prisma schema uses "completed" where we mean "succeeded".
 */
export function fromPrismaStatus(
  prismaStatus: string,
): AgentRunStatus | undefined {
  switch (prismaStatus) {
    case "running":
      return "running";
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    default:
      return undefined;
  }
}

/**
 * Map canonical states back to Prisma status values.
 */
export function toPrismaStatus(status: AgentRunStatus): string | undefined {
  switch (status) {
    case "running":
      return "running";
    case "succeeded":
      return "completed";
    case "failed":
      return "failed";
    default:
      return undefined; // queued, waiting_for_tool, cancelled not in Prisma yet
  }
}
