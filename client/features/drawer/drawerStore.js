// =============================================================================
// drawerStore.js — State-driven drawer visibility model.
//
// Centralizes drawer mode and entity tracking. All drawer open/close/mode
// changes should go through these actions so behavior is predictable.
// =============================================================================

import { state } from "../../modules/store.js";

/**
 * @typedef {'closed'|'todoDetails'|'projectDetails'|'agentRun'} DrawerMode
 */

/**
 * Get the current drawer state.
 * @returns {{ mode: DrawerMode, entityId: string|null, isOpen: boolean }}
 */
export function getDrawerState() {
  return {
    mode: state.isTodoDrawerOpen ? "todoDetails" : "closed",
    entityId: state.selectedTodoId || null,
    isOpen: state.isTodoDrawerOpen,
  };
}

/**
 * Check if the drawer is currently open.
 * @returns {boolean}
 */
export function isDrawerOpen() {
  return state.isTodoDrawerOpen;
}

/**
 * Get the entity ID currently shown in the drawer.
 * @returns {string|null}
 */
export function getDrawerEntityId() {
  return state.selectedTodoId || null;
}

/**
 * Check if the drawer details panel is expanded.
 * @returns {boolean}
 */
export function isDrawerDetailsExpanded() {
  return state.isDrawerDetailsOpen;
}
