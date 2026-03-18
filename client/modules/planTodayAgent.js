// =============================================================================
// planTodayAgent.js — Day plan generation via /agent/read/plan_today
// =============================================================================

import { hooks } from "./store.js";
import { callAgentAction } from "./agentApiClient.js";

// ---------------------------------------------------------------------------
// Plan state
// ---------------------------------------------------------------------------

/** Task IDs recommended by the most recent successful plan generation. */
export let planTodayTaskIds = [];

const planState = {
  tasks: [],
  totalMinutes: 0,
  remainingMinutes: 0,
  loading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Generate day plan
// ---------------------------------------------------------------------------

/**
 * Call /agent/read/plan_today, map the response into planState, and populate
 * planTodayTaskIds with the recommended task IDs in rank order.
 *
 * Response shape:
 *   { plan: { recommendedTasks: [{ id, title, estimatedMinutes, explanation: { whyIncluded } }],
 *              totalMinutes, remainingMinutes } }
 */
export async function generateDayPlan() {
  planState.loading = true;
  planState.error = null;

  try {
    const data = await callAgentAction("/agent/read/plan_today", {});

    const recommended =
      data?.plan?.recommendedTasks ?? data?.selectedTasks ?? [];
    planState.tasks = Array.isArray(recommended)
      ? recommended.map((t) => ({
          taskId: t.id || t.taskId || "",
          title: t.title || "",
          estimatedMinutes: t.estimatedMinutes || t.estimatedMin || 0,
          reason: t.explanation?.whyIncluded || t.reason || "",
        }))
      : [];
    planState.totalMinutes =
      data?.plan?.totalMinutes ?? data?.totalMinutes ?? 0;
    planState.remainingMinutes =
      data?.plan?.remainingMinutes ?? data?.remainingMinutes ?? 0;

    planTodayTaskIds = planState.tasks.map((t) => t.taskId).filter(Boolean);
  } catch (err) {
    planState.error =
      err instanceof Error ? err.message : "Failed to generate day plan";
    hooks.console?.error?.("planTodayAgent: generateDayPlan failed", err);
  } finally {
    planState.loading = false;
  }

  return planState;
}

/**
 * Reset plan state and clear the exported task-ID list.
 */
export function resetDayPlan() {
  planState.tasks = [];
  planState.totalMinutes = 0;
  planState.remainingMinutes = 0;
  planState.loading = false;
  planState.error = null;
  planTodayTaskIds = [];
}

/** Read-only snapshot of current plan state. */
export function getDayPlanState() {
  return { ...planState, tasks: [...planState.tasks] };
}
