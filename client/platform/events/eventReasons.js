// =============================================================================
// eventReasons.js — Canonical reason constants for EventBus payloads.
//
// These replace the ad-hoc string literals used as { reason: "..." } payloads
// in EventBus.dispatch("todos:changed", { reason }) calls across modules.
// =============================================================================

// --- Todo mutation reasons ---
export const TODO_ADDED = "todo-added";
export const TODO_TOGGLED = "todo-toggled";
export const TODO_DELETED = "todo-deleted";
export const TODO_UPDATED = "todo-updated";
export const TODOS_LOADING = "todos-loading";
export const TODOS_LOADED = "todos-loaded";
export const TODOS_LOAD_ERROR = "todos-load-error";
export const TODOS_REORDERED = "todos-reordered";

// --- Bulk action reasons ---
export const BULK_ACTION = "bulk-action";

// --- Undo reasons ---
export const UNDO_APPLIED = "undo-applied";

// --- Project reasons ---
export const PROJECT_SELECTED = "project-selected";

// --- State change reasons ---
export const STATE_CHANGED = "state-changed";

// --- Onboarding reasons ---
export const ONBOARDING_COMPLETE = "onboarding-complete";
