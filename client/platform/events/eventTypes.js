// =============================================================================
// eventTypes.js — Canonical event name constants.
// Use these instead of string literals when dispatching/subscribing via EventBus.
// =============================================================================

// --- Todos lifecycle ---
export const TODOS_CHANGED = "todos:changed";
export const TODOS_RENDER = "todos:render";

// --- Project lifecycle ---
export const PROJECT_SELECTED = "project:selected";

// --- Drawer lifecycle ---
export const DRAWER_OPENED = "drawer:opened";
export const DRAWER_CLOSED = "drawer:closed";

// --- Agent lifecycle ---
export const AGENT_RUN_REQUESTED = "agent:run:requested";
export const AGENT_RUN_STARTED = "agent:run:started";
export const AGENT_RUN_COMPLETED = "agent:run:completed";
export const AGENT_RUN_FAILED = "agent:run:failed";
