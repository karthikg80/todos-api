// =============================================================================
// activityTracker.js — Client-side event batching for the data intelligence layer
// =============================================================================
// Queues activity events in memory and flushes them to POST /events/batch
// every 30 seconds or on page visibility change. Fire-and-forget: failures
// are silently retried on the next flush cycle.
// =============================================================================

import { hooks } from "../modules/store.js";

const FLUSH_INTERVAL_MS = 30_000;
const MAX_BATCH_SIZE = 50;

let queue = [];
let flushTimer = null;

/**
 * Track a client-side activity event. Queued and batch-sent.
 * @param {string} eventType - One of the ActivityEventType enum values
 * @param {Object} [opts]
 * @param {string} [opts.entityType]
 * @param {string} [opts.entityId]
 * @param {Object} [opts.metadata]
 */
export function trackEvent(eventType, opts = {}) {
  queue.push({
    eventType,
    entityType: opts.entityType || undefined,
    entityId: opts.entityId || undefined,
    metadata: opts.metadata || undefined,
    timestamp: new Date().toISOString(),
  });

  if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL_MS);
  }
}

/**
 * Flush queued events to the server. Called automatically on timer and page hide.
 */
async function flushEvents() {
  flushTimer = null;

  if (!queue.length) return;
  if (!hooks.apiCall || !hooks.API_URL) return;

  const batch = queue.splice(0, MAX_BATCH_SIZE);

  try {
    await hooks.apiCall(`${hooks.API_URL}/events/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Put failed events back for next flush attempt
    queue.unshift(...batch);
  }

  // If there are remaining events, schedule another flush
  if (queue.length > 0 && !flushTimer) {
    flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL_MS);
  }
}

// Flush on page hide (tab switch, close, navigate away)
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushEvents();
    }
  });
}
