// =============================================================================
// agentRunPolling.js — Client-side polling for async agent run status.
//
// Usage:
//   import { submitAgentRun } from './agentRunPolling.js';
//   const result = await submitAgentRun('plan_today', { date: '2026-03-21' });
//   // result = { ok: true, runId, status: 'completed', result: { ... } }
// =============================================================================

import { hooks } from "../../modules/store.js";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90; // 3 minutes max
const TERMINAL_STATES = new Set(["completed", "failed", "succeeded"]);

/**
 * Submit an agent action for async execution and poll until completion.
 *
 * @param {string} action — agent action name (e.g., 'plan_today')
 * @param {object} [params] — action parameters
 * @param {object} [options]
 * @param {(status: object) => void} [options.onStatusChange] — called on each poll
 * @param {AbortSignal} [options.signal] — abort signal to cancel polling
 * @returns {Promise<object>} — final run status
 */
export async function submitAgentRun(action, params = {}, options = {}) {
  const { onStatusChange, signal } = options;

  // Submit the run
  const submitResponse = await hooks.apiCall(`${hooks.API_URL}/agent/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });

  if (!submitResponse || !submitResponse.ok) {
    const error = submitResponse
      ? await submitResponse.json().catch(() => ({}))
      : {};
    throw new Error(error.error || "Failed to submit agent run");
  }

  const { runId } = await submitResponse.json();

  // Poll for completion
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      throw new Error("Agent run polling aborted");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const statusResponse = await hooks.apiCall(
      `${hooks.API_URL}/agent/runs/${runId}`,
    );

    if (!statusResponse || !statusResponse.ok) {
      continue; // Retry on transient errors
    }

    const { run } = await statusResponse.json();
    onStatusChange?.(run);

    if (TERMINAL_STATES.has(run.status)) {
      return run;
    }
  }

  throw new Error("Agent run polling timed out");
}

/**
 * Get the current status of an agent run.
 *
 * @param {string} runId
 * @returns {Promise<object|null>}
 */
export async function getAgentRunStatus(runId) {
  const response = await hooks.apiCall(`${hooks.API_URL}/agent/runs/${runId}`);

  if (!response || !response.ok) return null;

  const { run } = await response.json();
  return run;
}
