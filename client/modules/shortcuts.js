// =============================================================================
// shortcuts.js — Keyboard shortcuts overlay toggle.
// Imports only from store.js. Cross-module calls go through hooks.DialogManager.
// =============================================================================

import { hooks } from "./store.js";

// ========== PHASE A: KEYBOARD SHORTCUTS ==========
function toggleShortcuts() {
  const overlay = document.getElementById("shortcutsOverlay");
  if (!overlay) return;
  const isNowOpen = !overlay.classList.contains("active");
  overlay.classList.toggle("active");
  if (isNowOpen) {
    hooks.DialogManager.open("shortcuts", overlay, {
      onEscape: toggleShortcuts,
      backdrop: false,
    });
  } else {
    hooks.DialogManager.close("shortcuts");
  }
}

function closeShortcutsOverlay(event) {
  if (event.target.id === "shortcutsOverlay") {
    toggleShortcuts();
  }
}

export { toggleShortcuts, closeShortcutsOverlay };
