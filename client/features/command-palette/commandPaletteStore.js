// =============================================================================
// commandPaletteStore.js — Feature-scoped store for the command palette.
//
// Demonstrates the createStore/createSelector pattern. The global state
// object (store.js) still holds the canonical properties for backward
// compatibility — this module provides selectors and a future migration
// path toward a self-contained feature store.
// =============================================================================

import { state } from "../../modules/store.js";
import { createSelector } from "../../platform/state/createSelector.js";

// ---------------------------------------------------------------------------
// Selectors — stable read interface over command palette state
// ---------------------------------------------------------------------------

export function isCommandPaletteOpen() {
  return state.isCommandPaletteOpen;
}

export function getCommandPaletteQuery() {
  return state.commandPaletteQuery;
}

export function getCommandPaletteIndex() {
  return state.commandPaletteIndex;
}

export function getCommandPaletteItems() {
  return state.commandPaletteItems;
}

export function getSelectableItems() {
  return state.commandPaletteSelectableItems;
}

export function getActiveItem() {
  return state.commandPaletteSelectableItems[state.commandPaletteIndex] || null;
}

export function getLastFocusedBeforePalette() {
  return state.lastFocusedBeforePalette;
}

// ---------------------------------------------------------------------------
// Memoized selector — demonstrates createSelector() usage
// ---------------------------------------------------------------------------

export const getFilteredCommandCount = createSelector(
  () => state.commandPaletteSelectableItems,
  (items) => items.length,
);
