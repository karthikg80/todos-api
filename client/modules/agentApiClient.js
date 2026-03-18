// =============================================================================
// agentApiClient.js — Thin wrapper around hooks.apiCall for /agent/* endpoints.
// Unwraps the standard { ok, action, data, trace } agent envelope and throws
// on error so callers only handle the happy-path data.
// =============================================================================

import { hooks } from "./store.js";

/**
 * POST to an agent endpoint and return the unwrapped `data` payload.
 *
 * @param {string} path   - e.g. "/agent/read/break_down_task"
 * @param {object} body   - JSON body
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<object>}
 */
export async function callAgentAction(path, body = {}, timeoutMs = 30000) {
  const API_URL = hooks.API_URL || "";
  const apiCall = hooks.apiCall;
  if (typeof apiCall !== "function") throw new Error("apiCall hook not wired");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await apiCall(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response) throw new Error("No response from agent");

  let envelope;
  try {
    const text = await response.text();
    envelope = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Failed to parse agent response");
  }

  if (!response.ok || envelope.ok === false) {
    const msg =
      envelope?.error?.message ||
      envelope?.message ||
      `Agent request failed (${response.status})`;
    const err = new Error(msg);
    err.agentError = envelope?.error;
    err.status = response.status;
    throw err;
  }

  // Envelope shape: { ok: true, action, data, trace }
  return "data" in envelope ? envelope.data : envelope;
}
