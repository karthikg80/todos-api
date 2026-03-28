// =============================================================================
// planTodayAgent.js — Day plan generation via /agent/read/plan_today
// =============================================================================

import { hooks } from "./store.js";
import { callAgentAction } from "./agentApiClient.js";

// ── IndexedDB plan cache (page-owned, not service-worker) ───────────────────
const PLAN_CACHE_DB = "todos-plan-cache";
const PLAN_CACHE_STORE = "plans";
const PLAN_CACHE_KEY = "latest";
const PLAN_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function openPlanCacheDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PLAN_CACHE_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PLAN_CACHE_STORE)) {
        req.result.createObjectStore(PLAN_CACHE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cachePlan(data) {
  try {
    const db = await openPlanCacheDb();
    const tx = db.transaction(PLAN_CACHE_STORE, "readwrite");
    tx.objectStore(PLAN_CACHE_STORE).put(
      { data, cachedAt: Date.now() },
      PLAN_CACHE_KEY,
    );
  } catch {
    /* silent — cache is best-effort */
  }
}

async function loadCachedPlan() {
  try {
    const db = await openPlanCacheDb();
    return new Promise((resolve) => {
      const tx = db.transaction(PLAN_CACHE_STORE, "readonly");
      const req = tx.objectStore(PLAN_CACHE_STORE).get(PLAN_CACHE_KEY);
      req.onsuccess = () => {
        const entry = req.result;
        if (entry && Date.now() - entry.cachedAt < PLAN_CACHE_TTL_MS) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

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

function applyPlanData(data) {
  const recommended = data?.plan?.recommendedTasks ?? data?.selectedTasks ?? [];
  planState.tasks = Array.isArray(recommended)
    ? recommended.map((t) => ({
        taskId: t.id || t.taskId || "",
        title: t.title || "",
        estimatedMinutes: t.estimatedMinutes || t.estimatedMin || 0,
        reason: t.explanation?.whyIncluded || t.reason || "",
      }))
    : [];
  planState.totalMinutes = data?.plan?.totalMinutes ?? data?.totalMinutes ?? 0;
  planState.remainingMinutes =
    data?.plan?.remainingMinutes ?? data?.remainingMinutes ?? 0;

  planTodayTaskIds = planState.tasks.map((t) => t.taskId).filter(Boolean);

  // Compute suggested time slots starting from 9:00 AM
  let slotMinutes = 9 * 60;
  for (const task of planState.tasks) {
    const duration = task.estimatedMinutes || 30;
    task.slotStart = slotMinutes;
    task.slotEnd = slotMinutes + duration;
    slotMinutes += duration + 15;
  }
}

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

  // Try to render from cache immediately (instant home page)
  const cached = await loadCachedPlan();
  if (cached) {
    applyPlanData(cached);
  }

  try {
    const data = await callAgentAction("/agent/read/plan_today", {});

    applyPlanData(data);
    void cachePlan(data);
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
export function getPlanState() {
  return planState;
}

export function formatSlotTime(minutesFromMidnight) {
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

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
