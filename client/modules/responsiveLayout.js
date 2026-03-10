// =============================================================================
// responsiveLayout.js — Shared viewport and rail presentation state.
// Owns one responsive breakpoint source for JS consumers.
// =============================================================================

import { state, hooks } from "./store.js";
import { applyUiAction } from "./stateActions.js";

function getResponsiveMediaQuery() {
  return hooks.MOBILE_DRAWER_MEDIA_QUERY || "(max-width: 768px)";
}

function readIsMobileViewport() {
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(getResponsiveMediaQuery()).matches;
  }
  return window.innerWidth <= 768;
}

function applyResponsiveDomState() {
  const isMobile = state.viewportMode === "mobile";
  document.body.dataset.viewportMode = state.viewportMode;
  document.body.dataset.railPresentationMode = state.railPresentationMode;
  document.body.classList.toggle("is-mobile-viewport", isMobile);
  document.body.classList.toggle("is-desktop-viewport", !isMobile);
}

export function isMobileViewport() {
  return state.viewportMode === "mobile";
}

export function getRailPresentationMode() {
  return (
    state.railPresentationMode || (isMobileViewport() ? "sheet" : "sidebar")
  );
}

export function syncResponsiveLayoutState({ notify = true } = {}) {
  const wasMobile = isMobileViewport();
  const nextIsMobile = readIsMobileViewport();

  applyUiAction("viewport/mode:set", {
    mode: nextIsMobile ? "mobile" : "desktop",
  });
  applyUiAction("rail/presentation:set", {
    mode: nextIsMobile ? "sheet" : "sidebar",
  });
  applyResponsiveDomState();

  if (!notify || wasMobile === nextIsMobile) {
    return;
  }

  hooks.onResponsiveLayoutChanged?.({
    isMobileViewport: nextIsMobile,
    railPresentationMode: getRailPresentationMode(),
  });
}

export function bindResponsiveLayoutState() {
  if (window.__responsiveLayoutStateBound) {
    syncResponsiveLayoutState({ notify: false });
    return;
  }
  window.__responsiveLayoutStateBound = true;

  const handleChange = () => {
    syncResponsiveLayoutState({ notify: true });
  };

  if (typeof window.matchMedia === "function") {
    const mediaQueryList = window.matchMedia(getResponsiveMediaQuery());
    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
    } else if (typeof mediaQueryList.addListener === "function") {
      mediaQueryList.addListener(handleChange);
    }
  }

  window.addEventListener("orientationchange", handleChange);
  syncResponsiveLayoutState({ notify: false });
}
