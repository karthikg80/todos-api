// initApp.js — App bootstrap sequence.
// Initializes features, binds handlers, processes auth state, and boots the app.
//
// Extracted from app.js — no behavior change.
// ---------------------------------------------------------------------------

import {
  bindDeclarativeHandlers,
  registerServiceWorker,
} from "./initGlobalListeners.js";

/**
 * @param {object} d — flat bag of every function / constant init needs.
 */
export function initApp(d) {
  // Initialize theme immediately
  d.initTheme();

  // Initialize UI mode from localStorage (canonical key: todos:ui-mode)
  try {
    let mode = localStorage.getItem("todos:ui-mode");
    // One-time migration from legacy key
    if (!mode) {
      const legacy = localStorage.getItem("simpleMode");
      if (legacy === "1") mode = "simple";
      if (legacy !== null) localStorage.removeItem("simpleMode");
    }
    mode = mode || "advanced";
    localStorage.setItem("todos:ui-mode", mode);
    if (mode === "simple") document.body.classList.add("simple-mode");
    const select = document.getElementById("uiModeSelect");
    if (select instanceof HTMLSelectElement) select.value = mode;
  } catch {}

  // Initialize on load
  registerServiceWorker();
  bindDeclarativeHandlers();
  init(d);

  // After init, redirect simple-mode users away from hidden workspace views
  if (document.body.classList.contains("simple-mode")) {
    const active = document.querySelector(
      ".workspace-view-item.projects-rail-item--active",
    );
    const view = active?.getAttribute("data-workspace-view");
    if (view && ["home", "triage"].includes(view)) {
      const allBtn = document.querySelector(
        '[data-workspace-view="all"].workspace-view-item',
      );
      if (allBtn instanceof HTMLElement) allBtn.click();
    }
  }
}

function init(d) {
  console.warn("[init] START");
  d.initTodosFeature();
  d.initProjectsFeature();
  d.initTaskDetailSurface();
  d.bindResponsiveLayoutState();
  d.renderSidebarNavigation();
  d.bindCriticalHandlers();
  d.bindTodoDrawerHandlers();
  d.bindTaskDetailSurfaceHandlers();
  d.bindInboxHandlers();
  d.bindWeeklyReviewHandlers();
  d.bindCleanupHandlers();
  d.bindProjectsRailHandlers();
  d.bindCommandPaletteHandlers();
  d.bindTaskComposerHandlers();
  d.bindCaptureComposerHandlers();
  d.bindDockHandlers();
  d.OnCreateAssist.bindOnCreateAssistHandlers();
  d.bindQuickEntryNaturalDateHandlers();

  // Handle social login callback before anything else — the URL contains
  // ?auth=success&token=...&refreshToken=... after Google/Apple OAuth redirect.
  d.handleSocialCallback();

  // Check for password-reset token in URL (only when NOT a social auth callback)
  const urlParams = new URLSearchParams(window.location.search);
  const isSocialCallback = urlParams.has("auth");
  const resetToken = !isSocialCallback ? urlParams.get("token") : null;

  if (resetToken) {
    d.showResetPassword(resetToken);
    return;
  }

  // Auto-show auth form when ?tab= param is present (bypasses landing page)
  const tabParam = urlParams.get("tab");
  if (tabParam && typeof window.showAuthPage === "function") {
    window.showAuthPage(tabParam);
  }

  const {
    token,
    refreshToken: refresh,
    user,
    invalidUserData,
    error,
  } = d.loadStoredSession();

  if (invalidUserData) {
    console.error("Invalid stored user data. Clearing auth state.", error);
    d.persistSession({
      authToken: null,
      refreshToken: null,
      currentUser: null,
    });
  }

  // Listen for offline sync completion from service worker
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "offline-sync-complete") {
        const { replayed, failed } = event.data;
        if (replayed > 0) {
          d.loadTodos();
          d.hooks.showMessage?.(
            "todosMessage",
            `Synced ${replayed} offline task${replayed === 1 ? "" : "s"}${failed > 0 ? ` (${failed} failed)` : ""}`,
            "success",
          );
        }
      }
    });
    // Notify service worker when back online (fallback for no Background Sync)
    window.addEventListener("online", () => {
      navigator.serviceWorker.controller?.postMessage({
        type: "online-reconnect",
      });
    });
  }

  if (token && user) {
    d.state.authToken = token;
    d.state.refreshToken = refresh;
    d.state.currentUser = user;
    d.setAuthState(d.AUTH_STATE.AUTHENTICATED);
    d.showAppView();
    d.trackEvent("session_start", { metadata: { source: "stored_session" } });
    d.loadUserProfile();
  } else if (token && !user) {
    // Social login (Google/Apple) stores tokens but not the user object.
    // Fetch the profile before giving up — if it succeeds we're authenticated.
    d.state.authToken = token;
    d.state.refreshToken = refresh;
    d.setAuthState(d.AUTH_STATE.AUTHENTICATED);
    d.showAppView();
    d.loadUserProfile().catch(() => {
      // Token was invalid or expired — fall back to login screen.
      d.persistSession({
        authToken: null,
        refreshToken: null,
        currentUser: null,
      });
      d.setAuthState(d.AUTH_STATE.UNAUTHENTICATED);
    });
  } else {
    d.setAuthState(d.AUTH_STATE.UNAUTHENTICATED);
  }
  d.OnCreateAssist.renderOnCreateAssistRow();
  d.setQuickEntryPropertiesOpen(d.readStoredQuickEntryPropertiesOpenState(), {
    persist: false,
  });
  d.syncQuickEntryProjectActions();
  d.renderProjectHeadingCreateButton();
  d.renderQuickEntryNaturalDueChip();
  d.handleVerificationStatusFromUrl();
  // handleSocialCallback() moved earlier in init() — before resetToken check
  d.initSocialLogin();
  d.bindRailSearchFocusBehavior();
}
