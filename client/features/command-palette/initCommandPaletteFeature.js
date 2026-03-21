// =============================================================================
// initCommandPaletteFeature.js — Feature initializer for the command palette.
//
// Registers hooks for selectors so other modules can access command palette
// state through the hooks registry instead of importing directly.
// =============================================================================

import { hooks } from "../../modules/store.js";
import {
  isCommandPaletteOpen,
  getActiveItem,
  getFilteredCommandCount,
} from "./commandPaletteStore.js";

export function initCommandPaletteFeature() {
  hooks.isCommandPaletteOpen = isCommandPaletteOpen;
  hooks.getActiveCommandPaletteItem = getActiveItem;
  hooks.getFilteredCommandCount = getFilteredCommandCount;
}
