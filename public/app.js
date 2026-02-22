// Configuration
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : window.location.origin;

// ---------------------------------------------------------------------------
// Module consumption — extracted pure-function modules loaded before app.js
// via <script defer> in index.html (see state.js, apiClient.js pattern).
// ---------------------------------------------------------------------------
const {
  escapeHtml,
  showMessage,
  hideMessage,
  PROJECT_PATH_SEPARATOR,
  MOBILE_DRAWER_MEDIA_QUERY,
} = window.Utils || {};
const {
  LINT_VAGUE_WORDS,
  LINT_VAGUE_WORDS_ON_CREATE,
  LINT_URGENCY_WORDS,
  lintTodoFields,
  renderLintChip,
} = window.LintHeuristics || {};
const {
  splitProjectPath,
  normalizeProjectPath,
  compareProjectPaths,
  expandProjectTree,
  getProjectDepth,
  getProjectLeafName,
  renderProjectOptionEntry,
} = window.ProjectPathUtils || {};
const {
  padIcsNumber,
  toIcsUtcTimestamp,
  toIcsDateValue,
  escapeIcsText,
  foldIcsLine,
  buildIcsContentForTodos,
  buildIcsFilename,
} = window.IcsExport || {};
const { initTheme, toggleTheme } = window.ThemeModule || {};
const {
  AI_DEBUG_ENABLED,
  ON_CREATE_SURFACE,
  TODAY_PLAN_SURFACE,
  AI_SURFACE_TYPES,
  AI_SURFACE_IMPACT,
  isKnownSuggestionType,
  impactRankForSurface,
  sortSuggestions,
  capSuggestions,
  confidenceBand,
  confidenceLabel,
  labelForType,
  truncateRationale,
  needsConfirmation,
  shouldRenderTypeForSurface,
  renderAiDebugMeta,
  renderAiDebugSuggestionId,
} = window.AiSuggestionUtils || {};

function readBooleanFeatureFlag(flagKey) {
  try {
    const rawValue = window.localStorage.getItem(flagKey);
    return rawValue === "1" || rawValue === "true";
  } catch {
    return false;
  }
}

function isEnhancedTaskCriticEnabled() {
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("enhancedCritic");
  if (queryValue === "1" || queryValue === "true") return true;
  if (queryValue === "0" || queryValue === "false") return false;
  return readBooleanFeatureFlag("feature.enhancedTaskCritic");
}

const FEATURE_ENHANCED_TASK_CRITIC = isEnhancedTaskCriticEnabled();

function isTaskDrawerDecisionAssistEnabled() {
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("taskDrawerAssist");
  if (queryValue === "1" || queryValue === "true") return true;
  if (queryValue === "0" || queryValue === "false") return false;
  return readBooleanFeatureFlag("feature.taskDrawerDecisionAssist");
}

const FEATURE_TASK_DRAWER_DECISION_ASSIST = isTaskDrawerDecisionAssistEnabled();

// Categories that are assigned automatically by server-side AI flows and must
// not surface as user-navigable project entries in the rail, the
// #categoryFilter dropdown, or the create-form project picker.
// Todos that carry these categories are intentionally preserved in the data
// layer and remain visible under "All Tasks"; they are only excluded from
// navigation surfaces.
const AI_INTERNAL_CATEGORIES = new Set(["AI Plan"]);

function isInternalCategoryPath(value) {
  const normalized = normalizeProjectPath(value);
  if (!normalized) return false;
  for (const internal of AI_INTERNAL_CATEGORIES) {
    if (
      normalized === internal ||
      normalized.startsWith(`${internal}${PROJECT_PATH_SEPARATOR}`)
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Lint heuristics provided by lintHeuristics.js (lintTodoFields, renderLintChip)
// ---------------------------------------------------------------------------

// AppState and ApiClient are loaded by state.js and apiClient.js (both
// <script defer> before app.js).  No inline fallback is needed — if either
// module is missing the app cannot function and we fail fast.
const AppStateModule = window.AppState;
const ApiClientModule = window.ApiClient;

let currentUser = null;
let authToken = null;
let refreshToken = null;
let todos = [];
let users = [];
let aiSuggestions = [];
let aiUsage = null;
let aiInsights = null;
let aiFeedbackSummary = null;
let latestCritiqueSuggestionId = null;
let latestCritiqueResult = null;
let latestCritiqueRequestId = 0;
let critiqueRequestsInFlight = 0;
let latestPlanSuggestionId = null;
let latestPlanResult = null;
let planDraftState = null;
let isPlanGenerateInFlight = false;
let isPlanApplyInFlight = false;
let isPlanDismissInFlight = false;
let planGenerateSource = null;
let adminBootstrapAvailable = false;
let customProjects = [];
let projectRecords = [];
let editingTodoId = null;
const {
  AUTH_STATE,
  EMAIL_ACTION_TIMEOUT_MS,
  loadStoredSession,
  persistSession,
} = AppStateModule;
let authState = AUTH_STATE.UNAUTHENTICATED;
let currentDateView = "all";
let isMoreFiltersOpen = false;
let selectedTodoId = null;
let lastFocusedTodoTrigger = null;
let isTodoDrawerOpen = false;
let isDrawerDetailsOpen = false;
let openTodoKebabId = null;
let drawerSaveState = "idle";
let drawerSaveMessage = "";
let drawerDraft = null;
let drawerSaveSequence = 0;
let drawerDescriptionSaveTimer = null;
let drawerSaveResetTimer = null;
let drawerScrollLockY = 0;
let isDrawerBodyLocked = false;
let taskDrawerAssistState = createInitialTaskDrawerAssistState();
let lastFocusedTodoId = null;
let todosLoadState = "idle";
let todosLoadErrorMessage = "";
let isRailCollapsed = false;
let isRailSheetOpen = false;
let railRovingFocusKey = "";
let railScrollLockY = 0;
let isRailBodyLocked = false;
let lastFocusedRailTrigger = null;
let openRailProjectMenuKey = null;
let isProjectCrudModalOpen = false;
let projectCrudMode = "create";
let projectCrudTargetProject = "";
let lastProjectCrudOpener = null;
let isCommandPaletteOpen = false;
let commandPaletteQuery = "";
let commandPaletteIndex = 0;
let commandPaletteItems = [];
let commandPaletteSelectableItems = [];
let lastFocusedBeforePalette = null;
let isApplyingFiltersPipeline = false;
// PROJECT_PATH_SEPARATOR, MOBILE_DRAWER_MEDIA_QUERY — from utils.js
// ON_CREATE_SURFACE, TODAY_PLAN_SURFACE — from aiSuggestionUtils.js
// AI_DEBUG_ENABLED, AI_SURFACE_TYPES, AI_SURFACE_IMPACT — from aiSuggestionUtils.js
const PROJECTS_RAIL_COLLAPSED_STORAGE_KEY = "todos:projects-rail-collapsed";
const AI_WORKSPACE_COLLAPSED_STORAGE_KEY = "todos:ai-collapsed";
const AI_WORKSPACE_VISIBLE_STORAGE_KEY = "todos:ai-visible";
const AI_ON_CREATE_DISMISSED_STORAGE_KEY = "todos:ai-on-create-dismissed";
const SIDEBAR_NAV_ITEMS = [
  { view: "todos", label: "Todos" },
  { view: "settings", label: "Settings" },
];
let isAiWorkspaceCollapsed = true;
let isAiWorkspaceVisible = AI_DEBUG_ENABLED;
let onCreateAssistState = createInitialOnCreateAssistState();
let suppressOnCreateAssistInput = false;
onCreateAssistState.dismissedTodoIds = loadOnCreateDismissedTodoIds();
let todayPlanState = createInitialTodayPlanState();
let todayPlanGenerationSeq = 0;
let isQuickEntryPropertiesOpen = false;

function emitAiSuggestionUndoTelemetry({
  surface,
  aiSuggestionDbId,
  suggestionId,
  todoId,
  selectedTodoIdsCount,
}) {
  try {
    console.info(
      JSON.stringify({
        type: "ai_decision_assist_telemetry",
        eventName: "ai_suggestion_undo",
        surface,
        aiSuggestionDbId: aiSuggestionDbId || undefined,
        suggestionId: suggestionId || undefined,
        todoId: todoId || undefined,
        selectedTodoIdsCount:
          typeof selectedTodoIdsCount === "number" &&
          Number.isFinite(selectedTodoIdsCount)
            ? Math.max(0, Math.floor(selectedTodoIdsCount))
            : undefined,
        ts: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.warn("AI undo telemetry emit failed:", error);
  }
}

function handleAuthFailure() {
  logout();
}

function handleAuthTokens(nextToken, nextRefreshToken) {
  authToken = nextToken;
  refreshToken = nextRefreshToken;
  persistSession({ authToken, refreshToken, currentUser });
}

const apiClient = ApiClientModule.createApiClient({
  apiUrl: API_URL,
  getAuthToken: () => authToken,
  getRefreshToken: () => refreshToken,
  getAuthState: () => authState,
  setAuthState,
  onAuthFailure: handleAuthFailure,
  onAuthTokens: handleAuthTokens,
});

function setAuthState(nextState) {
  authState = nextState;
}

function projectStorageKey() {
  return `todo-projects:${currentUser?.id || "anonymous"}`;
}

function syncProjectsRailHost() {
  const projectsRail = document.getElementById("projectsRail");
  const projectsRailHost = document.getElementById("projectsRailHost");
  const todosLayout = document.querySelector(".todos-layout");
  if (!(todosLayout instanceof HTMLElement)) return;

  if (!(projectsRail instanceof HTMLElement)) {
    todosLayout.classList.remove("todos-layout--sidebar-mounted");
    return;
  }

  if (
    projectsRailHost instanceof HTMLElement &&
    projectsRail.parentElement !== projectsRailHost
  ) {
    projectsRailHost.appendChild(projectsRail);
  }

  todosLayout.classList.toggle(
    "todos-layout--sidebar-mounted",
    projectsRailHost instanceof HTMLElement &&
      projectsRail.parentElement === projectsRailHost,
  );
}

function renderSidebarNavigation() {
  const navTargets = document.querySelectorAll("[data-sidebar-nav-target]");
  if (!navTargets.length) return;

  const navMarkup = SIDEBAR_NAV_ITEMS.map(
    ({ view, label }) => `
      <button
        type="button"
        class="projects-rail-item sidebar-nav-item"
        data-sidebar-view="${escapeHtml(view)}"
        data-onclick="switchView('${escapeHtml(view)}')"
      >
        <span>${escapeHtml(label)}</span>
      </button>
    `,
  ).join("");

  navTargets.forEach((target) => {
    if (!(target instanceof HTMLElement)) return;
    if (target.innerHTML === navMarkup) return;
    target.innerHTML = navMarkup;
  });
}

function setSettingsPaneVisible(isVisible) {
  const settingsPane = document.getElementById("settingsPane");
  const todosView = document.getElementById("todosView");
  if (!(settingsPane instanceof HTMLElement)) return;

  settingsPane.hidden = !isVisible;
  if (todosView instanceof HTMLElement) {
    todosView.classList.toggle("todos-view--settings-active", isVisible);
  }
}

function setTodosViewBodyState(isTodosView) {
  document.body.classList.toggle("is-todos-view", isTodosView);
  syncProjectsRailHost();
}

function readStoredRailCollapsedState() {
  try {
    return (
      window.localStorage.getItem(PROJECTS_RAIL_COLLAPSED_STORAGE_KEY) === "1"
    );
  } catch (error) {
    return false;
  }
}

function persistRailCollapsedState(isCollapsed) {
  try {
    window.localStorage.setItem(
      PROJECTS_RAIL_COLLAPSED_STORAGE_KEY,
      isCollapsed ? "1" : "0",
    );
  } catch (error) {
    // Ignore storage failures.
  }
}

function readStoredAiWorkspaceCollapsedState() {
  try {
    const stored = window.localStorage.getItem(
      AI_WORKSPACE_COLLAPSED_STORAGE_KEY,
    );
    if (stored === null) return true;
    return stored === "1";
  } catch (error) {
    return true;
  }
}

function readStoredAiWorkspaceVisibleState() {
  if (AI_DEBUG_ENABLED) return true;
  try {
    const stored = window.localStorage.getItem(
      AI_WORKSPACE_VISIBLE_STORAGE_KEY,
    );
    if (stored === null) return false;
    return stored === "1";
  } catch (error) {
    return false;
  }
}

function persistAiWorkspaceCollapsedState(isCollapsed) {
  try {
    window.localStorage.setItem(
      AI_WORKSPACE_COLLAPSED_STORAGE_KEY,
      isCollapsed ? "1" : "0",
    );
  } catch (error) {
    // Ignore storage failures.
  }
}

function persistAiWorkspaceVisibleState(isVisible) {
  try {
    window.localStorage.setItem(
      AI_WORKSPACE_VISIBLE_STORAGE_KEY,
      isVisible ? "1" : "0",
    );
  } catch (error) {
    // Ignore storage failures.
  }
}

function setQuickEntryPropertiesOpen(nextOpen) {
  isQuickEntryPropertiesOpen = !!nextOpen;
  const panel = document.getElementById("quickEntryPropertiesPanel");
  const toggle = document.getElementById("quickEntryPropertiesToggle");
  if (panel instanceof HTMLElement) {
    panel.hidden = !isQuickEntryPropertiesOpen;
  }
  if (toggle instanceof HTMLElement) {
    toggle.setAttribute("aria-expanded", String(isQuickEntryPropertiesOpen));
    toggle.classList.toggle(
      "quick-entry-properties-toggle--active",
      isQuickEntryPropertiesOpen,
    );
  }
}

function syncQuickEntryProjectActions() {
  const projectSelect = document.getElementById("todoProjectSelect");
  const createSubprojectButton = document.getElementById(
    "quickEntryCreateSubprojectButton",
  );
  const renameProjectButton = document.getElementById(
    "quickEntryRenameProjectButton",
  );
  const hasProjectSelected =
    projectSelect instanceof HTMLSelectElement && !!projectSelect.value;

  [createSubprojectButton, renameProjectButton].forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    button.hidden = !hasProjectSelected;
    button.setAttribute("aria-hidden", String(!hasProjectSelected));
  });
}

function getAiWorkspaceElements() {
  const workspace = document.getElementById("aiWorkspace");
  const toggle = document.getElementById("aiWorkspaceToggle");
  const body = document.getElementById("aiWorkspaceBody");
  const chevron = document.getElementById("aiWorkspaceToggleChevron");
  const status = document.getElementById("aiWorkspaceStatus");
  if (
    !(workspace instanceof HTMLElement) ||
    !(toggle instanceof HTMLElement) ||
    !(body instanceof HTMLElement)
  ) {
    return null;
  }
  return { workspace, toggle, body, chevron, status };
}

function getAiWorkspaceStatusLabel() {
  if (isPlanGenerateInFlight) {
    return "Working";
  }
  if (latestPlanResult || latestCritiqueResult) {
    return "Draft open";
  }
  return "Ready";
}

function updateAiWorkspaceStatusChip() {
  const refs = getAiWorkspaceElements();
  if (!refs || !(refs.status instanceof HTMLElement)) {
    return;
  }
  refs.status.textContent = getAiWorkspaceStatusLabel();
}

function syncAiWorkspaceVisibility(visible) {
  const refs = getAiWorkspaceElements();
  if (refs) {
    refs.workspace.hidden = !visible;
  }
  const critiqueButton = document.getElementById("critiqueDraftButton");
  if (critiqueButton instanceof HTMLElement) {
    critiqueButton.hidden = !visible;
  }
}

function setAiWorkspaceVisible(visible, { persist = true } = {}) {
  isAiWorkspaceVisible = AI_DEBUG_ENABLED ? true : !!visible;
  syncAiWorkspaceVisibility(isAiWorkspaceVisible);
  if (persist && !AI_DEBUG_ENABLED) {
    persistAiWorkspaceVisibleState(isAiWorkspaceVisible);
  }
}

function setAiWorkspaceCollapsed(
  collapsed,
  { persist = true, restoreFocus = false } = {},
) {
  isAiWorkspaceCollapsed = !!collapsed;
  const refs = getAiWorkspaceElements();
  if (refs) {
    refs.workspace.classList.toggle(
      "ai-workspace--collapsed",
      isAiWorkspaceCollapsed,
    );
    refs.toggle.setAttribute(
      "aria-expanded",
      isAiWorkspaceCollapsed ? "false" : "true",
    );
    refs.body.hidden = isAiWorkspaceCollapsed;
    if (refs.chevron instanceof HTMLElement) {
      refs.chevron.textContent = isAiWorkspaceCollapsed ? "▸" : "▾";
    }
  }
  if (persist) {
    persistAiWorkspaceCollapsedState(isAiWorkspaceCollapsed);
  }
  updateAiWorkspaceStatusChip();
  if (restoreFocus && refs) {
    refs.toggle.focus({ preventScroll: true });
  }
}

function toggleAiWorkspace() {
  setAiWorkspaceCollapsed(!isAiWorkspaceCollapsed);
}

function focusAiWorkspaceTarget(targetId) {
  const target = document.getElementById(targetId);
  if (target instanceof HTMLElement) {
    target.focus({ preventScroll: true });
  }
}

function openAiWorkspaceForBrainDump() {
  setAiWorkspaceVisible(true);
  setAiWorkspaceCollapsed(false);
  focusAiWorkspaceTarget("brainDumpInput");
}

function openAiWorkspaceForGoalPlan() {
  setAiWorkspaceVisible(true);
  setAiWorkspaceCollapsed(false);
  focusAiWorkspaceTarget("goalInput");
}

function loadCustomProjects() {
  try {
    const raw = localStorage.getItem(projectStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    customProjects = Array.isArray(parsed)
      ? [
          ...new Set(
            parsed
              .filter((item) => typeof item === "string")
              .map((item) => normalizeProjectPath(item))
              .filter(Boolean),
          ),
        ].sort(compareProjectPaths)
      : [];
  } catch (error) {
    console.error("Failed to load custom projects:", error);
    customProjects = [];
  }
}

function saveCustomProjects() {
  try {
    localStorage.setItem(projectStorageKey(), JSON.stringify(customProjects));
  } catch (error) {
    console.error("Failed to save custom projects:", error);
  }
}

async function loadProjects() {
  try {
    const response = await apiCall(`${API_URL}/projects`);
    if (!response || !response.ok) {
      return;
    }
    const data = await response.json();
    projectRecords = Array.isArray(data) ? data : [];
    const projectNames = Array.isArray(data)
      ? data
          .map((item) => normalizeProjectPath(item?.name))
          .filter((name) => typeof name === "string" && name.length > 0)
      : [];
    customProjects = expandProjectTree([...customProjects, ...projectNames]);
    saveCustomProjects();
    updateProjectSelectOptions();
    updateCategoryFilter();
  } catch (error) {
    console.error("Failed to load projects:", error);
  }
}

function getProjectRecordByName(projectName) {
  const normalized = normalizeProjectPath(projectName);
  if (!normalized) {
    return null;
  }
  return (
    projectRecords.find(
      (record) => normalizeProjectPath(record?.name) === normalized,
    ) || null
  );
}

async function ensureProjectExists(projectName) {
  const normalized = normalizeProjectPath(projectName);
  if (!normalized) {
    return false;
  }
  try {
    const response = await apiCall(`${API_URL}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalized }),
    });
    if (response && (response.ok || response.status === 409)) {
      return true;
    }
    const data = response ? await parseApiBody(response) : {};
    showMessage(
      "todosMessage",
      data.error || "Failed to create project",
      "error",
    );
    return false;
  } catch (error) {
    console.error("Ensure project exists failed:", error);
    showMessage("todosMessage", "Failed to create project", "error");
    return false;
  }
}

// Initialize app
function init() {
  renderSidebarNavigation();
  bindCriticalHandlers();
  bindTodoDrawerHandlers();
  bindProjectsRailHandlers();
  bindCommandPaletteHandlers();
  bindOnCreateAssistHandlers();
  bindTodayPlanHandlers();

  // Check for reset token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get("token");

  if (resetToken) {
    showResetPassword(resetToken);
    return;
  }

  const {
    token,
    refreshToken: refresh,
    user,
    invalidUserData,
    error,
  } = loadStoredSession();

  if (invalidUserData) {
    console.error("Invalid stored user data. Clearing auth state.", error);
    persistSession({ authToken: null, refreshToken: null, currentUser: null });
  }

  if (token && user) {
    authToken = token;
    refreshToken = refresh;
    currentUser = user;
    setAuthState(AUTH_STATE.AUTHENTICATED);
    showAppView();
    loadUserProfile();
  } else {
    setAuthState(AUTH_STATE.UNAUTHENTICATED);
  }
  renderOnCreateAssistRow();
  setQuickEntryPropertiesOpen(false);
  syncQuickEntryProjectActions();
  handleVerificationStatusFromUrl();
}

function handleVerificationStatusFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const verified = urlParams.get("verified");
  if (!verified) {
    return;
  }

  const isSuccess = verified === "1";
  const message = isSuccess
    ? "Email verified successfully. You can now log in."
    : "Email verification failed or expired. Request a new verification email.";
  const type = isSuccess ? "success" : "error";

  if (currentUser) {
    if (isSuccess) {
      currentUser = { ...currentUser, isVerified: true };
      persistSession({ authToken, refreshToken, currentUser });
      updateUserDisplay();
    }
    const profileTab = document.querySelectorAll(".nav-tab")[1];
    switchView("profile", profileTab || null);
    showMessage("profileMessage", message, type);
  } else {
    showLogin();
    showMessage("authMessage", message, type);
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

const {
  apiCall,
  fetchWithTimeout,
  apiCallWithTimeout,
  isAbortError,
  parseApiBody,
} = apiClient;

// Switch auth tabs
function switchAuthTab(tab, triggerEl) {
  document
    .querySelectorAll(".auth-tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));

  if (triggerEl) {
    triggerEl.classList.add("active");
  }
  document.getElementById(tab + "Form").style.display = "block";
  hideMessage("authMessage");
}

// Show forgot password form
function showForgotPassword() {
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));
  document.getElementById("forgotPasswordForm").style.display = "block";
  document
    .querySelectorAll(".auth-tab")
    .forEach((t) => t.classList.remove("active"));
  hideMessage("authMessage");
}

// Show login form
function showLogin() {
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));
  document.getElementById("loginForm").style.display = "block";
  document.querySelectorAll(".auth-tab")[0].classList.add("active");
  hideMessage("authMessage");
}

// Show reset password form
function showResetPassword(token) {
  document.getElementById("resetPasswordForm").dataset.token = token;
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));
  document.getElementById("resetPasswordForm").style.display = "block";
}

// Handle login
async function handleLogin(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      authToken = data.token;
      refreshToken = data.refreshToken;
      currentUser = data.user;
      setAuthState(AUTH_STATE.AUTHENTICATED);
      persistSession({ authToken, refreshToken, currentUser });
      showAppView();
      loadUserProfile();
    } else {
      showMessage("authMessage", data.error || "Login failed", "error");
    }
  } catch (error) {
    showMessage("authMessage", "Network error. Please try again.", "error");
    console.error("Login error:", error);
  }
}

// Handle registration
async function handleRegister(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  const payload = { email, password };
  if (name) payload.name = name;

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      authToken = data.token;
      refreshToken = data.refreshToken;
      currentUser = data.user;
      setAuthState(AUTH_STATE.AUTHENTICATED);
      persistSession({ authToken, refreshToken, currentUser });
      showMessage("authMessage", "Account created successfully!", "success");
      setTimeout(() => {
        showAppView();
        loadUserProfile();
      }, 1000);
    } else {
      if (data.errors) {
        const errorMsg = data.errors.map((e) => e.message).join(", ");
        showMessage("authMessage", errorMsg, "error");
      } else {
        showMessage(
          "authMessage",
          data.error || "Registration failed",
          "error",
        );
      }
    }
  } catch (error) {
    showMessage("authMessage", "Network error. Please try again.", "error");
    console.error("Registration error:", error);
  }
}

// Handle forgot password
async function handleForgotPassword(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const email = document.getElementById("forgotEmail").value;
  const submitBtn = document.querySelector(
    "#forgotPasswordForm button[type='submit']",
  );
  const originalLabel = submitBtn ? submitBtn.textContent : "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
  }

  try {
    const response = await fetchWithTimeout(
      `${API_URL}/auth/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
      EMAIL_ACTION_TIMEOUT_MS,
    );

    const data = await parseApiBody(response);

    if (response.ok) {
      showMessage(
        "authMessage",
        data.message || "Reset link sent! Check your email.",
        "success",
      );
      setTimeout(showLogin, 3000);
    } else {
      showMessage(
        "authMessage",
        data.error || "Failed to send reset link",
        "error",
      );
    }
  } catch (error) {
    if (isAbortError(error)) {
      showMessage(
        "authMessage",
        "Request timed out. Please try again in a moment.",
        "error",
      );
    } else {
      showMessage("authMessage", "Network error. Please try again.", "error");
    }
    console.error("Forgot password error:", error);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel || "Send Reset Link";
    }
  }
}

// Handle reset password
async function handleResetPassword(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const token = document.getElementById("resetPasswordForm").dataset.token;
  const password = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (password !== confirm) {
    showMessage("authMessage", "Passwords do not match", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await response.json();

    if (response.ok) {
      showMessage(
        "authMessage",
        "Password reset successfully! Redirecting to login...",
        "success",
      );
      setTimeout(() => {
        window.location.href = window.location.pathname;
      }, 2000);
    } else {
      showMessage(
        "authMessage",
        data.error || "Failed to reset password",
        "error",
      );
    }
  } catch (error) {
    showMessage("authMessage", "Network error. Please try again.", "error");
    console.error("Reset password error:", error);
  }
}

// Load user profile
async function loadUserProfile() {
  try {
    const response = await apiCall(`${API_URL}/users/me`);
    if (response && response.ok) {
      const user = await response.json();
      currentUser = { ...currentUser, ...user };
      persistSession({ authToken, refreshToken, currentUser });
      updateUserDisplay();
      await loadAdminBootstrapStatus();

      // Check if admin and show admin tab
      if (user.role === "admin") {
        document.getElementById("adminNavTab").style.display = "block";
      }
    }
  } catch (error) {
    console.error("Load profile error:", error);
  }
}

// Update user display
function updateUserDisplay() {
  document.getElementById("userEmail").textContent = currentUser.email;

  const verifiedBadge = document.getElementById("verifiedBadge");
  if (currentUser.isVerified) {
    verifiedBadge.className = "verified-badge";
    verifiedBadge.textContent = "✓ Verified";
  } else {
    verifiedBadge.className = "unverified-badge";
    verifiedBadge.textContent = "Not Verified";
  }

  const adminBadge = document.getElementById("adminBadge");
  const isAdmin = currentUser.role === "admin";
  if (isAdmin) {
    adminBadge.className = "admin-badge";
    adminBadge.textContent = "⭐ Admin";
    adminBadge.style.display = "inline-block";
  } else {
    adminBadge.style.display = "none";
  }
  const adminNavTab = document.getElementById("adminNavTab");
  if (adminNavTab instanceof HTMLElement) {
    adminNavTab.style.display = isAdmin ? "block" : "none";
  }
  document.body.classList.toggle("is-admin-user", isAdmin);

  // Update profile view
  document.getElementById("profileEmail").textContent = currentUser.email;
  document.getElementById("profileName").textContent =
    currentUser.name || "Not set";
  document.getElementById("profileStatus").textContent = currentUser.isVerified
    ? "Verified ✓"
    : "Not Verified";
  document.getElementById("profileCreated").textContent = new Date(
    currentUser.createdAt,
  ).toLocaleDateString();
  document.getElementById("updateName").value = currentUser.name || "";
  document.getElementById("updateEmail").value = currentUser.email;

  // Show/hide verification banner
  const verificationBanner = document.getElementById("verificationBanner");
  if (verificationBanner) {
    verificationBanner.style.display = currentUser.isVerified
      ? "none"
      : "block";
  }

  const adminBootstrapSection = document.getElementById(
    "adminBootstrapSection",
  );
  if (adminBootstrapSection) {
    const shouldShow = adminBootstrapAvailable && currentUser.role !== "admin";
    adminBootstrapSection.style.display = shouldShow ? "block" : "none";
  }
}

async function loadAdminBootstrapStatus() {
  adminBootstrapAvailable = false;

  if (!currentUser || currentUser.role === "admin") {
    updateUserDisplay();
    return;
  }

  try {
    const response = await apiCall(`${API_URL}/auth/bootstrap-admin/status`);
    if (response && response.ok) {
      const status = await response.json();
      adminBootstrapAvailable = !!status.enabled;
    }
  } catch (error) {
    console.error("Load bootstrap status error:", error);
  } finally {
    updateUserDisplay();
  }
}

async function handleAdminBootstrap(event) {
  event.preventDefault();
  hideMessage("profileMessage");

  const secretInput = document.getElementById("adminBootstrapSecret");
  const secret = secretInput.value;
  if (!secret) {
    showMessage("profileMessage", "Bootstrap secret required", "error");
    return;
  }

  try {
    const response = await apiCall(`${API_URL}/auth/bootstrap-admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });

    const data = response ? await response.json() : {};
    if (response && response.ok) {
      currentUser = { ...currentUser, ...data.user };
      persistSession({ authToken, refreshToken, currentUser });
      adminBootstrapAvailable = false;
      document.getElementById("adminNavTab").style.display = "block";
      updateUserDisplay();
      secretInput.value = "";
      showMessage(
        "profileMessage",
        "Admin access granted for this account",
        "success",
      );
      return;
    }

    showMessage(
      "profileMessage",
      data.error || "Failed to grant admin access",
      "error",
    );
    if (data.error === "Admin already provisioned") {
      adminBootstrapAvailable = false;
      updateUserDisplay();
    }
  } catch (error) {
    showMessage("profileMessage", "Network error. Please try again.", "error");
    console.error("Bootstrap admin error:", error);
  }
}

// Resend verification email
async function resendVerification() {
  hideMessage("profileMessage");

  if (!currentUser || !currentUser.email) {
    showMessage("profileMessage", "User email not found", "error");
    return;
  }

  const resendBtn = document.getElementById("resendVerificationButton");
  const originalLabel = resendBtn ? resendBtn.textContent : "";
  if (resendBtn) {
    resendBtn.disabled = true;
    resendBtn.textContent = "Sending...";
  }

  try {
    const response = await apiCallWithTimeout(
      `${API_URL}/auth/resend-verification`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUser.email }),
      },
      EMAIL_ACTION_TIMEOUT_MS,
    );

    const data = response ? await parseApiBody(response) : {};

    if (response.ok) {
      showMessage(
        "profileMessage",
        "Verification email sent! Please check your inbox.",
        "success",
      );
    } else {
      showMessage(
        "profileMessage",
        data.error || "Failed to send verification email",
        "error",
      );
    }
  } catch (error) {
    if (isAbortError(error)) {
      showMessage(
        "profileMessage",
        "Request timed out. Please try again in a moment.",
        "error",
      );
    } else {
      showMessage(
        "profileMessage",
        "Network error. Please try again.",
        "error",
      );
    }
    console.error("Resend verification error:", error);
  } finally {
    if (resendBtn) {
      resendBtn.disabled = false;
      resendBtn.textContent = originalLabel || "Resend Email";
    }
  }
}

// Handle update profile
async function handleUpdateProfile(event) {
  event.preventDefault();
  hideMessage("profileMessage");

  const name = document.getElementById("updateName").value;
  const email = document.getElementById("updateEmail").value;

  try {
    const response = await apiCall(`${API_URL}/users/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || null, email }),
    });

    if (response && response.ok) {
      const updatedUser = await response.json();
      currentUser = { ...currentUser, ...updatedUser };
      persistSession({ authToken, refreshToken, currentUser });
      updateUserDisplay();
      showMessage("profileMessage", "Profile updated successfully!", "success");
    } else {
      const data = response ? await parseApiBody(response) : {};
      showMessage(
        "profileMessage",
        data.error || "Failed to update profile",
        "error",
      );
    }
  } catch (error) {
    showMessage("profileMessage", "Network error. Please try again.", "error");
    console.error("Update profile error:", error);
  }
}

// Build query params for the GET /todos request.  Today this sends sort
// params only; future work will add completed, priority, category (once the
// backend supports hierarchical matching), search, and date-range filters
// here — each as a single-line addition.
function buildTodosQueryParams() {
  const params = {};
  params.sortBy = "order";
  params.sortOrder = "asc";
  return params;
}

// Load todos
async function loadTodos() {
  todosLoadState = "loading";
  todosLoadErrorMessage = "";
  renderTodos();

  try {
    const queryParams = buildTodosQueryParams();
    const todosUrl = ApiClientModule.buildUrl(`${API_URL}/todos`, queryParams);
    const response = await apiCall(todosUrl);
    if (response && response.ok) {
      todos = await response.json();
      todosLoadState = "ready";
      todosLoadErrorMessage = "";

      renderTodos();
      refreshProjectCatalog();
    } else {
      todos = [];
      selectedTodos.clear();
      todosLoadState = "error";
      todosLoadErrorMessage = "Couldn't load tasks";
      renderTodos();
      refreshProjectCatalog();
      showMessage("todosMessage", "Failed to load todos", "error");
    }
  } catch (error) {
    todos = [];
    selectedTodos.clear();
    todosLoadState = "error";
    todosLoadErrorMessage = "Couldn't load tasks";
    renderTodos();
    refreshProjectCatalog();
    console.error("Load todos error:", error);
  }
}

function retryLoadTodos() {
  loadTodos();
}

async function loadAiSuggestions() {
  try {
    const response = await apiCall(`${API_URL}/ai/suggestions?limit=8`);
    if (!response || !response.ok) {
      aiSuggestions = [];
      renderAiSuggestionHistory();
      updateAiWorkspaceStatusChip();
      return;
    }

    aiSuggestions = await response.json();
    renderAiSuggestionHistory();
    updateAiWorkspaceStatusChip();
  } catch (error) {
    console.error("Load AI suggestions error:", error);
    aiSuggestions = [];
    renderAiSuggestionHistory();
    updateAiWorkspaceStatusChip();
  }
}

async function loadAiUsage() {
  try {
    const response = await apiCall(`${API_URL}/ai/usage`);
    if (!response || !response.ok) {
      aiUsage = null;
      renderAiUsageSummary();
      return;
    }

    aiUsage = await response.json();
    renderAiUsageSummary();
  } catch (error) {
    console.error("Load AI usage error:", error);
    aiUsage = null;
    renderAiUsageSummary();
  }
}

async function loadAiFeedbackSummary() {
  try {
    const response = await apiCall(
      `${API_URL}/ai/feedback-summary?days=30&reasonLimit=3`,
    );
    if (!response || !response.ok) {
      aiFeedbackSummary = null;
      renderAiFeedbackInsights();
      return;
    }

    aiFeedbackSummary = await response.json();
    renderAiFeedbackInsights();
  } catch (error) {
    console.error("Load AI feedback summary error:", error);
    aiFeedbackSummary = null;
    renderAiFeedbackInsights();
  }
}

async function loadAiInsights() {
  try {
    const response = await apiCall(`${API_URL}/ai/insights?days=7`);
    if (!response || !response.ok) {
      aiInsights = null;
      renderAiPerformanceInsights();
      return;
    }

    aiInsights = await response.json();
    renderAiPerformanceInsights();
  } catch (error) {
    console.error("Load AI insights error:", error);
    aiInsights = null;
    renderAiPerformanceInsights();
  }
}

function renderAiUsageSummary() {
  const container = document.getElementById("aiUsageSummary");
  if (!container) return;

  if (!aiUsage) {
    container.innerHTML = "";
    return;
  }

  const resetTime = aiUsage.resetAt
    ? new Date(aiUsage.resetAt).toLocaleString()
    : "N/A";

  container.innerHTML = `
    <div style="
      font-size: 0.85rem;
      color: var(--text-secondary);
      padding: 8px 10px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--input-bg);
    ">
      AI plan: <strong>${escapeHtml(String(aiUsage.plan || "free").toUpperCase())}</strong>.
      Usage today: <strong>${aiUsage.used}/${aiUsage.limit}</strong> used
      (${aiUsage.remaining} remaining). Resets: ${escapeHtml(resetTime)}
    </div>
  `;
}

function renderAiPerformanceInsights() {
  const container = document.getElementById("aiPerformanceInsights");
  if (!container) return;

  if (!aiInsights) {
    container.innerHTML = "";
    return;
  }

  const acceptanceRate = aiInsights.acceptanceRate;
  const recommendation =
    typeof aiInsights.recommendation === "string"
      ? aiInsights.recommendation
      : "";
  const ratedCount = Number(aiInsights.ratedCount) || 0;
  const generatedCount = Number(aiInsights.generatedCount) || 0;

  container.innerHTML = `
    <div style="
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--input-bg);
      padding: 10px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    ">
      <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
        AI Performance (7d)
      </div>
      <div>
        Generated: <strong>${generatedCount}</strong>,
        rated: <strong>${ratedCount}</strong>,
        acceptance: <strong>${
          acceptanceRate === null || acceptanceRate === undefined
            ? "N/A"
            : `${acceptanceRate}%`
        }</strong>
      </div>
      ${
        recommendation
          ? `<div style="margin-top: 6px;">Recommendation: ${escapeHtml(recommendation)}</div>`
          : ""
      }
    </div>
  `;
}

function renderAiFeedbackInsights() {
  const container = document.getElementById("aiFeedbackInsights");
  if (!container) return;

  if (!aiFeedbackSummary || aiFeedbackSummary.totalRated < 1) {
    container.innerHTML = "";
    return;
  }

  const totalRated = Number(aiFeedbackSummary.totalRated) || 0;
  const acceptedCount = Number(aiFeedbackSummary.acceptedCount) || 0;
  const rejectedCount = Number(aiFeedbackSummary.rejectedCount) || 0;
  const acceptedRate =
    totalRated > 0 ? Math.round((acceptedCount / totalRated) * 100) : 0;
  const topAcceptedReason =
    aiFeedbackSummary.acceptedReasons &&
    aiFeedbackSummary.acceptedReasons.length > 0
      ? aiFeedbackSummary.acceptedReasons[0]
      : null;
  const topRejectedReason =
    aiFeedbackSummary.rejectedReasons &&
    aiFeedbackSummary.rejectedReasons.length > 0
      ? aiFeedbackSummary.rejectedReasons[0]
      : null;

  container.innerHTML = `
    <div style="
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--input-bg);
      padding: 10px;
      font-size: 0.85rem;
      color: var(--text-secondary);
    ">
      <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
        AI Feedback Insights (30d)
      </div>
      <div>
        Acceptance rate: <strong>${acceptedRate}%</strong>
        (${acceptedCount}/${totalRated}), rejected: <strong>${rejectedCount}</strong>
      </div>
      ${
        topAcceptedReason
          ? `<div style="margin-top: 4px;">Top accepted reason: <strong>${escapeHtml(String(topAcceptedReason.reason))}</strong> (${topAcceptedReason.count})</div>`
          : ""
      }
      ${
        topRejectedReason
          ? `<div style="margin-top: 4px;">Top rejected reason: <strong>${escapeHtml(String(topRejectedReason.reason))}</strong> (${topRejectedReason.count})</div>`
          : ""
      }
    </div>
  `;
}

function renderAiSuggestionHistory() {
  const container = document.getElementById("aiSuggestionHistory");
  if (!container) return;

  if (!aiSuggestions.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">
      Recent AI suggestions
    </div>
    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
      ${aiSuggestions
        .map(
          (suggestion) => `
        <span style="
          font-size: 0.8rem;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          background: var(--input-bg);
        ">
          ${escapeHtml(suggestion.type)}: ${escapeHtml(suggestion.status)}
          ${
            suggestion.feedback && suggestion.feedback.reason
              ? ` (${escapeHtml(String(suggestion.feedback.reason))})`
              : ""
          }
        </span>
      `,
        )
        .join("")}
    </div>
  `;
}

async function updateSuggestionStatus(suggestionId, status, reason = null) {
  if (!suggestionId) return;
  try {
    const response = await apiCall(
      `${API_URL}/ai/suggestions/${suggestionId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      },
    );
    if (!response || !response.ok) {
      return false;
    }
    await loadAiSuggestions();
    await loadAiUsage();
    await loadAiInsights();
    await loadAiFeedbackSummary();
    return true;
  } catch (error) {
    console.error("Update suggestion status error:", error);
    return false;
  }
}

function getFeedbackReason(inputId, fallbackReason) {
  const input = document.getElementById(inputId);
  if (!input) return fallbackReason;
  const raw = String(input.value || "").trim();
  return raw || fallbackReason;
}

function toPlanDateInputValue(value) {
  if (!value || typeof value !== "string") return "";
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toISOString().slice(0, 10);
  }
  const parsed = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : "";
}

function normalizePlanDraftPriority(priority) {
  if (priority === "low" || priority === "medium" || priority === "high") {
    return priority;
  }
  return "medium";
}

function clonePlanDraftTask(task, index = 0) {
  const fallbackTempId = `task-${index + 1}`;
  const rawTempId = String(task?.tempId || "").trim();
  const tempId = rawTempId || fallbackTempId;
  const title = String(task?.title || "").trim();
  const description = task?.description ? String(task.description) : "";
  const projectName =
    task?.projectName ||
    task?.category ||
    task?.project ||
    task?.projectPath ||
    "";
  const subtasks = Array.isArray(task?.subtasks)
    ? task.subtasks
        .map((subtask, subtaskIndex) => {
          const subtaskTitle = String(subtask?.title || "").trim();
          if (!subtaskTitle) return null;
          return {
            tempId:
              String(subtask?.tempId || "").trim() ||
              `subtask-${index + 1}-${subtaskIndex + 1}`,
            title: subtaskTitle,
          };
        })
        .filter((item) => !!item)
    : [];

  return {
    tempId,
    title,
    description,
    projectName: String(projectName).trim(),
    dueDate: toPlanDateInputValue(task?.dueDate),
    priority: normalizePlanDraftPriority(task?.priority),
    subtasks,
  };
}

function initPlanDraftState(planResult) {
  const rawTasks = Array.isArray(planResult?.tasks) ? planResult.tasks : [];
  const seenTempIds = new Set();
  const tasks = rawTasks
    .map((task, index) => clonePlanDraftTask(task, index))
    .map((task, index) => {
      let nextTempId = task.tempId;
      if (seenTempIds.has(nextTempId)) {
        nextTempId = `${task.tempId}-${index + 1}`;
      }
      seenTempIds.add(nextTempId);
      return { ...task, tempId: nextTempId };
    })
    .filter((task) => task.title.length > 0);

  if (!tasks.length) {
    planDraftState = null;
    return;
  }

  const originalTasks = tasks.map((task, index) =>
    clonePlanDraftTask(task, index),
  );
  planDraftState = {
    summary: String(planResult?.summary || "Suggested plan"),
    originalTasks,
    workingTasks: originalTasks.map((task, index) =>
      clonePlanDraftTask(task, index),
    ),
    selectedTaskTempIds: new Set(originalTasks.map((task) => task.tempId)),
    statusSyncFailed: false,
  };
}

function clearPlanDraftState() {
  planDraftState = null;
}

function removeAppliedPlanDraftTasks(appliedTempIds) {
  if (!planDraftState || !appliedTempIds.size) return;
  planDraftState.workingTasks = planDraftState.workingTasks.filter(
    (task) => !appliedTempIds.has(task.tempId),
  );
  planDraftState.originalTasks = planDraftState.originalTasks.filter(
    (task) => !appliedTempIds.has(task.tempId),
  );
  planDraftState.selectedTaskTempIds = new Set(
    planDraftState.workingTasks
      .map((task) => task.tempId)
      .filter((tempId) => !appliedTempIds.has(tempId)),
  );
}

function isPlanActionBusy() {
  return isPlanGenerateInFlight || isPlanApplyInFlight || isPlanDismissInFlight;
}

function updatePlanGenerateButtonState() {
  const generateButton = document.getElementById("generatePlanButton");
  const brainDumpButton = document.getElementById("brainDumpPlanButton");
  const controlsDisabled = isPlanActionBusy();

  if (generateButton) {
    generateButton.disabled = controlsDisabled;
    generateButton.textContent =
      isPlanGenerateInFlight && planGenerateSource === "goal"
        ? "Generating..."
        : "Generate Plan";
  }

  if (brainDumpButton) {
    brainDumpButton.disabled = controlsDisabled;
    brainDumpButton.textContent =
      isPlanGenerateInFlight && planGenerateSource === "brain_dump"
        ? "Drafting..."
        : "Draft tasks from brain dump";
  }
  updateAiWorkspaceStatusChip();
}

function getSelectedPlanDraftTasks() {
  if (!planDraftState) return [];
  return planDraftState.workingTasks.filter((task) =>
    planDraftState.selectedTaskTempIds.has(task.tempId),
  );
}

function buildPlanTaskCreatePayload(task) {
  const title = String(task.title || "").trim();
  const description = String(task.description || "").trim();
  const projectName = normalizeProjectPath(task.projectName || "");

  const payload = {
    title,
    priority: normalizePlanDraftPriority(task.priority),
    description,
  };

  if (projectName) {
    payload.category = projectName;
  }

  if (task.dueDate) {
    payload.dueDate = `${task.dueDate}T12:00:00.000Z`;
  }

  return payload;
}

function renderCritiquePanel() {
  const panel = document.getElementById("aiCritiquePanel");
  if (!panel) return;

  if (!latestCritiqueResult) {
    panel.style.display = "none";
    panel.innerHTML = "";
    updateAiWorkspaceStatusChip();
    return;
  }

  if (FEATURE_ENHANCED_TASK_CRITIC) {
    renderEnhancedCritiquePanel(panel);
    updateAiWorkspaceStatusChip();
    return;
  }

  renderLegacyCritiquePanel(panel);
  updateAiWorkspaceStatusChip();
}

function renderLegacyCritiquePanel(panel) {
  panel.style.display = "block";
  panel.innerHTML = `
    <div style="
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px;
      background: var(--input-bg);
    ">
      <div style="font-weight: 600; margin-bottom: 6px;">
        Task Critique Score: ${latestCritiqueResult.qualityScore}/100
      </div>
      <div><strong>Suggested title:</strong> ${escapeHtml(latestCritiqueResult.improvedTitle)}</div>
      ${
        latestCritiqueResult.improvedDescription
          ? `<div style="margin-top: 4px;"><strong>Suggested description:</strong> ${escapeHtml(latestCritiqueResult.improvedDescription)}</div>`
          : ""
      }
      <ul style="margin: 8px 0 10px 18px;">
        ${latestCritiqueResult.suggestions
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}
      </ul>
      <input
        id="critiqueFeedbackReasonInput"
        type="text"
        maxlength="300"
        placeholder="Feedback reason (optional): e.g., too generic, very actionable"
        style="
          width: 100%;
          margin-bottom: 8px;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--card-bg);
          color: var(--text-primary);
        "
      />
      <div style="display: flex; gap: 8px;">
        <button class="add-btn" data-onclick="applyCritiqueSuggestion()">Apply Suggestion</button>
        <button class="add-btn" style="background: #64748b" data-onclick="dismissCritiqueSuggestion()">Dismiss</button>
      </div>
    </div>
  `;
}

function getCritiqueSuggestions() {
  if (!Array.isArray(latestCritiqueResult?.suggestions)) return [];
  return latestCritiqueResult.suggestions
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
}

function renderEnhancedCritiquePanel(panel) {
  const scoreValue = Number(latestCritiqueResult?.qualityScore);
  const hasScore = Number.isFinite(scoreValue);
  const improvedTitle = String(
    latestCritiqueResult?.improvedTitle || "",
  ).trim();
  const improvedDescription = String(
    latestCritiqueResult?.improvedDescription || "",
  ).trim();
  const suggestions = getCritiqueSuggestions();

  panel.style.display = "block";
  panel.innerHTML = `
    <div class="critic-panel-enhanced">
      <div class="critic-panel-header">
        <div class="critic-panel-title">Task Critic</div>
        <div class="critic-panel-score">
          ${
            hasScore
              ? `Quality score: <strong>${Math.round(scoreValue)}/100</strong>`
              : "No score available yet"
          }
        </div>
      </div>

      <section class="critic-section">
        <div class="critic-section-title">Suggested improvements</div>
        ${
          improvedTitle
            ? `<div class="critic-improvement-line"><strong>Title:</strong> ${escapeHtml(improvedTitle)}</div>`
            : `<div class="critic-improvement-line">No title suggestion available.</div>`
        }
        ${
          improvedDescription
            ? `<div class="critic-improvement-line"><strong>Description:</strong> ${escapeHtml(improvedDescription)}</div>`
            : `<div class="critic-improvement-line">No description suggestion available.</div>`
        }
        ${
          suggestions.length
            ? `<ul class="critic-suggestion-list">
                ${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>`
            : `<div class="critic-improvement-line">No additional suggestions yet.</div>`
        }
      </section>

      <section class="critic-section">
        <label for="critiqueFeedbackReasonInput" class="critic-section-title">Feedback reason (optional)</label>
        <input
          id="critiqueFeedbackReasonInput"
          type="text"
          maxlength="300"
          placeholder="e.g., too generic, very actionable"
          class="critic-feedback-input"
        />
        <div class="critic-feedback-chips" role="group" aria-label="Quick feedback reasons">
          <button type="button" class="critic-feedback-chip" data-onclick="setCritiqueFeedbackReason('Too generic')">Too generic</button>
          <button type="button" class="critic-feedback-chip" data-onclick="setCritiqueFeedbackReason('Missing context')">Missing context</button>
          <button type="button" class="critic-feedback-chip" data-onclick="setCritiqueFeedbackReason('Very actionable')">Very actionable</button>
        </div>
      </section>

      <div class="critic-actions">
        <button class="add-btn" data-onclick="applyCritiqueSuggestionMode('title')">Apply title only</button>
        <button class="add-btn" data-onclick="applyCritiqueSuggestionMode('description')">Apply description only</button>
        <button class="add-btn" data-onclick="applyCritiqueSuggestionMode('both')">Apply both</button>
        <button class="add-btn" style="background: #64748b" data-onclick="dismissCritiqueSuggestion()">Dismiss</button>
      </div>

      <details class="critic-future-insights">
        <summary>Future insights</summary>
        <p>Coming soon: deeper critique rationale, impact estimates, and trend signals.</p>
      </details>
    </div>
  `;
}

function updateCritiqueDraftButtonState() {
  const critiqueButton = document.getElementById("critiqueDraftButton");
  if (!(critiqueButton instanceof HTMLButtonElement)) {
    return;
  }
  const isBusy = critiqueRequestsInFlight > 0;
  critiqueButton.disabled = isBusy;
  critiqueButton.textContent = isBusy ? "Critiquing..." : "Critique Draft (AI)";
}

function setCritiqueFeedbackReason(reason) {
  const input = document.getElementById("critiqueFeedbackReasonInput");
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  input.value = String(reason || "").trim();
  input.focus({ preventScroll: true });
}

function renderPlanPanel() {
  const panel = document.getElementById("aiPlanPanel");
  if (!panel) return;

  if (!latestPlanResult || !planDraftState) {
    panel.style.display = "none";
    panel.innerHTML = "";
    updateAiWorkspaceStatusChip();
    return;
  }

  if (!planDraftState.workingTasks.length) {
    if (!planDraftState.statusSyncFailed) {
      panel.style.display = "none";
      panel.innerHTML = "";
      updateAiWorkspaceStatusChip();
      return;
    }
    const controlsDisabled = isPlanActionBusy() ? "disabled" : "";
    panel.style.display = "block";
    panel.innerHTML = `
      <div class="plan-draft-panel">
        <div class="plan-draft-title">Plan tasks created</div>
        <div class="plan-draft-warning">
          Tasks were created, but marking this AI suggestion as accepted failed.
        </div>
        <div class="plan-draft-actions-bottom">
          <button class="add-btn" ${controlsDisabled} data-onclick="retryMarkPlanSuggestionAccepted()">${
            isPlanApplyInFlight ? "Retrying..." : "Retry mark accepted"
          }</button>
          <button class="add-btn" ${controlsDisabled} style="background: #64748b" data-onclick="dismissPlanSuggestion()">${
            isPlanDismissInFlight ? "Dismissing..." : "Dismiss"
          }</button>
        </div>
      </div>
    `;
    updateAiWorkspaceStatusChip();
    return;
  }

  const projects = getAllProjects();
  const hasProjects = projects.length > 0;
  const selectedCount = getSelectedPlanDraftTasks().length;
  const totalCount = planDraftState.workingTasks.length;
  const controlsDisabled = isPlanActionBusy() ? "disabled" : "";

  panel.style.display = "block";
  panel.innerHTML = `
    <div class="plan-draft-panel">
      <div class="plan-draft-header-row">
        <div class="plan-draft-title">${escapeHtml(planDraftState.summary)}</div>
        <span class="plan-draft-count">${selectedCount}/${totalCount} selected</span>
      </div>
      <div class="plan-draft-actions-top">
        <button class="mini-btn" ${controlsDisabled} data-onclick="selectAllPlanDraftTasks()">Select all</button>
        <button class="mini-btn" ${controlsDisabled} data-onclick="selectNoPlanDraftTasks()">Select none</button>
        <button class="mini-btn" ${controlsDisabled} data-onclick="resetPlanDraft()">Reset to AI draft</button>
      </div>
      <div class="plan-draft-task-list">
        ${planDraftState.workingTasks
          .map((task, index) => {
            const isSelected = planDraftState.selectedTaskTempIds.has(
              task.tempId,
            );
            const selectedAttr = isSelected ? "checked" : "";
            const firstInputId = `planDraftTitleInput-${index}`;
            const projectOptions = hasProjects
              ? `<select
                    id="planDraftProjectInput-${index}"
                    class="plan-draft-project-select"
                    aria-label="Project for ${escapeHtml(task.title || `task ${index + 1}`)}"
                    data-onchange="updatePlanDraftTaskProject(${index}, event)"
                  >
                    <option value="">No project</option>
                    ${projects
                      .map((project) =>
                        renderProjectOptionEntry(
                          project,
                          String(task.projectName || ""),
                        ),
                      )
                      .join("")}
                  </select>`
              : `<input
                    id="planDraftProjectInput-${index}"
                    type="text"
                    class="plan-draft-project-input"
                    maxlength="50"
                    placeholder="Project (optional)"
                    aria-label="Project for ${escapeHtml(task.title || `task ${index + 1}`)}"
                    value="${escapeHtml(String(task.projectName || ""))}"
                    data-onchange="updatePlanDraftTaskProject(${index}, event)"
                  />`;

            const subtasksMarkup =
              Array.isArray(task.subtasks) && task.subtasks.length > 0
                ? `
                  <details class="plan-draft-subtasks">
                    <summary>Subtasks (${task.subtasks.length})</summary>
                    <ul>
                      ${task.subtasks
                        .map(
                          (subtask) => `<li>${escapeHtml(subtask.title)}</li>`,
                        )
                        .join("")}
                    </ul>
                  </details>
                `
                : "";

            return `
              <div class="plan-draft-task-row ${isSelected ? "" : "dimmed"}">
                <div class="plan-draft-task-head">
                  <input
                    type="checkbox"
                    class="bulk-checkbox"
                    aria-label="Include task ${index + 1}"
                    ${selectedAttr}
                    ${controlsDisabled}
                    data-onchange="setPlanDraftTaskSelected(${index}, event)"
                  />
                  <label for="${firstInputId}" class="sr-only">Task title ${index + 1}</label>
                  <input
                    id="${firstInputId}"
                    type="text"
                    class="plan-draft-title-input"
                    maxlength="200"
                    value="${escapeHtml(task.title)}"
                    ${controlsDisabled}
                    data-onchange="updatePlanDraftTaskTitle(${index}, event)"
                  />
                </div>
                <label for="planDraftDescriptionInput-${index}" class="sr-only">Task description ${index + 1}</label>
                <textarea
                  id="planDraftDescriptionInput-${index}"
                  class="plan-draft-description-input"
                  rows="2"
                  maxlength="1000"
                  placeholder="Description (optional)"
                  ${controlsDisabled}
                  data-onchange="updatePlanDraftTaskDescription(${index}, event)"
                >${escapeHtml(String(task.description || ""))}</textarea>
                <div class="plan-draft-meta-row">
                  <label for="planDraftDueDateInput-${index}" class="sr-only">Due date ${index + 1}</label>
                  <input
                    id="planDraftDueDateInput-${index}"
                    type="date"
                    class="plan-draft-date-input"
                    value="${escapeHtml(String(task.dueDate || ""))}"
                    ${controlsDisabled}
                    data-onchange="updatePlanDraftTaskDueDate(${index}, event)"
                  />
                  ${projectOptions}
                  <label for="planDraftPriorityInput-${index}" class="sr-only">Priority ${index + 1}</label>
                  <select
                    id="planDraftPriorityInput-${index}"
                    class="plan-draft-priority-select"
                    ${controlsDisabled}
                    aria-label="Priority for ${escapeHtml(task.title || `task ${index + 1}`)}"
                    data-onchange="updatePlanDraftTaskPriority(${index}, event)"
                  >
                    <option value="low" ${task.priority === "low" ? "selected" : ""}>Low</option>
                    <option value="medium" ${task.priority === "medium" ? "selected" : ""}>Medium</option>
                    <option value="high" ${task.priority === "high" ? "selected" : ""}>High</option>
                  </select>
                </div>
                ${subtasksMarkup}
              </div>
            `;
          })
          .join("")}
      </div>
      <input
        id="planFeedbackReasonInput"
        type="text"
        maxlength="300"
        placeholder="Feedback reason (optional): why you accepted/rejected this plan"
        ${controlsDisabled}
        class="plan-feedback-input"
      />
      <div class="plan-draft-actions-bottom">
        <button class="add-btn" ${controlsDisabled} data-onclick="addPlanTasksToTodos()">${
          isPlanApplyInFlight ? "Applying..." : "Apply selected tasks"
        }</button>
        <button class="add-btn" ${controlsDisabled} style="background: #64748b" data-onclick="dismissPlanSuggestion()">${
          isPlanDismissInFlight ? "Dismissing..." : "Dismiss"
        }</button>
      </div>
    </div>
  `;

  if (panel.dataset.focusPending === "true") {
    panel.dataset.focusPending = "false";
    const firstTitleInput = document.getElementById("planDraftTitleInput-0");
    firstTitleInput?.focus();
  }
}

function setPlanDraftTaskSelected(index, event) {
  if (!planDraftState || isPlanActionBusy()) return;
  const task = planDraftState.workingTasks[index];
  if (!task) return;
  const checked = !!event?.target?.checked;
  if (checked) {
    planDraftState.selectedTaskTempIds.add(task.tempId);
  } else {
    planDraftState.selectedTaskTempIds.delete(task.tempId);
  }
  renderPlanPanel();
}

function updatePlanDraftTaskTitle(index, event) {
  if (!planDraftState) return;
  const task = planDraftState.workingTasks[index];
  if (!task) return;
  task.title = String(event?.target?.value || "").slice(0, 200);
}

function updatePlanDraftTaskDescription(index, event) {
  if (!planDraftState) return;
  const task = planDraftState.workingTasks[index];
  if (!task) return;
  task.description = String(event?.target?.value || "").slice(0, 1000);
}

function updatePlanDraftTaskDueDate(index, event) {
  if (!planDraftState) return;
  const task = planDraftState.workingTasks[index];
  if (!task) return;
  const nextValue = String(event?.target?.value || "").trim();
  task.dueDate = /^\d{4}-\d{2}-\d{2}$/.test(nextValue) ? nextValue : "";
}

function updatePlanDraftTaskProject(index, event) {
  if (!planDraftState) return;
  const task = planDraftState.workingTasks[index];
  if (!task) return;
  task.projectName = String(event?.target?.value || "")
    .slice(0, 50)
    .trim();
}

function updatePlanDraftTaskPriority(index, event) {
  if (!planDraftState) return;
  const task = planDraftState.workingTasks[index];
  if (!task) return;
  task.priority = normalizePlanDraftPriority(
    String(event?.target?.value || ""),
  );
}

function selectAllPlanDraftTasks() {
  if (!planDraftState || isPlanActionBusy()) return;
  planDraftState.selectedTaskTempIds = new Set(
    planDraftState.workingTasks.map((task) => task.tempId),
  );
  renderPlanPanel();
}

function selectNoPlanDraftTasks() {
  if (!planDraftState || isPlanActionBusy()) return;
  planDraftState.selectedTaskTempIds.clear();
  renderPlanPanel();
}

function resetPlanDraft() {
  if (!planDraftState || isPlanActionBusy()) return;
  planDraftState.workingTasks = planDraftState.originalTasks.map(
    (task, index) => clonePlanDraftTask(task, index),
  );
  planDraftState.selectedTaskTempIds = new Set(
    planDraftState.workingTasks.map((task) => task.tempId),
  );
  planDraftState.statusSyncFailed = false;
  renderPlanPanel();
}

async function retryMarkPlanSuggestionAccepted() {
  if (
    !latestPlanSuggestionId ||
    !planDraftState ||
    !planDraftState.statusSyncFailed ||
    isPlanActionBusy()
  ) {
    return;
  }

  isPlanApplyInFlight = true;
  updatePlanGenerateButtonState();
  renderPlanPanel();
  try {
    const accepted = await updateSuggestionStatus(
      latestPlanSuggestionId,
      "accepted",
      getFeedbackReason("planFeedbackReasonInput", "Plan tasks were added"),
    );
    if (!accepted) {
      showMessage(
        "todosMessage",
        "Could not mark AI suggestion accepted yet. Retry in a moment.",
        "warning",
      );
      return;
    }
    latestPlanSuggestionId = null;
    latestPlanResult = null;
    clearPlanDraftState();
    renderPlanPanel();
    showMessage("todosMessage", "AI suggestion marked accepted", "success");
  } finally {
    isPlanApplyInFlight = false;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

async function critiqueDraftWithAi() {
  const input = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  const notesInput = document.getElementById("todoNotesInput");

  const title = input.value.trim();
  if (!title) {
    showMessage(
      "todosMessage",
      "Add a title before running AI critique",
      "error",
    );
    return;
  }

  const requestId = ++latestCritiqueRequestId;
  critiqueRequestsInFlight += 1;
  updateCritiqueDraftButtonState();

  try {
    const response = await apiCall(`${API_URL}/ai/task-critic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description:
          notesInput.value.trim() || projectSelect.value.trim() || undefined,
        dueDate: dueDateInput.value
          ? new Date(dueDateInput.value).toISOString()
          : undefined,
        priority: currentPriority,
      }),
    });

    const data = response ? await parseApiBody(response) : {};
    if (requestId !== latestCritiqueRequestId) {
      return;
    }
    if (response && response.ok) {
      latestCritiqueSuggestionId = data.suggestionId;
      latestCritiqueResult = data;
      renderCritiquePanel();
      showMessage(
        "todosMessage",
        `AI critique ready (${data.qualityScore}/100). Review and apply if useful.`,
        "success",
      );
      await loadAiSuggestions();
      await loadAiUsage();
      await loadAiInsights();
      return;
    }

    showMessage("todosMessage", data.error || "AI critique failed", "error");
    if (response && response.status === 429 && data.usage) {
      aiUsage = data.usage;
      renderAiUsageSummary();
      showMessage(
        "todosMessage",
        `Daily AI limit reached on ${String(
          data.usage.plan || "free",
        ).toUpperCase()} plan. Upgrade for higher limits.`,
        "error",
      );
    }
  } catch (error) {
    if (requestId !== latestCritiqueRequestId) {
      return;
    }
    console.error("Critique draft error:", error);
    showMessage("todosMessage", "Failed to run AI critique", "error");
  } finally {
    critiqueRequestsInFlight = Math.max(0, critiqueRequestsInFlight - 1);
    updateCritiqueDraftButtonState();
  }
}

async function applyCritiqueSuggestion() {
  await applyCritiqueSuggestionMode("both", { overwriteDescription: false });
}

async function applyCritiqueSuggestionMode(
  mode = "both",
  { overwriteDescription = true } = {},
) {
  if (!latestCritiqueResult) return;

  const input = document.getElementById("todoInput");
  const notesInput = document.getElementById("todoNotesInput");
  const notesIcon = document.getElementById("notesExpandIcon");

  const applyTitle = mode === "title" || mode === "both";
  const applyDescription = mode === "description" || mode === "both";

  if (applyTitle && latestCritiqueResult.improvedTitle) {
    input.value = latestCritiqueResult.improvedTitle;
  }

  if (
    applyDescription &&
    latestCritiqueResult.improvedDescription &&
    (overwriteDescription || !notesInput.value.trim())
  ) {
    notesInput.value = latestCritiqueResult.improvedDescription;
    notesInput.style.display = "block";
    notesIcon.classList.add("expanded");
  }

  await updateSuggestionStatus(
    latestCritiqueSuggestionId,
    "accepted",
    getFeedbackReason("critiqueFeedbackReasonInput", "Applied to draft"),
  );
  latestCritiqueSuggestionId = null;
  latestCritiqueResult = null;
  renderCritiquePanel();
  showMessage("todosMessage", "AI suggestion applied to draft", "success");
}

async function dismissCritiqueSuggestion() {
  await updateSuggestionStatus(
    latestCritiqueSuggestionId,
    "rejected",
    getFeedbackReason(
      "critiqueFeedbackReasonInput",
      "Not useful for current context",
    ),
  );
  latestCritiqueSuggestionId = null;
  latestCritiqueResult = null;
  renderCritiquePanel();
}

async function generatePlanWithAi() {
  if (isPlanActionBusy()) {
    return;
  }
  const goalInput = document.getElementById("goalInput");
  const targetDateInput = document.getElementById("goalTargetDateInput");

  const goal = goalInput.value.trim();
  if (!goal) {
    showMessage("todosMessage", "Enter a goal to generate a plan", "error");
    return;
  }

  isPlanGenerateInFlight = true;
  planGenerateSource = "goal";
  updatePlanGenerateButtonState();
  try {
    const response = await apiCall(`${API_URL}/ai/plan-from-goal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal,
        targetDate: targetDateInput.value
          ? new Date(targetDateInput.value).toISOString()
          : undefined,
        maxTasks: 5,
      }),
    });

    const data = response ? await parseApiBody(response) : {};
    if (response && response.ok) {
      await handlePlanFromGoalSuccess(
        data,
        "AI plan generated. Review and add tasks.",
      );
      return;
    }

    showMessage(
      "todosMessage",
      data.error || "AI plan generation failed",
      "error",
    );
    if (response && response.status === 429 && data.usage) {
      aiUsage = data.usage;
      renderAiUsageSummary();
      showMessage(
        "todosMessage",
        `Daily AI limit reached on ${String(
          data.usage.plan || "free",
        ).toUpperCase()} plan. Upgrade for higher limits.`,
        "error",
      );
    }
  } catch (error) {
    console.error("Generate plan error:", error);
    showMessage("todosMessage", "Failed to generate AI plan", "error");
  } finally {
    isPlanGenerateInFlight = false;
    planGenerateSource = null;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

function clearBrainDumpInput() {
  const brainDumpInput = document.getElementById("brainDumpInput");
  if (!brainDumpInput || isPlanActionBusy()) {
    return;
  }
  brainDumpInput.value = "";
  brainDumpInput.focus();
}

async function handlePlanFromGoalSuccess(data, successMessage) {
  latestPlanSuggestionId = data.suggestionId;
  latestPlanResult = data;
  initPlanDraftState(data);
  const planPanel = document.getElementById("aiPlanPanel");
  if (planPanel) {
    planPanel.dataset.focusPending = "true";
  }
  renderPlanPanel();
  showMessage("todosMessage", successMessage, "success");
  await loadAiSuggestions();
  await loadAiUsage();
  await loadAiInsights();
}

async function draftPlanFromBrainDumpWithAi() {
  if (isPlanActionBusy()) {
    return;
  }

  const brainDumpInput = document.getElementById("brainDumpInput");
  if (!brainDumpInput) {
    return;
  }

  const goal = brainDumpInput.value.trim();
  if (!goal) {
    showMessage("todosMessage", "Enter a brain dump to draft tasks", "error");
    return;
  }
  if (goal.length > 8000) {
    showMessage(
      "todosMessage",
      "Brain dump must be 8000 characters or less",
      "error",
    );
    return;
  }

  isPlanGenerateInFlight = true;
  planGenerateSource = "brain_dump";
  updatePlanGenerateButtonState();
  try {
    const response = await apiCall(`${API_URL}/ai/plan-from-goal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });

    const data = response ? await parseApiBody(response) : {};
    if (response && response.ok) {
      await handlePlanFromGoalSuccess(
        data,
        "AI draft ready from brain dump. Review and add tasks.",
      );
      return;
    }

    showMessage(
      "todosMessage",
      data.error || "AI draft generation failed",
      "error",
    );
    if (response && response.status === 429 && data.usage) {
      aiUsage = data.usage;
      renderAiUsageSummary();
      showMessage(
        "todosMessage",
        `Daily AI limit reached on ${String(
          data.usage.plan || "free",
        ).toUpperCase()} plan. Upgrade for higher limits.`,
        "error",
      );
    }
  } catch (error) {
    console.error("Brain dump plan error:", error);
    showMessage(
      "todosMessage",
      "Failed to draft tasks from brain dump",
      "error",
    );
  } finally {
    isPlanGenerateInFlight = false;
    planGenerateSource = null;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

async function addPlanTasksToTodos() {
  if (!latestPlanSuggestionId || !planDraftState || isPlanActionBusy()) {
    return;
  }

  const selectedTasks = getSelectedPlanDraftTasks();
  if (selectedTasks.length === 0) {
    showMessage(
      "todosMessage",
      "Select at least one plan task to apply",
      "error",
    );
    return;
  }

  const invalidTask = selectedTasks.find(
    (task) => String(task.title || "").trim().length === 0,
  );
  if (invalidTask) {
    showMessage(
      "todosMessage",
      "Each selected task must include a title before applying",
      "error",
    );
    return;
  }

  isPlanApplyInFlight = true;
  updatePlanGenerateButtonState();
  renderPlanPanel();
  try {
    let created = 0;
    const createdTempIds = new Set();
    for (const task of selectedTasks) {
      const payload = buildPlanTaskCreatePayload(task);
      const response = await apiCall(`${API_URL}/todos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response && response.ok) {
        created += 1;
        createdTempIds.add(task.tempId);
      } else {
        const data = response ? await parseApiBody(response) : {};
        if (created > 0) {
          removeAppliedPlanDraftTasks(createdTempIds);
          await loadTodos();
          showMessage(
            "todosMessage",
            `Created ${created} of ${selectedTasks.length} tasks. Suggestion not marked accepted; fix remaining items and retry.`,
            "warning",
          );
          renderPlanPanel();
          return;
        }
        showMessage(
          "todosMessage",
          data.error || "Failed to apply one or more planned tasks",
          "error",
        );
        return;
      }
    }

    removeAppliedPlanDraftTasks(createdTempIds);

    const accepted = await updateSuggestionStatus(
      latestPlanSuggestionId,
      "accepted",
      getFeedbackReason("planFeedbackReasonInput", "Plan tasks were added"),
    );

    await loadTodos();
    if (!accepted) {
      if (planDraftState) {
        planDraftState.statusSyncFailed = true;
      }
      renderPlanPanel();
      showMessage(
        "todosMessage",
        `Added ${created} AI-planned task(s), but could not mark suggestion accepted. Retry.`,
        "warning",
      );
      return;
    }

    latestPlanSuggestionId = null;
    latestPlanResult = null;
    clearPlanDraftState();
    renderPlanPanel();
    showMessage(
      "todosMessage",
      `Added ${created} AI-planned task(s)`,
      "success",
    );
  } catch (error) {
    console.error("Apply planned tasks error:", error);
    showMessage("todosMessage", "Failed to apply AI suggestion", "error");
  } finally {
    isPlanApplyInFlight = false;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

async function dismissPlanSuggestion() {
  if (!latestPlanSuggestionId || isPlanActionBusy()) {
    return;
  }
  isPlanDismissInFlight = true;
  updatePlanGenerateButtonState();
  renderPlanPanel();
  try {
    await updateSuggestionStatus(
      latestPlanSuggestionId,
      "rejected",
      getFeedbackReason(
        "planFeedbackReasonInput",
        "Plan did not match intended approach",
      ),
    );
    latestPlanSuggestionId = null;
    latestPlanResult = null;
    clearPlanDraftState();
    showMessage("todosMessage", "AI plan dismissed", "success");
  } finally {
    isPlanDismissInFlight = false;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

// Add todo
async function addTodo() {
  const input = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  const notesInput = document.getElementById("todoNotesInput");

  const title = input.value.trim();
  if (!title) return;

  const payload = {
    title,
    priority: currentPriority,
  };

  const projectPath = normalizeProjectPath(projectSelect.value);
  if (projectPath) {
    payload.category = projectPath;
  }
  if (dueDateInput.value) {
    payload.dueDate = new Date(dueDateInput.value).toISOString();
  }
  if (notesInput.value.trim()) {
    payload.notes = notesInput.value.trim();
  }

  try {
    const response = await apiCall(`${API_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response && response.ok) {
      const newTodo = await response.json();
      todos.unshift(newTodo);
      renderTodos();
      updateCategoryFilter();
      clearOnCreateDismissed(newTodo.id);

      // Clear form
      input.value = "";
      projectSelect.value = "";
      dueDateInput.value = "";
      notesInput.value = "";
      setQuickEntryPropertiesOpen(false);
      syncQuickEntryProjectActions();

      // Reset priority to medium
      setPriority("medium");

      // Hide notes input
      notesInput.style.display = "none";
      document.getElementById("notesExpandIcon").classList.remove("expanded");
      onCreateAssistState = {
        ...createInitialOnCreateAssistState(),
        dismissedTodoIds: onCreateAssistState.dismissedTodoIds,
      };
      onCreateAssistState.mode = "live";
      onCreateAssistState.liveTodoId = newTodo.id;
      onCreateAssistState.showFullAssist = true;
      onCreateAssistState.loading = true;
      renderOnCreateAssistRow();
      await loadOnCreateDecisionAssist(newTodo);

      refreshProjectCatalog();
    }
  } catch (error) {
    console.error("Add todo error:", error);
  }
}

// Toggle todo
async function toggleTodo(id, forceValue = null) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  const newCompletedValue = forceValue !== null ? forceValue : !todo.completed;

  try {
    const response = await apiCall(`${API_URL}/todos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: newCompletedValue }),
    });

    if (response && response.ok) {
      const updatedTodo = await response.json();
      todos = todos.map((t) => (t.id === id ? updatedTodo : t));
      renderTodos();

      // Add undo action only if user initiated (not programmatic)
      if (forceValue === null && newCompletedValue) {
        addUndoAction("complete", { id }, "Todo marked as complete");
      }
    }
  } catch (error) {
    console.error("Toggle todo error:", error);
  }
}

// Delete todo
async function deleteTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return false;

  if (!confirm("Delete this todo?")) return false;

  // Store todo data for undo
  const todoData = { ...todo };

  try {
    const response = await apiCall(`${API_URL}/todos/${id}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      todos = todos.filter((t) => t.id !== id);
      selectedTodos.delete(id);
      renderTodos();
      updateCategoryFilter();

      // Add undo action
      addUndoAction("delete", todoData, "Todo deleted");
      await loadTodos();
      return true;
    }

    const errorData = response ? await response.json().catch(() => ({})) : {};
    showMessage(
      "todosMessage",
      errorData.error || "Failed to delete todo",
      "error",
    );
    return false;
  } catch (error) {
    showMessage("todosMessage", "Network error while deleting todo", "error");
    console.error("Delete todo error:", error);
    return false;
  }
}

// Update category filter dropdown
function updateCategoryFilter() {
  const categories = getAllProjects();
  const filterSelect = document.getElementById("categoryFilter");
  if (!(filterSelect instanceof HTMLSelectElement)) {
    renderProjectsRail();
    return;
  }
  const currentValue = isInternalCategoryPath(filterSelect.value)
    ? ""
    : filterSelect.value;

  filterSelect.innerHTML =
    '<option value="">All Projects</option>' +
    categories
      .map((cat) => renderProjectOptionEntry(cat, currentValue))
      .join("");

  if (categories.includes(currentValue)) {
    filterSelect.value = currentValue;
  }

  renderProjectsRail();
}

// splitProjectPath … renderProjectOptionEntry — from projectPathUtils.js

function getAllProjects() {
  const projectNames = [
    ...customProjects,
    ...todos.map((todo) => todo.category),
  ]
    .map((value) => normalizeProjectPath(value))
    .filter((value) => value.length > 0 && !isInternalCategoryPath(value));
  return expandProjectTree(projectNames);
}

function refreshProjectCatalog() {
  customProjects = expandProjectTree([...customProjects, ...getAllProjects()]);
  saveCustomProjects();
  updateProjectSelectOptions();
  updateCategoryFilter();
}

function updateProjectSelectOptions() {
  const projects = getAllProjects();
  const todoProjectSelect = document.getElementById("todoProjectSelect");
  const editProjectSelect = document.getElementById("editTodoProjectSelect");

  const renderOptions = (selectedValue = "") =>
    `<option value="">No project</option>${projects
      .map((project) => renderProjectOptionEntry(project, selectedValue))
      .join("")}`;

  if (todoProjectSelect) {
    const selected = todoProjectSelect.value || "";
    todoProjectSelect.innerHTML = renderOptions(selected);
    todoProjectSelect.value = selected;
    syncQuickEntryProjectActions();
  }
  if (editProjectSelect) {
    const selected = editProjectSelect.value || "";
    editProjectSelect.innerHTML = renderOptions(selected);
    editProjectSelect.value = selected;
  }
}

function validateProjectNameInput(
  input,
  { emptyMessage = "Project name is required" } = {},
) {
  const normalized = normalizeProjectPath(input);
  if (!normalized) {
    return { valid: false, message: emptyMessage, normalized: "" };
  }
  if (normalized.length > 50) {
    return {
      valid: false,
      message: "Project name cannot exceed 50 characters",
      normalized,
    };
  }
  return { valid: true, message: "", normalized };
}

function getProjectCrudModalElements() {
  const modal = document.getElementById("projectCrudModal");
  const form = document.getElementById("projectCrudForm");
  const title = document.getElementById("projectCrudModalTitle");
  const input = document.getElementById("projectCrudNameInput");
  const submit = document.getElementById("projectCrudSubmitButton");
  const cancel = document.getElementById("projectCrudCancelButton");
  if (!(modal instanceof HTMLElement)) return null;
  if (!(form instanceof HTMLFormElement)) return null;
  if (!(title instanceof HTMLElement)) return null;
  if (!(input instanceof HTMLInputElement)) return null;
  if (!(submit instanceof HTMLButtonElement)) return null;
  if (!(cancel instanceof HTMLButtonElement)) return null;
  return { modal, form, title, input, submit, cancel };
}

function openProjectCrudModal(mode, opener, initialProjectName = "") {
  const refs = getProjectCrudModalElements();
  if (!refs) return;

  isProjectCrudModalOpen = true;
  projectCrudMode = mode;
  projectCrudTargetProject = initialProjectName || "";
  lastProjectCrudOpener = opener instanceof HTMLElement ? opener : null;

  refs.modal.style.display = "flex";
  refs.title.textContent = mode === "rename" ? "Rename project" : "New project";
  refs.submit.textContent = mode === "rename" ? "Save" : "Create";
  refs.input.value = initialProjectName || "";

  window.requestAnimationFrame(() => {
    refs.input.focus();
    refs.input.select();
  });
}

function closeProjectCrudModal({ restoreFocus = true } = {}) {
  const refs = getProjectCrudModalElements();
  if (!refs) return;

  isProjectCrudModalOpen = false;
  projectCrudMode = "create";
  projectCrudTargetProject = "";
  refs.modal.style.display = "none";
  refs.form.reset();

  if (restoreFocus) {
    if (lastProjectCrudOpener?.isConnected) {
      lastProjectCrudOpener.focus({ preventScroll: true });
    } else {
      const fallback = document.getElementById("projectsRailCreateButton");
      if (fallback instanceof HTMLElement) {
        fallback.focus({ preventScroll: true });
      }
    }
  }
  lastProjectCrudOpener = null;
}

async function submitProjectCrudModal() {
  const refs = getProjectCrudModalElements();
  if (!refs) return;

  const validation = validateProjectNameInput(refs.input.value, {
    emptyMessage: "Project name cannot be empty",
  });
  if (!validation.valid) {
    showMessage("todosMessage", validation.message, "error");
    return;
  }

  const nextName = validation.normalized;
  refs.submit.disabled = true;
  refs.cancel.disabled = true;

  try {
    let didSucceed = false;
    if (projectCrudMode === "rename") {
      didSucceed = await renameProjectByName(
        projectCrudTargetProject,
        nextName,
      );
    } else {
      didSucceed = await createProjectByName(nextName);
    }
    if (didSucceed) {
      closeProjectCrudModal({ restoreFocus: false });
    }
  } finally {
    refs.submit.disabled = false;
    refs.cancel.disabled = false;
  }
}

async function createProjectByName(projectName) {
  if (getAllProjects().includes(projectName)) {
    showMessage("todosMessage", "Project name already exists", "error");
    return false;
  }

  const created = await ensureProjectExists(projectName);
  if (!created) {
    return false;
  }

  if (!customProjects.includes(projectName)) {
    customProjects.push(projectName);
    customProjects = expandProjectTree(customProjects);
    saveCustomProjects();
  }

  await loadProjects();
  selectProjectFromRail(projectName);
  showMessage("todosMessage", `Project "${projectName}" created`, "success");
  return true;
}

async function renameProjectByName(fromProjectName, toProjectName) {
  const selectedPath = normalizeProjectPath(fromProjectName);
  const renamedPath = normalizeProjectPath(toProjectName);
  if (!selectedPath || !renamedPath) {
    showMessage("todosMessage", "Project name cannot be empty", "error");
    return false;
  }
  if (renamedPath === selectedPath) {
    return true;
  }

  const targetRecord = getProjectRecordByName(selectedPath);
  if (!targetRecord) {
    showMessage("todosMessage", "Project not found", "error");
    return false;
  }

  try {
    const response = await apiCall(`${API_URL}/projects/${targetRecord.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renamedPath }),
    });
    if (!response || !response.ok) {
      const data = response ? await parseApiBody(response) : {};
      showMessage(
        "todosMessage",
        data.error || "Failed to rename project",
        "error",
      );
      return false;
    }
  } catch (error) {
    console.error("Rename project failed:", error);
    showMessage("todosMessage", "Failed to rename project", "error");
    return false;
  }

  const activeProject = getSelectedProjectKey();

  await loadProjects();
  await loadTodos();

  const selectedPrefix = `${selectedPath}${PROJECT_PATH_SEPARATOR}`;
  customProjects = expandProjectTree(
    customProjects
      .map((path) => normalizeProjectPath(path))
      .map((path) => {
        if (path === selectedPath) return renamedPath;
        if (path.startsWith(selectedPrefix)) {
          return `${renamedPath}${path.slice(selectedPath.length)}`;
        }
        return path;
      }),
  );
  saveCustomProjects();
  updateProjectSelectOptions();
  updateCategoryFilter();

  if (activeProject === selectedPath) {
    selectProjectFromRail(renamedPath);
  }

  showMessage(
    "todosMessage",
    `Renamed project "${selectedPath}" to "${renamedPath}"`,
    "success",
  );
  return true;
}

async function deleteProjectByName(projectName) {
  const normalized = normalizeProjectPath(projectName);
  if (!normalized) return false;
  const projectRecord = getProjectRecordByName(normalized);
  if (!projectRecord) {
    showMessage("todosMessage", "Project not found", "error");
    return false;
  }

  const confirmed = confirm(
    `Delete project "${normalized}"? Tasks will remain but project tag may be cleared.`,
  );
  if (!confirmed) return false;

  try {
    const response = await apiCall(`${API_URL}/projects/${projectRecord.id}`, {
      method: "DELETE",
    });
    if (!response || !response.ok) {
      const data = response ? await parseApiBody(response) : {};
      showMessage(
        "todosMessage",
        data.error || "Failed to delete project",
        "error",
      );
      return false;
    }
  } catch (error) {
    console.error("Delete project failed:", error);
    showMessage("todosMessage", "Failed to delete project", "error");
    return false;
  }

  const activeProject = getSelectedProjectKey();
  const deletedPrefix = `${normalized}${PROJECT_PATH_SEPARATOR}`;
  const shouldFallback =
    activeProject === normalized || activeProject.startsWith(deletedPrefix);

  await loadProjects();
  await loadTodos();

  customProjects = customProjects.filter((path) => {
    const normalizedPath = normalizeProjectPath(path);
    return (
      normalizedPath !== normalized && !normalizedPath.startsWith(deletedPrefix)
    );
  });
  customProjects = expandProjectTree(customProjects);
  saveCustomProjects();
  updateProjectSelectOptions();
  updateCategoryFilter();

  if (shouldFallback) {
    selectProjectFromRail("");
  }

  showMessage("todosMessage", `Deleted project "${normalized}"`, "success");
  return true;
}

function createProject() {
  openProjectCrudModal("create", document.activeElement);
}

async function createSubproject() {
  const projectSelect = document.getElementById("todoProjectSelect");
  const parentPath = normalizeProjectPath(projectSelect?.value || "");
  if (!parentPath) {
    showMessage(
      "todosMessage",
      "Select a parent project first, then create a subproject",
      "error",
    );
    return;
  }

  const name = prompt(`Subproject name under "${parentPath}":`);
  if (name === null) {
    return;
  }
  const childName = normalizeProjectPath(name);
  if (!childName) {
    showMessage("todosMessage", "Subproject name cannot be empty", "error");
    return;
  }
  const combinedPath = normalizeProjectPath(
    `${parentPath}${PROJECT_PATH_SEPARATOR}${childName}`,
  );
  if (!combinedPath || combinedPath.length > 50) {
    showMessage(
      "todosMessage",
      "Subproject path cannot exceed 50 characters",
      "error",
    );
    return;
  }
  const created = await ensureProjectExists(combinedPath);
  if (!created) {
    return;
  }
  if (!customProjects.includes(combinedPath)) {
    customProjects.push(combinedPath);
    customProjects = expandProjectTree(customProjects);
    saveCustomProjects();
    updateProjectSelectOptions();
    updateCategoryFilter();
  }
  if (projectSelect) {
    projectSelect.value = combinedPath;
  }
  await loadProjects();
  showMessage(
    "todosMessage",
    `Subproject "${combinedPath}" created`,
    "success",
  );
}

function renameProjectTree() {
  const projectSelect = document.getElementById("todoProjectSelect");
  const selectedPath = normalizeProjectPath(projectSelect?.value || "");
  if (!selectedPath) {
    showMessage("todosMessage", "Select a project to rename", "error");
    return;
  }
  openProjectCrudModal("rename", document.activeElement, selectedPath);
}

function renderProjectOptions(selectedProject = "") {
  return `<option value="">No project</option>${getAllProjects()
    .map((project) => renderProjectOptionEntry(project, selectedProject))
    .join("")}`;
}

async function moveTodoToProject(todoId, projectValue) {
  const todo = todos.find((item) => item.id === todoId);
  if (!todo) return;
  const category =
    typeof projectValue === "string" ? normalizeProjectPath(projectValue) : "";

  try {
    const response = await apiCall(`${API_URL}/todos/${todoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category || null }),
    });
    if (!response || !response.ok) {
      throw new Error("Update failed");
    }
    const updated = await response.json();
    todos = todos.map((item) => (item.id === todoId ? updated : item));
    if (category && !customProjects.includes(category)) {
      customProjects.push(category);
    }
    refreshProjectCatalog();
    await loadProjects();
    renderTodos();
  } catch (error) {
    console.error("Move todo project failed:", error);
    showMessage("todosMessage", "Failed to move task to project", "error");
  }
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoFromDateInput(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function validateTodoTitle(title) {
  if (!title || !title.trim()) {
    return "Task title is required";
  }
  return null;
}

async function applyTodoPatch(todoId, patch) {
  const response = await apiCall(`${API_URL}/todos/${todoId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response || !response.ok) {
    const data = response ? await parseApiBody(response) : {};
    throw new Error(data.error || "Failed to update task");
  }

  const updatedTodo = await response.json();
  todos = todos.map((todo) => (todo.id === todoId ? updatedTodo : todo));

  const projectPath = normalizeProjectPath(updatedTodo?.category || "");
  if (projectPath && !customProjects.includes(projectPath)) {
    customProjects.push(projectPath);
  }
  refreshProjectCatalog();
  await loadProjects();

  return updatedTodo;
}

function openEditTodoModal(todoId) {
  const todo = todos.find((item) => item.id === todoId);
  if (!todo) return;
  editingTodoId = todoId;

  document.getElementById("editTodoTitle").value = todo.title || "";
  document.getElementById("editTodoDescription").value = todo.description || "";
  updateProjectSelectOptions();
  document.getElementById("editTodoProjectSelect").value = todo.category || "";
  document.getElementById("editTodoPriority").value = todo.priority || "medium";
  document.getElementById("editTodoDueDate").value = toDateTimeLocalValue(
    todo.dueDate,
  );
  document.getElementById("editTodoNotes").value = todo.notes || "";

  document.getElementById("editTodoModal").style.display = "flex";
  document.getElementById("editTodoTitle")?.focus();
}

function closeEditTodoModal() {
  editingTodoId = null;
  document.getElementById("editTodoModal").style.display = "none";
}

async function saveEditedTodo() {
  if (!editingTodoId) return;
  const title = document.getElementById("editTodoTitle").value.trim();
  const titleError = validateTodoTitle(title);
  if (titleError) {
    showMessage("todosMessage", titleError, "error");
    return;
  }

  const project = normalizeProjectPath(
    document.getElementById("editTodoProjectSelect").value,
  );
  const priority = document.getElementById("editTodoPriority").value;
  const dueDateRaw = document.getElementById("editTodoDueDate").value;
  const description = document
    .getElementById("editTodoDescription")
    .value.trim();
  const notes = document.getElementById("editTodoNotes").value.trim();

  const payload = {
    title,
    priority,
    category: project || null,
    dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : null,
    description: description || "",
    notes: notes || null,
  };

  try {
    await applyTodoPatch(editingTodoId, payload);
    renderTodos();
    syncTodoDrawerStateWithRender();
    closeEditTodoModal();
    showMessage("todosMessage", "Task updated", "success");
  } catch (error) {
    console.error("Save edited todo failed:", error);
    showMessage(
      "todosMessage",
      error.message || "Failed to update task",
      "error",
    );
  }
}

function setDateView(view, { skipApply = false } = {}) {
  currentDateView = view;
  const ids = {
    all: "dateViewAll",
    today: "dateViewToday",
    upcoming: "dateViewUpcoming",
    next_month: "dateViewNextMonth",
    someday: "dateViewSomeday",
    completed: "",
  };
  Object.values(ids)
    .filter(Boolean)
    .forEach((id) => {
      document.getElementById(id)?.classList.remove("active");
    });
  if (view !== "completed") {
    const activeId = ids[view] || ids.all;
    document.getElementById(activeId)?.classList.add("active");
  }
  syncWorkspaceViewState();
  if (!skipApply) {
    applyFiltersAndRender({ reason: "date-view" });
  }
}

function matchesWorkspaceView(view) {
  if (view === "all") {
    return getSelectedProjectKey() === "" && currentDateView === "all";
  }
  if (view === "completed") {
    return getSelectedProjectKey() === "" && currentDateView === "completed";
  }
  return getSelectedProjectKey() === "" && currentDateView === view;
}

function syncWorkspaceViewState() {
  document
    .querySelectorAll(".workspace-view-item[data-workspace-view]")
    .forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      const view = item.getAttribute("data-workspace-view") || "all";
      const isActive = matchesWorkspaceView(view);
      item.classList.toggle("projects-rail-item--active", isActive);
      if (isActive) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
}

function selectWorkspaceView(view, triggerEl = null) {
  const normalizedView = String(view || "all").toLowerCase();
  const nextView =
    normalizedView === "today" ||
    normalizedView === "upcoming" ||
    normalizedView === "completed"
      ? normalizedView
      : "all";
  if (triggerEl instanceof HTMLElement) {
    triggerEl.blur();
  }
  setSelectedProjectKey("", { reason: "workspace-view", skipApply: true });
  setDateView(nextView, { skipApply: false });
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function matchesDateView(todo) {
  if (currentDateView === "all") {
    return true;
  }
  if (currentDateView === "completed") {
    return !!todo.completed;
  }

  const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  if (currentDateView === "someday") {
    return !dueDate;
  }
  if (!dueDate) {
    return false;
  }

  if (currentDateView === "today") {
    return isSameLocalDay(dueDate, now);
  }

  if (currentDateView === "upcoming") {
    const upcomingEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    return dueDate > todayEnd && dueDate <= upcomingEnd;
  }

  if (currentDateView === "next_month") {
    const nextMonth = (now.getMonth() + 1) % 12;
    const nextMonthYear =
      now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    return (
      dueDate.getFullYear() === nextMonthYear &&
      dueDate.getMonth() === nextMonth
    );
  }

  return dueDate >= todayStart;
}

function getVisibleTodos() {
  return filterTodosList(todos);
}

function getVisibleDueDatedTodos() {
  return getVisibleTodos().filter((todo) => !!todo.dueDate);
}

// padIcsNumber … buildIcsFilename — from icsExport.js

function updateIcsExportButtonState() {
  const exportButton = document.getElementById("exportIcsButton");
  if (!exportButton) return;
  const hasExportableTodos = getVisibleDueDatedTodos().length > 0;
  exportButton.disabled = !hasExportableTodos;
}

function exportVisibleTodosToIcs() {
  const exportableTodos = getVisibleDueDatedTodos();
  if (!exportableTodos.length) {
    showMessage(
      "todosMessage",
      "No due-dated tasks in the current filtered view to export",
      "warning",
    );
    updateIcsExportButtonState();
    return;
  }

  const content = buildIcsContentForTodos(exportableTodos);
  const blob = new Blob([content], {
    type: "text/calendar;charset=utf-8",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = buildIcsFilename();
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(downloadUrl);

  showMessage(
    "todosMessage",
    `Exported ${exportableTodos.length} events.`,
    "success",
  );
}

// Filter todos by category and search
function filterTodosList(todosList) {
  let filtered = todosList;

  // Category filter
  const categoryFilter = getSelectedProjectKey();
  if (categoryFilter) {
    filtered = filtered.filter((todo) => {
      const todoProject = normalizeProjectPath(todo.category);
      if (!todoProject) {
        return false;
      }
      return (
        todoProject === categoryFilter ||
        todoProject.startsWith(`${categoryFilter}${PROJECT_PATH_SEPARATOR}`)
      );
    });
  }

  // Search filter
  const searchQuery = document
    .getElementById("searchInput")
    ?.value.toLowerCase()
    .trim();
  if (searchQuery) {
    filtered = filtered.filter(
      (todo) =>
        todo.title.toLowerCase().includes(searchQuery) ||
        (todo.description &&
          todo.description.toLowerCase().includes(searchQuery)) ||
        (todo.category && todo.category.toLowerCase().includes(searchQuery)),
    );
  }

  filtered = filtered.filter((todo) => matchesDateView(todo));

  return filtered;
}

function applyFiltersAndRender({ reason = "unknown" } = {}) {
  if (isApplyingFiltersPipeline) return;
  isApplyingFiltersPipeline = true;
  try {
    // Keep filterTodos in the pipeline to preserve legacy entry-point semantics.
    filterTodos({ skipPipeline: true, reason });
    renderTodos();
    updateHeaderFromVisibleTodos(getVisibleTodos());
    syncTodoDrawerStateWithRender();
  } finally {
    isApplyingFiltersPipeline = false;
  }
}

// Called when filter changes
function filterTodos({ skipPipeline = false, reason = "manual" } = {}) {
  if (skipPipeline) {
    return getVisibleTodos();
  }
  applyFiltersAndRender({ reason });
  return getVisibleTodos();
}

// Clear all filters
function clearFilters() {
  setSelectedProjectKey("", {
    reason: "clear-filters-reset-project",
    skipApply: true,
  });
  document.getElementById("searchInput").value = "";
  setDateView("all", { skipApply: true });
  applyFiltersAndRender({ reason: "clear-filters" });
}

function getProjectsRailElements() {
  const layout = document.querySelector(".todos-layout");
  const desktopRail = document.getElementById("projectsRail");
  const collapseToggle = document.getElementById("projectsRailToggle");
  const railList = document.getElementById("projectsRailList");
  const desktopPrimary = desktopRail?.querySelector(".projects-rail__primary");
  const allTasksButton = desktopPrimary?.querySelector(".projects-rail-item");
  const mobileOpenButton = document.getElementById("projectsRailMobileOpen");
  const mobileCloseButton = document.getElementById("projectsRailMobileClose");
  const createButton = document.getElementById("projectsRailCreateButton");
  const sheetCreateButton = document.getElementById(
    "projectsRailSheetCreateButton",
  );
  const sheet = document.getElementById("projectsRailSheet");
  const sheetList =
    document.getElementById("projectsRailSheetList") ||
    sheet?.querySelector(".projects-rail__section .projects-rail__list");
  const sheetAllTasksButton = sheet?.querySelector(
    ".projects-rail__primary .projects-rail-item",
  );
  const backdrop = document.getElementById("projectsRailBackdrop");

  if (!(desktopRail instanceof HTMLElement)) return null;
  if (!(collapseToggle instanceof HTMLElement)) return null;
  if (!(railList instanceof HTMLElement)) return null;
  if (!(allTasksButton instanceof HTMLElement)) return null;
  if (!(mobileOpenButton instanceof HTMLElement)) return null;
  if (!(mobileCloseButton instanceof HTMLElement)) return null;
  if (!(createButton instanceof HTMLElement)) return null;
  if (!(sheetCreateButton instanceof HTMLElement)) return null;
  if (!(sheet instanceof HTMLElement)) return null;
  if (!(sheetList instanceof HTMLElement)) return null;
  if (!(sheetAllTasksButton instanceof HTMLElement)) return null;
  if (!(backdrop instanceof HTMLElement)) return null;

  return {
    layout,
    desktopRail,
    collapseToggle,
    railList,
    allTasksButton,
    mobileOpenButton,
    mobileCloseButton,
    createButton,
    sheetCreateButton,
    sheet,
    sheetList,
    sheetAllTasksButton,
    backdrop,
  };
}

function isMobileRailViewport() {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(MOBILE_DRAWER_MEDIA_QUERY).matches;
}

function getProjectTodoCount(projectName) {
  if (!projectName) return todos.length;
  return todos.filter((todo) => {
    const todoProject = normalizeProjectPath(todo.category);
    if (!todoProject) return false;
    return (
      todoProject === projectName ||
      todoProject.startsWith(`${projectName}${PROJECT_PATH_SEPARATOR}`)
    );
  }).length;
}

function getSelectedProjectLabel(selectedProject) {
  if (!selectedProject) return "All tasks";
  return getProjectLeafName(selectedProject);
}

function formatVisibleTaskCount(taskCount) {
  return `${taskCount} ${taskCount === 1 ? "task" : "tasks"}`;
}

function getSelectedProjectFilterValue() {
  const filter = document.getElementById("categoryFilter");
  if (!(filter instanceof HTMLSelectElement)) {
    return "";
  }
  const normalized = normalizeProjectPath(filter.value);
  return isInternalCategoryPath(normalized) ? "" : normalized;
}

function getSelectedProjectKey() {
  return getSelectedProjectFilterValue();
}

function setSelectedProjectKey(
  value = "",
  { reason = "project-selection", skipApply = false } = {},
) {
  const filterSelect = document.getElementById("categoryFilter");
  if (!(filterSelect instanceof HTMLSelectElement)) {
    return "";
  }

  const normalizedValue =
    typeof value === "string" ? normalizeProjectPath(value) : "";
  const nextValue =
    normalizedValue && !isInternalCategoryPath(normalizedValue)
      ? normalizedValue
      : "";

  if (
    nextValue &&
    !Array.from(filterSelect.options).some((opt) => opt.value === nextValue)
  ) {
    updateCategoryFilter();
  }

  if (filterSelect.value !== nextValue) {
    filterSelect.value = nextValue;
  }

  railRovingFocusKey = nextValue || "";
  syncWorkspaceViewState();
  if (!skipApply) {
    applyFiltersAndRender({ reason });
  }
  return nextValue;
}

function getSelectedProjectName() {
  return getSelectedProjectLabel(getSelectedProjectKey());
}

function getVisibleTodosCount(visibleTodos = []) {
  return Array.isArray(visibleTodos) ? visibleTodos.length : 0;
}

function getCurrentDateViewLabel() {
  const labels = {
    all: "",
    today: "Today",
    upcoming: "Upcoming",
    completed: "Completed",
    next_month: "Next month",
    someday: "Someday",
  };
  return labels[currentDateView] || "";
}

function updateHeaderAndContextUI({
  projectName = "All tasks",
  visibleCount = 0,
  dateLabel = "",
} = {}) {
  const breadcrumbEl = document.getElementById("todosListHeaderBreadcrumb");
  const titleEl = document.getElementById("todosListHeaderTitle");
  const countEl = document.getElementById("todosListHeaderCount");
  const dateBadgeEl = document.getElementById("todosListHeaderDateBadge");
  if (
    !(titleEl instanceof HTMLElement) ||
    !(countEl instanceof HTMLElement) ||
    !(breadcrumbEl instanceof HTMLElement) ||
    !(dateBadgeEl instanceof HTMLElement)
  ) {
    return;
  }

  breadcrumbEl.textContent = "Projects /";
  titleEl.textContent = projectName;
  titleEl.setAttribute("title", projectName);
  countEl.textContent = formatVisibleTaskCount(visibleCount);

  if (dateLabel) {
    dateBadgeEl.hidden = false;
    dateBadgeEl.textContent = dateLabel;
  } else {
    dateBadgeEl.hidden = true;
    dateBadgeEl.textContent = "";
  }

  updateTopbarProjectsButton(projectName);
}

function updateHeaderFromVisibleTodos(visibleTodos = []) {
  updateHeaderAndContextUI({
    projectName: getSelectedProjectName(),
    visibleCount: getVisibleTodosCount(visibleTodos),
    dateLabel: getCurrentDateViewLabel(),
  });
}

function assertNoHorizontalOverflow(container) {
  if (!window.__ASSERT_UI_OVERFLOW__) return;
  if (!(container instanceof HTMLElement)) return;
  if (container.scrollWidth > container.clientWidth + 1) {
    console.warn("Horizontal overflow detected in todos scroll region", {
      scrollWidth: container.scrollWidth,
      clientWidth: container.clientWidth,
    });
  }
}

function updateTopbarProjectsButton(selectedProjectName = "All tasks") {
  const refs = getProjectsRailElements();
  if (!refs) return;

  const topbarLabel = document.getElementById("projectsRailTopbarLabel");
  const shouldShow = isMobileRailViewport() || isRailCollapsed;

  refs.mobileOpenButton.classList.toggle(
    "projects-rail-mobile-open--show",
    shouldShow,
  );
  refs.mobileOpenButton.setAttribute(
    "aria-expanded",
    String(isMobileRailViewport() ? isRailSheetOpen : !isRailCollapsed),
  );
  if (shouldShow) {
    refs.mobileOpenButton.removeAttribute("aria-hidden");
    refs.mobileOpenButton.removeAttribute("tabindex");
  } else {
    refs.mobileOpenButton.setAttribute("aria-hidden", "true");
    refs.mobileOpenButton.setAttribute("tabindex", "-1");
  }

  if (topbarLabel instanceof HTMLElement) {
    const label = selectedProjectName || "All tasks";
    topbarLabel.innerHTML = `Projects: <span class="projects-active-label">${escapeHtml(label)}</span>`;
    topbarLabel.setAttribute("title", `Projects: ${label}`);
  }
}

function getCommandPaletteElements() {
  const overlay = document.getElementById("commandPaletteOverlay");
  const panel = document.getElementById("commandPalettePanel");
  const input = document.getElementById("commandPaletteInput");
  const list = document.getElementById("commandPaletteList");
  const empty = document.getElementById("commandPaletteEmpty");
  const title = document.getElementById("commandPaletteTitle");
  if (!(overlay instanceof HTMLElement)) return null;
  if (!(panel instanceof HTMLElement)) return null;
  if (!(input instanceof HTMLInputElement)) return null;
  if (!(list instanceof HTMLElement)) return null;
  if (!(empty instanceof HTMLElement)) return null;
  if (!(title instanceof HTMLElement)) return null;
  return { overlay, panel, input, list, empty, title };
}

function buildCommandPaletteItems() {
  const baseItems = [
    {
      id: "add-task",
      label: "Add task",
      type: "action",
      payload: "add-task",
    },
    {
      id: "all-tasks",
      label: "Go to All tasks",
      type: "project",
      payload: "",
    },
  ];

  const projectItems = getAllProjects().map((projectName) => ({
    id: `project-${projectName}`,
    label: `Go to project: ${getProjectLeafName(projectName)}`,
    type: "project",
    payload: projectName,
  }));

  return [...baseItems, ...projectItems];
}

function getCommandPaletteCommandMatches(query) {
  if (!query) {
    return commandPaletteItems;
  }
  return commandPaletteItems.filter((item) =>
    item.label.toLowerCase().includes(query),
  );
}

function getCommandPaletteTaskMatches(query) {
  if (!query) {
    return [];
  }

  const normalizedQuery = query.toLowerCase();
  const ranked = todos
    .map((todo) => {
      const title = String(todo.title || "");
      const description = String(todo.description || "");
      const titleLower = title.toLowerCase();
      const descriptionLower = description.toLowerCase();

      let score = -1;
      if (titleLower.startsWith(normalizedQuery)) {
        score = 0;
      } else if (titleLower.includes(normalizedQuery)) {
        score = 1;
      } else if (descriptionLower.includes(normalizedQuery)) {
        score = 2;
      }

      if (score === -1) return null;

      const dueAt = todo.dueDate ? new Date(todo.dueDate).getTime() : Infinity;
      return {
        id: `task-${todo.id}`,
        type: "task",
        todoId: String(todo.id),
        label: title,
        score,
        dueAt: Number.isFinite(dueAt) ? dueAt : Infinity,
        completed: !!todo.completed,
        meta: [
          todo.category ? `Project: ${todo.category}` : "",
          todo.dueDate
            ? `Due: ${new Date(todo.dueDate).toLocaleDateString()}`
            : "",
        ]
          .filter(Boolean)
          .join(" • "),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      const titleCompare = a.label.localeCompare(b.label);
      if (titleCompare !== 0) return titleCompare;
      return a.todoId.localeCompare(b.todoId);
    });

  return ranked.slice(0, 6);
}

function getCommandPaletteRenderModel() {
  const query = commandPaletteQuery.trim().toLowerCase();
  const commandMatches = getCommandPaletteCommandMatches(query);
  const taskMatches = getCommandPaletteTaskMatches(query);
  const rows = [];

  if (commandMatches.length > 0) {
    rows.push({
      kind: "section",
      id: "commands-section",
      label: "Commands",
    });
    commandMatches.forEach((item) => {
      rows.push({ kind: "item", item });
    });
  }

  if (query) {
    rows.push({
      kind: "section",
      id: "tasks-section",
      label: "Tasks",
    });
    if (taskMatches.length === 0) {
      rows.push({
        kind: "empty",
        id: "tasks-empty",
        label: "No tasks found",
      });
    } else {
      taskMatches.forEach((item) => {
        rows.push({ kind: "item", item });
      });
    }
  }

  const selectableItems = rows
    .filter((row) => row.kind === "item")
    .map((row) => row.item);

  const hasAnyResults =
    commandMatches.length > 0 || (!!query && taskMatches.length > 0);
  return { rows, selectableItems, hasAnyResults };
}

function renderCommandPalette() {
  const refs = getCommandPaletteElements();
  if (!refs) return;

  refs.overlay.classList.toggle(
    "command-palette-overlay--open",
    isCommandPaletteOpen,
  );
  refs.overlay.setAttribute("aria-hidden", String(!isCommandPaletteOpen));
  refs.input.value = commandPaletteQuery;

  const renderModel = getCommandPaletteRenderModel();
  commandPaletteSelectableItems = renderModel.selectableItems;
  if (commandPaletteSelectableItems.length === 0) {
    commandPaletteIndex = 0;
  } else if (commandPaletteIndex > commandPaletteSelectableItems.length - 1) {
    commandPaletteIndex = commandPaletteSelectableItems.length - 1;
  }

  refs.input.setAttribute("aria-expanded", String(isCommandPaletteOpen));
  refs.input.setAttribute(
    "aria-activedescendant",
    commandPaletteSelectableItems.length > 0
      ? `commandPaletteOption-${commandPaletteIndex}`
      : "",
  );

  let selectableIndex = -1;
  refs.list.innerHTML = renderModel.rows
    .map((row) => {
      if (row.kind === "section") {
        return `<div class="command-palette-section" role="presentation">${escapeHtml(row.label)}</div>`;
      }
      if (row.kind === "empty") {
        return `<div class="command-palette-inline-empty" role="status">${escapeHtml(row.label)}</div>`;
      }

      selectableIndex += 1;
      const isActive = selectableIndex === commandPaletteIndex;
      const item = row.item;
      if (item.type === "task") {
        return `
          <button
            type="button"
            id="commandPaletteOption-${selectableIndex}"
            class="command-palette-option command-palette-option--task ${isActive ? "command-palette-option--active" : ""} ${item.completed ? "command-palette-option--completed" : ""}"
            role="option"
            aria-selected="${isActive ? "true" : "false"}"
            data-command-index="${selectableIndex}"
            data-command-id="${escapeHtml(item.id)}"
          >
            <span class="command-palette-option__title">${escapeHtml(item.label)}</span>
            <span class="command-palette-option__meta">${escapeHtml(item.meta || (item.completed ? "Completed" : ""))}</span>
          </button>
        `;
      }

      return `
        <button
          type="button"
          id="commandPaletteOption-${selectableIndex}"
          class="command-palette-option ${isActive ? "command-palette-option--active" : ""}"
          role="option"
          aria-selected="${isActive ? "true" : "false"}"
          data-command-index="${selectableIndex}"
          data-command-id="${escapeHtml(item.id)}"
        >
          ${escapeHtml(item.label)}
        </button>
      `;
    })
    .join("");

  refs.empty.hidden = renderModel.hasAnyResults;
}

function executeCommandPaletteItem(item, triggerEl = null) {
  if (!item) return;

  const todosView = document.getElementById("todosView");
  const shouldSwitchToTodos =
    !(todosView instanceof HTMLElement) ||
    !todosView.classList.contains("active") ||
    todosView.classList.contains("todos-view--settings-active");

  if (item.type === "action" && item.payload === "add-task") {
    const todosTab = document.querySelector(
      ".nav-tab[data-onclick*=\"switchView('todos'\"]",
    );
    if (shouldSwitchToTodos) {
      switchView("todos", todosTab instanceof HTMLElement ? todosTab : null);
    }
    closeCommandPalette({ restoreFocus: false });
    window.requestAnimationFrame(() => {
      document.getElementById("todoInput")?.focus();
    });
    return;
  }

  if (item.type === "project") {
    const todosTab = document.querySelector(
      ".nav-tab[data-onclick*=\"switchView('todos'\"]",
    );
    if (shouldSwitchToTodos) {
      switchView("todos", todosTab instanceof HTMLElement ? todosTab : null);
    }
    setSelectedProjectKey(String(item.payload || ""));
    closeCommandPalette({ restoreFocus: false });
  }

  if (item.type === "task") {
    const todosTab = document.querySelector(
      ".nav-tab[data-onclick*=\"switchView('todos'\"]",
    );
    if (shouldSwitchToTodos) {
      switchView("todos", todosTab instanceof HTMLElement ? todosTab : null);
    }

    closeCommandPalette({ restoreFocus: false });
    window.requestAnimationFrame(() => {
      openTodoDrawer(
        item.todoId,
        triggerEl instanceof HTMLElement ? triggerEl : null,
      );
    });
  }
}

function moveCommandPaletteSelection(delta) {
  const visibleCount = commandPaletteSelectableItems.length;
  if (visibleCount === 0) {
    commandPaletteIndex = 0;
    renderCommandPalette();
    return;
  }
  commandPaletteIndex =
    (commandPaletteIndex + delta + visibleCount) % visibleCount;
  renderCommandPalette();
}

function closeCommandPalette({ restoreFocus = true } = {}) {
  if (!isCommandPaletteOpen) return;
  isCommandPaletteOpen = false;
  commandPaletteQuery = "";
  commandPaletteIndex = 0;
  commandPaletteSelectableItems = [];
  renderCommandPalette();

  if (restoreFocus && lastFocusedBeforePalette instanceof HTMLElement) {
    lastFocusedBeforePalette.focus({ preventScroll: true });
  }
}

function openCommandPalette() {
  if (!currentUser) return;

  const refs = getCommandPaletteElements();
  if (!refs) return;
  if (isCommandPaletteOpen) return;

  lastFocusedBeforePalette =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  commandPaletteItems = buildCommandPaletteItems();
  commandPaletteSelectableItems = [];
  commandPaletteQuery = "";
  commandPaletteIndex = 0;
  isCommandPaletteOpen = true;
  renderCommandPalette();

  window.requestAnimationFrame(() => {
    refs.input.focus();
    refs.input.select();
  });
}

function toggleCommandPalette() {
  if (isCommandPaletteOpen) {
    closeCommandPalette({ restoreFocus: true });
    return;
  }
  openCommandPalette();
}

function focusActiveProjectItem({ preferSheet = false } = {}) {
  const refs = getProjectsRailElements();
  if (!refs) return;
  const root = preferSheet ? refs.sheet : refs.desktopRail;
  const selectedProject = getSelectedProjectKey();
  const optionSelector = `.projects-rail-item[data-project-key="${escapeSelectorValue(selectedProject)}"]`;
  const activeItem =
    root.querySelector(optionSelector) ||
    root.querySelector('.projects-rail-item[data-project-key=""]') ||
    root.querySelector('.projects-rail-item[aria-current="page"]') ||
    root.querySelector(".projects-rail-item[data-project-key]");
  if (activeItem instanceof HTMLElement) {
    railRovingFocusKey = activeItem.getAttribute("data-project-key") || "";
    activeItem.focus();
  }
}

function openProjectsFromTopbar(triggerEl = null) {
  if (isMobileRailViewport()) {
    openProjectsRailSheet(triggerEl);
    return;
  }

  if (isRailCollapsed) {
    setProjectsRailCollapsed(false);
  }

  const refs = getProjectsRailElements();
  if (triggerEl instanceof HTMLElement && refs) {
    lastFocusedRailTrigger = triggerEl;
  }
  window.requestAnimationFrame(() => {
    focusActiveProjectItem({ preferSheet: false });
  });
}

function renderProjectsRailListHtml({ projects, selectedProject }) {
  return projects
    .map((projectName) => {
      const isActive = projectName === selectedProject;
      const count = getProjectTodoCount(projectName);
      const isMenuOpen = openRailProjectMenuKey === projectName;
      return `
        <div class="projects-rail-row ${isMenuOpen ? "projects-rail-row--menu-open" : ""}">
          <button
            type="button"
            class="projects-rail-item ${isActive ? "projects-rail-item--active" : ""}"
            data-project-key="${escapeHtml(projectName)}"
            ${isActive ? 'aria-current="page"' : ""}
          >
            <span class="projects-rail-item__label" title="${escapeHtml(getProjectLeafName(projectName))}">${escapeHtml(getProjectLeafName(projectName))}</span>
            <span class="projects-rail-item__count">${count}</span>
          </button>
          <button
            type="button"
            class="projects-rail-kebab"
            aria-label="Project actions for ${escapeHtml(getProjectLeafName(projectName))}"
            aria-expanded="${isMenuOpen ? "true" : "false"}"
            data-project-menu-toggle="${escapeHtml(projectName)}"
          >
            ⋯
          </button>
          <div class="projects-rail-menu ${isMenuOpen ? "projects-rail-menu--open" : ""}" role="menu">
            <button
              type="button"
              class="projects-rail-menu-item"
              role="menuitem"
              data-project-menu-action="rename"
              data-project-key="${escapeHtml(projectName)}"
            >
              Rename
            </button>
            <button
              type="button"
              class="projects-rail-menu-item projects-rail-menu-item--danger"
              role="menuitem"
              data-project-menu-action="delete"
              data-project-key="${escapeHtml(projectName)}"
            >
              Delete
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function getRailOptionElements(root) {
  return Array.from(
    root.querySelectorAll(".projects-rail-item[data-project-key]"),
  ).filter((button) => button instanceof HTMLElement);
}

function getCurrentRailFocusKey(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!root.contains(active)) return null;

  const focusedOption = active.closest(".projects-rail-item[data-project-key]");
  if (!(focusedOption instanceof HTMLElement)) return null;
  return focusedOption.getAttribute("data-project-key") || "";
}

function moveRailOptionFocus(root, delta) {
  const options = getRailOptionElements(root);
  if (options.length === 0) return;

  const focusedKey = getCurrentRailFocusKey(root);
  const currentKey =
    focusedKey !== null
      ? focusedKey
      : railRovingFocusKey || getSelectedProjectKey();
  const currentIndex = options.findIndex(
    (button) => (button.getAttribute("data-project-key") || "") === currentKey,
  );
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (baseIndex + delta + options.length) % options.length;
  const nextOption = options[nextIndex];
  if (!(nextOption instanceof HTMLElement)) return;

  railRovingFocusKey = nextOption.getAttribute("data-project-key") || "";
  options.forEach((button, index) => {
    button.setAttribute("tabindex", index === nextIndex ? "0" : "-1");
  });
  nextOption.focus({ preventScroll: true });
}

function syncRailA11yState(root, selectedProject, focusKey = "") {
  root.setAttribute("role", "listbox");
  root.setAttribute("aria-label", "Projects");

  const options = getRailOptionElements(root);
  const fallbackFocusKey =
    focusKey ||
    selectedProject ||
    options[0]?.getAttribute("data-project-key") ||
    "";

  options.forEach((button) => {
    const projectName = button.getAttribute("data-project-key") || "";
    const isActive = projectName === selectedProject;
    const isFocusTarget = projectName === fallbackFocusKey;

    button.classList.toggle("projects-rail-item--active", isActive);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isFocusTarget ? "0" : "-1");

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function setProjectsRailActiveState(selectedProject) {
  const refs = getProjectsRailElements();
  if (!refs) return;

  const desktopFocusKey =
    getCurrentRailFocusKey(refs.desktopRail) ||
    railRovingFocusKey ||
    selectedProject;
  const sheetFocusKey =
    getCurrentRailFocusKey(refs.sheet) || railRovingFocusKey || selectedProject;

  syncRailA11yState(refs.desktopRail, selectedProject, desktopFocusKey);
  syncRailA11yState(refs.sheet, selectedProject, sheetFocusKey);
}

function renderProjectsRail() {
  const refs = getProjectsRailElements();
  if (!refs) return;

  if (isRailSheetOpen && !isMobileRailViewport()) {
    closeProjectsRailSheet({ restoreFocus: false });
  }

  const selectedProject = getSelectedProjectKey();
  const allCount = todos.length;
  const projects = getAllProjects();
  if (openRailProjectMenuKey && !projects.includes(openRailProjectMenuKey)) {
    openRailProjectMenuKey = null;
  }

  refs.railList.innerHTML = renderProjectsRailListHtml({
    projects,
    selectedProject,
  });
  refs.sheetList.innerHTML = renderProjectsRailListHtml({
    projects,
    selectedProject,
  });

  const desktopAllCount = refs.allTasksButton.querySelector(
    ".projects-rail-item__count",
  );
  if (desktopAllCount instanceof HTMLElement) {
    desktopAllCount.textContent = String(allCount);
  }
  const sheetAllCount = refs.sheetAllTasksButton.querySelector(
    ".projects-rail-item__count",
  );
  if (sheetAllCount instanceof HTMLElement) {
    sheetAllCount.textContent = String(allCount);
  }

  refs.allTasksButton.setAttribute("data-project-key", "");
  refs.allTasksButton.setAttribute("type", "button");
  refs.sheetAllTasksButton.setAttribute("data-project-key", "");
  refs.sheetAllTasksButton.setAttribute("type", "button");
  refs.sheetAllTasksButton.classList.add("projects-rail-item");
  refs.sheetAllTasksButton.setAttribute("title", "All tasks");

  if (!railRovingFocusKey) {
    railRovingFocusKey = selectedProject || "";
  }
  setProjectsRailActiveState(selectedProject);
  syncWorkspaceViewState();
  setProjectsRailCollapsed(isRailCollapsed);
  updateTopbarProjectsButton(getSelectedProjectLabel(selectedProject));
}

function setProjectsRailCollapsed(nextCollapsed) {
  isRailCollapsed = !!nextCollapsed;
  persistRailCollapsedState(isRailCollapsed);
  const refs = getProjectsRailElements();
  if (!refs) return;

  refs.desktopRail.classList.toggle(
    "projects-rail--collapsed",
    isRailCollapsed,
  );
  refs.layout?.classList.toggle(
    "todos-layout--rail-collapsed",
    isRailCollapsed,
  );
  refs.collapseToggle.setAttribute("aria-expanded", String(!isRailCollapsed));
  refs.collapseToggle.textContent = isRailCollapsed ? "Expand" : "Collapse";
  updateTopbarProjectsButton(getSelectedProjectName());
}

function closeRailProjectMenu({ restoreFocus = false } = {}) {
  const previousKey = openRailProjectMenuKey;
  openRailProjectMenuKey = null;
  renderProjectsRail();

  if (restoreFocus && previousKey) {
    const toggle = document.querySelector(
      `.projects-rail-kebab[data-project-menu-toggle="${escapeSelectorValue(previousKey)}"]`,
    );
    if (toggle instanceof HTMLElement) {
      toggle.focus({ preventScroll: true });
    }
  }
}

function toggleRailProjectMenu(projectName, triggerEl = null) {
  if (!projectName) return;
  const willOpen = openRailProjectMenuKey !== projectName;
  openRailProjectMenuKey = willOpen ? projectName : null;
  renderProjectsRail();
  if (!willOpen) return;

  window.requestAnimationFrame(() => {
    const firstAction = document.querySelector(
      `.projects-rail-menu-item[data-project-key="${escapeSelectorValue(projectName)}"]`,
    );
    if (firstAction instanceof HTMLElement) {
      firstAction.focus();
      return;
    }
    if (triggerEl instanceof HTMLElement) {
      triggerEl.focus();
    }
  });
}

function lockBodyScrollForProjectsRail() {
  if (isRailBodyLocked || isDrawerBodyLocked) return;
  const body = document.body;
  railScrollLockY = window.scrollY || 0;
  body.classList.add("is-projects-rail-open");
  body.style.position = "fixed";
  body.style.top = `-${railScrollLockY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  isRailBodyLocked = true;
}

function unlockBodyScrollForProjectsRail() {
  if (!isRailBodyLocked || isDrawerBodyLocked) return;
  const body = document.body;
  body.classList.remove("is-projects-rail-open");
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  window.scrollTo(0, railScrollLockY);
  railScrollLockY = 0;
  isRailBodyLocked = false;
}

function openProjectsRailSheet(triggerEl = null) {
  const refs = getProjectsRailElements();
  if (!refs || isRailSheetOpen || !isMobileRailViewport()) return;

  closeRailProjectMenu();
  isRailSheetOpen = true;
  refs.sheet.classList.add("projects-rail-sheet--open");
  refs.sheet.setAttribute("aria-hidden", "false");
  refs.backdrop.classList.add("projects-rail-backdrop--open");
  refs.backdrop.setAttribute("aria-hidden", "false");
  refs.mobileOpenButton.setAttribute("aria-expanded", "true");
  lastFocusedRailTrigger =
    triggerEl instanceof HTMLElement ? triggerEl : refs.mobileOpenButton;

  lockBodyScrollForProjectsRail();
  window.requestAnimationFrame(() => {
    focusActiveProjectItem({ preferSheet: true });
  });
}

function closeProjectsRailSheet({ restoreFocus = false } = {}) {
  const refs = getProjectsRailElements();
  if (!refs || !isRailSheetOpen) return;

  closeRailProjectMenu();
  isRailSheetOpen = false;
  refs.sheet.classList.remove("projects-rail-sheet--open");
  refs.sheet.setAttribute("aria-hidden", "true");
  refs.backdrop.classList.remove("projects-rail-backdrop--open");
  refs.backdrop.setAttribute("aria-hidden", "true");
  refs.mobileOpenButton.setAttribute("aria-expanded", "false");

  unlockBodyScrollForProjectsRail();
  const selectedProject = getSelectedProjectKey();
  updateTopbarProjectsButton(getSelectedProjectLabel(selectedProject));

  if (restoreFocus) {
    const focusTarget =
      lastFocusedRailTrigger instanceof HTMLElement
        ? lastFocusedRailTrigger
        : refs.mobileOpenButton;
    focusTarget.focus({ preventScroll: true });
  }
}

function selectProjectFromRail(projectName, triggerEl = null) {
  if (openRailProjectMenuKey) {
    openRailProjectMenuKey = null;
  }
  railRovingFocusKey = normalizeProjectPath(projectName);
  setSelectedProjectKey(projectName);

  if (isRailSheetOpen) {
    closeProjectsRailSheet({
      restoreFocus: !(triggerEl instanceof HTMLElement),
    });
  }
}

function getMoreFiltersElements() {
  const toggle = document.getElementById("moreFiltersToggle");
  const panel = document.getElementById("moreFiltersPanel");
  if (!toggle || !panel) {
    return null;
  }
  return { toggle, panel };
}

function getFirstFocusableInMoreFilters(panel) {
  return panel.querySelector(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  );
}

function openMoreFilters() {
  const refs = getMoreFiltersElements();
  if (!refs) return;

  const { toggle, panel } = refs;
  isMoreFiltersOpen = true;
  panel.classList.add("more-filters--open");
  toggle.setAttribute("aria-expanded", "true");

  const firstFocusable = getFirstFocusableInMoreFilters(panel);
  if (firstFocusable instanceof HTMLElement) {
    firstFocusable.focus();
  }
}

function closeMoreFilters({ restoreFocus = false } = {}) {
  const refs = getMoreFiltersElements();
  if (!refs) return;

  const { toggle, panel } = refs;
  isMoreFiltersOpen = false;
  panel.classList.remove("more-filters--open");
  toggle.setAttribute("aria-expanded", "false");

  if (restoreFocus) {
    toggle.focus();
  }
}

function toggleMoreFilters() {
  if (isMoreFiltersOpen) {
    closeMoreFilters();
    return;
  }
  openMoreFilters();
}

function createInitialTaskDrawerAssistState() {
  return {
    todoId: "",
    loading: false,
    unavailable: !FEATURE_TASK_DRAWER_DECISION_ASSIST,
    error: "",
    aiSuggestionId: "",
    mustAbstain: false,
    suggestions: [],
    applyingSuggestionId: "",
    confirmSuggestionId: "",
    undoBySuggestionId: {},
    lastUndoSuggestionId: "",
    // lint-first: show chip only; full panel revealed by Fix/Review
    showFullAssist: false,
  };
}

function taskDrawerDismissKey(todoId) {
  return `taskDrawerAssist:dismissed:${todoId}`;
}

function markTaskDrawerDismissed(todoId) {
  try {
    window.localStorage.setItem(taskDrawerDismissKey(todoId), "1");
  } catch {}
}

function clearTaskDrawerDismissed(todoId) {
  try {
    window.localStorage.removeItem(taskDrawerDismissKey(todoId));
  } catch {}
}

function isTaskDrawerDismissed(todoId) {
  try {
    return window.localStorage.getItem(taskDrawerDismissKey(todoId)) === "1";
  } catch {
    return false;
  }
}

function resetTaskDrawerAssistState(todoId = "") {
  taskDrawerAssistState = {
    ...createInitialTaskDrawerAssistState(),
    todoId,
  };
}

function getTaskDrawerSuggestionLabel(type) {
  return labelForType(type);
}

function normalizeTaskDrawerAssistEnvelope(
  aiSuggestionId,
  outputEnvelope,
  fallbackTodoId,
) {
  const suggestionsRaw = Array.isArray(outputEnvelope?.suggestions)
    ? outputEnvelope.suggestions
    : [];
  const normalized = suggestionsRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const suggestion = item;
      const type = String(suggestion.type || "");
      if (!shouldRenderTypeForSurface("task_drawer", type)) {
        return null;
      }
      const payload =
        suggestion.payload && typeof suggestion.payload === "object"
          ? { ...suggestion.payload }
          : {};
      if (typeof payload.todoId !== "string" || !payload.todoId.trim()) {
        payload.todoId = fallbackTodoId;
      }
      return {
        type,
        suggestionId:
          String(suggestion.suggestionId || "").trim() ||
          `${aiSuggestionId || "drawer"}-${index + 1}`,
        confidence: Math.max(
          0,
          Math.min(1, Number(suggestion.confidence) || 0),
        ),
        rationale: truncateRationale(suggestion.rationale, 120),
        payload,
        requiresConfirmation: needsConfirmation(suggestion),
        dismissed: false,
      };
    })
    .filter(Boolean);
  return capSuggestions(sortSuggestions("task_drawer", normalized), 6);
}

function renderTaskDrawerSuggestionSummary(suggestion) {
  if (suggestion.type === "rewrite_title") {
    return String(suggestion.payload.title || "Rewrite task title");
  }
  if (suggestion.type === "set_due_date") {
    const due = new Date(String(suggestion.payload.dueDateISO || ""));
    return Number.isNaN(due.getTime())
      ? "Set due date"
      : `Set due ${due.toLocaleDateString()}`;
  }
  if (suggestion.type === "set_priority") {
    return `Set priority ${String(suggestion.payload.priority || "").toUpperCase()}`;
  }
  if (suggestion.type === "set_project") {
    return `Set project ${String(suggestion.payload.projectName || suggestion.payload.category || "")}`.trim();
  }
  if (suggestion.type === "set_category") {
    return `Set category ${String(suggestion.payload.category || "")}`.trim();
  }
  if (suggestion.type === "split_subtasks") {
    const count = Array.isArray(suggestion.payload.subtasks)
      ? suggestion.payload.subtasks.length
      : 0;
    return `Add ${count} subtasks`;
  }
  if (suggestion.type === "propose_next_action") {
    return String(suggestion.payload.text || suggestion.payload.title || "");
  }
  if (suggestion.type === "ask_clarification") {
    return String(suggestion.payload.question || "Need one clarification");
  }
  return "Suggestion";
}

function renderTaskDrawerAssistSection(todoId) {
  // Lint-first gate: show lint chip only when a heuristic fires.
  // Full panel should render only after explicit user action.
  // In debug mode, always show the full panel so developers see all metadata.
  const state = taskDrawerAssistState;
  if (!state.showFullAssist && !AI_DEBUG_ENABLED) {
    const todo = getTodoById(todoId);
    const issue = todo
      ? lintTodoFields({
          title: todo.title,
          dueDate: todo.dueDate || "",
          priority: todo.priority || "",
          subtasks: Array.isArray(todo.subtasks) ? todo.subtasks : [],
          allTodos: todos,
        })
      : null;
    if (issue) {
      // A lint issue is present — show only the chip (suppress full panel).
      return `
        <div class="todo-drawer__section">
          <div class="todo-drawer__section-title">AI Suggestions</div>
          ${renderLintChip(issue)}
        </div>
      `;
    }
    return "";
  }

  if (!FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    return `
      <div class="todo-drawer__section">
        <div class="todo-drawer__section-title">AI Suggestions</div>
        <div class="ai-empty" role="status">AI Suggestions unavailable.</div>
      </div>
    `;
  }
  const base = `
    <div class="todo-drawer__section">
      <div class="todo-drawer__section-title">AI Suggestions</div>
      ${renderAiDebugMeta({
        requestId: state.requestId,
        generatedAt: state.generatedAt,
        contractVersion: state.contractVersion,
      })}
      ${state.loading ? '<div class="ai-empty" role="status">Loading suggestions...</div>' : ""}
      ${
        state.unavailable
          ? '<div class="ai-empty" role="status">AI Suggestions unavailable.</div>'
          : ""
      }
      ${state.error ? `<div class="ai-empty" role="status">${escapeHtml(state.error)}</div>` : ""}
      ${
        !state.loading &&
        !state.unavailable &&
        !state.error &&
        (state.mustAbstain || state.suggestions.length === 0)
          ? '<div class="ai-empty" role="status">No suggestions right now.</div>'
          : ""
      }
      ${
        state.suggestions.length > 0
          ? `<div class="todo-drawer-ai-list">
              ${state.suggestions
                .map((suggestion) => {
                  const confidenceLabel = confidenceLabelForSuggestion(
                    suggestion.confidence,
                  );
                  const applying =
                    state.applyingSuggestionId === suggestion.suggestionId;
                  const confirmOpen =
                    state.confirmSuggestionId === suggestion.suggestionId;
                  return `
                    <div class="todo-drawer-ai-card ai-card" data-testid="task-drawer-ai-card-${escapeHtml(suggestion.suggestionId)}">
                      <div class="todo-drawer-ai-card__top">
                        <span class="todo-drawer-ai-card__label">${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}</span>
                        <span class="ai-badge ai-badge--${escapeHtml(confidenceBand(suggestion.confidence))}" aria-label="Confidence ${escapeHtml(confidenceLabel)}">${escapeHtml(confidenceLabel)}</span>
                      </div>
                      <div class="todo-drawer-ai-card__summary">${escapeHtml(renderTaskDrawerSuggestionSummary(suggestion))}</div>
                      <div class="todo-drawer-ai-card__rationale ai-tooltip">${escapeHtml(suggestion.rationale)}</div>
                      ${renderAiDebugSuggestionId(suggestion.suggestionId)}
                      ${
                        state.lastUndoSuggestionId === suggestion.suggestionId
                          ? `<div class="ai-tooltip">Undone locally</div>`
                          : ""
                      }
                      <div class="todo-drawer-ai-card__actions ai-actions">
                        ${
                          confirmOpen
                            ? `
                              <div class="ai-confirm">
                                <button
                                  type="button"
                                  class="ai-action-btn"
                                  data-testid="task-drawer-ai-confirm-${escapeHtml(suggestion.suggestionId)}"
                                  data-drawer-ai-action="confirm-apply"
                                  data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                                  aria-label="Confirm apply ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  class="ai-action-btn"
                                  data-testid="task-drawer-ai-cancel-${escapeHtml(suggestion.suggestionId)}"
                                  data-drawer-ai-action="cancel-confirm"
                                  data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                                  aria-label="Cancel confirmation"
                                >
                                  Cancel
                                </button>
                              </div>
                            `
                            : `
                              <button
                                type="button"
                                class="ai-action-btn"
                                data-testid="task-drawer-ai-apply-${escapeHtml(suggestion.suggestionId)}"
                                data-drawer-ai-action="apply"
                                data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                                aria-label="Apply ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                                ${applying ? "disabled" : ""}
                              >
                                ${applying ? "Applying..." : "Apply"}
                              </button>
                            `
                        }
                        <button
                          type="button"
                          class="ai-action-btn"
                          data-testid="task-drawer-ai-dismiss-${escapeHtml(suggestion.suggestionId)}"
                          data-drawer-ai-action="dismiss"
                          data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                          aria-label="Dismiss ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                        >
                          Dismiss
                        </button>
                        ${
                          state.undoBySuggestionId[suggestion.suggestionId]
                            ? `
                              <button
                                type="button"
                                class="ai-undo"
                                data-testid="task-drawer-ai-undo-${escapeHtml(suggestion.suggestionId)}"
                                data-drawer-ai-action="undo"
                                data-drawer-ai-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                                aria-label="Undo ${escapeHtml(getTaskDrawerSuggestionLabel(suggestion.type))}"
                              >
                                Undo
                              </button>
                            `
                            : ""
                        }
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;

  window.requestAnimationFrame(() => {
    const confirmButton = document.querySelector(
      `[data-drawer-ai-action="confirm-apply"][data-drawer-ai-suggestion-id="${escapeSelectorValue(
        state.confirmSuggestionId || "",
      )}"]`,
    );
    if (confirmButton instanceof HTMLElement) {
      confirmButton.focus({ preventScroll: true });
    }
  });

  return base;
}

function confidenceLabelForSuggestion(confidence) {
  return confidenceLabel(confidence);
}

function getTodoDrawerElements() {
  const drawer = document.getElementById("todoDetailsDrawer");
  const closeBtn = document.getElementById("todoDrawerClose");
  const titleEl = document.getElementById("todoDrawerTitle");
  const contentEl = drawer?.querySelector(".todo-drawer__content");
  const backdrop = document.getElementById("todoDrawerBackdrop");
  if (!(drawer instanceof HTMLElement)) return null;
  if (!(closeBtn instanceof HTMLElement)) return null;
  if (!(titleEl instanceof HTMLElement)) return null;
  if (!(contentEl instanceof HTMLElement)) return null;
  return { drawer, closeBtn, titleEl, contentEl, backdrop };
}

function getTodoById(todoId) {
  return todos.find((todo) => todo.id === todoId) || null;
}

function initializeDrawerDraft(todo) {
  drawerDraft = {
    id: todo.id,
    title: String(todo.title || ""),
    completed: !!todo.completed,
    dueDate: toDateInputValue(todo.dueDate),
    project: String(todo.category || ""),
    priority: String(todo.priority || "medium"),
    description: String(todo.description || ""),
    notes: String(todo.notes || ""),
    categoryDetail: String(todo.category || ""),
  };
}

function getCurrentDrawerDraft(todo) {
  if (!todo) return null;
  if (!drawerDraft || drawerDraft.id !== todo.id) {
    initializeDrawerDraft(todo);
  }
  return drawerDraft;
}

function setDrawerSaveState(state, message = "") {
  if (drawerSaveResetTimer) {
    clearTimeout(drawerSaveResetTimer);
    drawerSaveResetTimer = null;
  }

  drawerSaveState = state;
  drawerSaveMessage = message;
  const statusEl = document.getElementById("drawerSaveStatus");
  if (!(statusEl instanceof HTMLElement)) return;

  const textByState = {
    idle: "Ready",
    saving: "Saving...",
    saved: "Saved",
    error: message || "Save failed",
  };
  statusEl.textContent = textByState[state] || textByState.idle;
  statusEl.setAttribute("data-state", state);

  if (state === "saved") {
    drawerSaveResetTimer = setTimeout(() => {
      if (drawerSaveState === "saved") {
        setDrawerSaveState("idle");
      }
    }, 1200);
  }
}

function captureDrawerFocusState() {
  const refs = getTodoDrawerElements();
  if (!refs) return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!refs.drawer.contains(active)) return null;
  if (!active.id) return null;

  const state = { id: active.id, selectionStart: null, selectionEnd: null };
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  ) {
    state.selectionStart = active.selectionStart;
    state.selectionEnd = active.selectionEnd;
  }
  return state;
}

function restoreDrawerFocusState(focusState) {
  if (!focusState || !focusState.id) return;
  const target = document.getElementById(focusState.id);
  if (!(target instanceof HTMLElement)) return;

  target.focus({ preventScroll: true });
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    if (
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number"
    ) {
      target.setSelectionRange(
        focusState.selectionStart,
        focusState.selectionEnd,
      );
    }
  }
}

function isMobileDrawerViewport() {
  if (window.matchMedia) {
    return window.matchMedia(MOBILE_DRAWER_MEDIA_QUERY).matches;
  }
  return window.innerWidth <= 768;
}

function lockBodyScrollForDrawer() {
  if (isDrawerBodyLocked || !isMobileDrawerViewport()) return;
  const body = document.body;
  drawerScrollLockY = window.scrollY || window.pageYOffset || 0;
  body.classList.add("is-drawer-open");
  body.style.position = "fixed";
  body.style.top = `-${drawerScrollLockY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  isDrawerBodyLocked = true;
}

function unlockBodyScrollForDrawer() {
  if (!isDrawerBodyLocked) return;
  const body = document.body;
  body.classList.remove("is-drawer-open");
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  window.scrollTo(0, drawerScrollLockY);
  isDrawerBodyLocked = false;
}

async function saveDrawerPatch(patch, { validateTitle = false } = {}) {
  if (!selectedTodoId || !drawerDraft) return;

  if (validateTitle) {
    const titleError = validateTodoTitle(drawerDraft.title);
    if (titleError) {
      setDrawerSaveState("error", titleError);
      return;
    }
  }

  const requestId = ++drawerSaveSequence;
  const focusState = captureDrawerFocusState();
  setDrawerSaveState("saving");

  try {
    const updatedTodo = await applyTodoPatch(selectedTodoId, patch);
    if (requestId !== drawerSaveSequence) {
      return;
    }
    initializeDrawerDraft(updatedTodo);
    setDrawerSaveState("saved");
    renderTodos();
    syncTodoDrawerStateWithRender();
    restoreDrawerFocusState(focusState);
  } catch (error) {
    if (requestId !== drawerSaveSequence) {
      return;
    }
    setDrawerSaveState("error", error.message || "Save failed");
  }
}

function updateDrawerDraftField(field, value) {
  if (!drawerDraft) return;
  drawerDraft[field] = value;
  if (drawerSaveState !== "saving") {
    setDrawerSaveState("idle");
  }
}

function onDrawerTitleInput(event) {
  const value = String(event?.target?.value || "");
  updateDrawerDraftField("title", value);
}

function onDrawerTitleBlur() {
  if (!drawerDraft) return;
  saveDrawerPatch({ title: drawerDraft.title.trim() }, { validateTitle: true });
}

function onDrawerTitleKeydown(event) {
  if (!event) return;
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  onDrawerTitleBlur();
}

function onDrawerCompletedChange(event) {
  const checked = !!event?.target?.checked;
  updateDrawerDraftField("completed", checked);
  saveDrawerPatch({ completed: checked });
}

function onDrawerDueDateChange(event) {
  const dueDate = String(event?.target?.value || "");
  updateDrawerDraftField("dueDate", dueDate);
  saveDrawerPatch({ dueDate: toIsoFromDateInput(dueDate) });
}

function onDrawerProjectChange(event) {
  const project = normalizeProjectPath(String(event?.target?.value || ""));
  updateDrawerDraftField("project", project || "");
  saveDrawerPatch({ category: project || null });
}

function onDrawerPriorityChange(event) {
  const priority = String(event?.target?.value || "medium");
  updateDrawerDraftField("priority", priority);
  saveDrawerPatch({ priority });
}

function onDrawerDescriptionInput(event) {
  const description = String(event?.target?.value || "");
  updateDrawerDraftField("description", description);
  if (drawerDescriptionSaveTimer) {
    clearTimeout(drawerDescriptionSaveTimer);
  }
  drawerDescriptionSaveTimer = setTimeout(() => {
    if (!drawerDraft) return;
    const nextDescription = String(drawerDraft.description || "").trim();
    saveDrawerPatch({ description: nextDescription || "" });
  }, 500);
}

function onDrawerDescriptionBlur() {
  if (!drawerDraft) return;
  if (drawerDescriptionSaveTimer) {
    clearTimeout(drawerDescriptionSaveTimer);
    drawerDescriptionSaveTimer = null;
  }
  const description = String(drawerDraft.description || "").trim();
  saveDrawerPatch({ description: description || "" });
}

function onDrawerDescriptionKeydown(event) {
  if (!event) return;
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  onDrawerDescriptionBlur();
}

function onDrawerNotesInput(event) {
  const notes = String(event?.target?.value || "");
  updateDrawerDraftField("notes", notes);
}

function onDrawerNotesBlur() {
  if (!drawerDraft) return;
  const notes = String(drawerDraft.notes || "").trim();
  saveDrawerPatch({ notes: notes || null });
}

function onDrawerNotesKeydown(event) {
  if (!event) return;
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  onDrawerNotesBlur();
}

function onDrawerCategoryInput(event) {
  const category = String(event?.target?.value || "");
  updateDrawerDraftField("categoryDetail", category);
}

function onDrawerCategoryBlur() {
  if (!drawerDraft) return;
  const normalized = normalizeProjectPath(
    String(drawerDraft.categoryDetail || ""),
  );
  updateDrawerDraftField("project", normalized || "");
  updateDrawerDraftField("categoryDetail", normalized || "");
  saveDrawerPatch({ category: normalized || null });
}

function renderDrawerSubtasks(todo) {
  if (!Array.isArray(todo.subtasks) || todo.subtasks.length === 0) {
    return '<p class="todo-drawer__subtasks-empty">No subtasks</p>';
  }

  return `
    <ul class="todo-drawer__subtasks-list">
      ${todo.subtasks
        .map((subtask) => {
          const title = escapeHtml(String(subtask?.title || ""));
          return `
            <li class="todo-drawer__subtasks-item ${subtask?.completed ? "completed" : ""}">
              <span aria-hidden="true">${subtask?.completed ? "✓" : "○"}</span>
              <span>${title}</span>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
  updateAiWorkspaceStatusChip();
}

function buildDrawerProjectOptions(selectedProject = "") {
  const projects = getAllProjects();
  return `<option value="">None</option>${projects
    .map((project) => renderProjectOptionEntry(project, selectedProject))
    .join("")}`;
}

function renderTodoDrawerContent() {
  const refs = getTodoDrawerElements();
  if (!refs) return;

  const { titleEl, contentEl } = refs;
  if (!selectedTodoId) {
    titleEl.textContent = "Task";
    contentEl.innerHTML = "";
    return;
  }

  const todo = getTodoById(selectedTodoId);
  if (!todo) {
    drawerDraft = null;
    titleEl.textContent = "Task";
    contentEl.innerHTML = `
      <div class="todo-drawer__section">
        <div class="todo-drawer__section-title">Unavailable</div>
        <p>This task is no longer available in the current view.</p>
      </div>
    `;
    return;
  }

  const draft = getCurrentDrawerDraft(todo);
  const detailsExpanded = isDrawerDetailsOpen;
  const detailsToggleLabel = detailsExpanded ? "Hide details" : "Show details";
  const detailsPanelHidden = detailsExpanded ? "" : "hidden";

  titleEl.textContent = "Task";
  contentEl.innerHTML = `
    <div class="todo-drawer__section">
      <div class="todo-drawer__section-title">Essentials</div>
      <div class="todo-drawer__save-status" id="drawerSaveStatus" data-state="${escapeHtml(drawerSaveState)}">Ready</div>
      <label class="todo-drawer__field" for="drawerTitleInput">
        <span>Title</span>
        <input
          id="drawerTitleInput"
          type="text"
          maxlength="200"
          value="${escapeHtml(draft.title)}"
        />
      </label>
      <label class="todo-drawer__field todo-drawer__field--inline" for="drawerCompletedToggle">
        <span>Completed</span>
        <input id="drawerCompletedToggle" type="checkbox" ${draft.completed ? "checked" : ""} />
      </label>
      <label class="todo-drawer__field" for="drawerDueDateInput">
        <span>Due date</span>
        <input id="drawerDueDateInput" type="date" value="${escapeHtml(draft.dueDate)}" />
      </label>
      <label class="todo-drawer__field" for="drawerProjectSelect">
        <span>Project</span>
        <select id="drawerProjectSelect">
          ${buildDrawerProjectOptions(draft.project)}
        </select>
      </label>
      <label class="todo-drawer__field" for="drawerPrioritySelect">
        <span>Priority</span>
        <select id="drawerPrioritySelect">
          <option value="low" ${draft.priority === "low" ? "selected" : ""}>Low</option>
          <option value="medium" ${draft.priority === "medium" ? "selected" : ""}>Medium</option>
          <option value="high" ${draft.priority === "high" ? "selected" : ""}>High</option>
        </select>
      </label>
    </div>
    ${renderTaskDrawerAssistSection(todo.id)}
    <div class="todo-drawer__section">
      <button
        id="drawerDetailsToggle"
        type="button"
        class="todo-drawer__accordion-toggle"
        aria-expanded="${detailsExpanded ? "true" : "false"}"
        aria-controls="drawerDetailsPanel"
      >
        <span>Details</span>
        <span class="todo-drawer__accordion-chevron" aria-hidden="true">${detailsExpanded ? "▾" : "▸"}</span>
      </button>
      <div
        id="drawerDetailsPanel"
        class="todo-drawer__accordion-panel ${detailsExpanded ? "todo-drawer__accordion-panel--open" : ""}"
        aria-hidden="${detailsExpanded ? "false" : "true"}"
        ${detailsPanelHidden}
      >
        <label class="todo-drawer__field" for="drawerDescriptionTextarea">
          <span>Description</span>
          <textarea id="drawerDescriptionTextarea" maxlength="1000">${escapeHtml(draft.description)}</textarea>
        </label>
        <label class="todo-drawer__field" for="drawerNotesTextarea">
          <span>Notes</span>
          <textarea id="drawerNotesTextarea" maxlength="2000">${escapeHtml(draft.notes)}</textarea>
        </label>
        <label class="todo-drawer__field" for="drawerCategoryInput">
          <span>Category</span>
          <input id="drawerCategoryInput" type="text" maxlength="50" value="${escapeHtml(draft.categoryDetail)}" />
        </label>
        <div class="todo-drawer__subtasks">
          <div class="todo-drawer__subtasks-title">Subtasks</div>
          ${renderDrawerSubtasks(todo)}
        </div>
      </div>
    </div>
    <div class="todo-drawer__section todo-drawer__section--danger">
      <div class="todo-drawer__section-title">Danger zone</div>
      <button id="drawerDeleteTodoButton" class="delete-btn todo-drawer__delete-btn" type="button">
        Delete task
      </button>
    </div>
  `;
  setDrawerSaveState(drawerSaveState, drawerSaveMessage);
}

async function fetchTaskDrawerLatestSuggestion(todoId) {
  const response = await apiCall(
    `${API_URL}/ai/suggestions/latest?todoId=${encodeURIComponent(todoId)}&surface=task_drawer`,
  );
  return response;
}

async function generateTaskDrawerSuggestion(todo) {
  return apiCall(`${API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: "task_drawer",
      todoId: todo.id,
      title: todo.title,
      description: todo.description || "",
      notes: todo.notes || "",
    }),
  });
}

async function loadTaskDrawerDecisionAssist(todoId, allowGenerate = true) {
  if (!isTodoDrawerOpen || selectedTodoId !== todoId) return;
  const todo = getTodoById(todoId);
  if (!todo) return;
  if (!FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    taskDrawerAssistState.unavailable = true;
    return;
  }

  if (taskDrawerAssistState.todoId !== todoId) {
    resetTaskDrawerAssistState(todoId);
  }
  taskDrawerAssistState.loading = true;
  taskDrawerAssistState.error = "";
  taskDrawerAssistState.unavailable = false;
  renderTodoDrawerContent();

  try {
    let latestResponse = await fetchTaskDrawerLatestSuggestion(todoId);
    if (latestResponse.status === 403 || latestResponse.status === 404) {
      taskDrawerAssistState.loading = false;
      taskDrawerAssistState.unavailable = true;
      renderTodoDrawerContent();
      return;
    }

    if (latestResponse.status === 204) {
      if (isTaskDrawerDismissed(todoId)) {
        taskDrawerAssistState.loading = false;
        taskDrawerAssistState.mustAbstain = true;
        renderTodoDrawerContent();
        return;
      }
      if (!allowGenerate) {
        taskDrawerAssistState.loading = false;
        taskDrawerAssistState.mustAbstain = true;
        renderTodoDrawerContent();
        return;
      }
      const generated = await generateTaskDrawerSuggestion(todo);
      if (generated.status === 403 || generated.status === 404) {
        taskDrawerAssistState.loading = false;
        taskDrawerAssistState.unavailable = true;
        renderTodoDrawerContent();
        return;
      }
      latestResponse = await fetchTaskDrawerLatestSuggestion(todoId);
    }

    if (!latestResponse.ok) {
      taskDrawerAssistState.loading = false;
      taskDrawerAssistState.error = "Could not load suggestions.";
      renderTodoDrawerContent();
      return;
    }

    const payload = await latestResponse.json();
    if (!isTodoDrawerOpen || selectedTodoId !== todoId) return;
    const envelope = payload?.outputEnvelope || {};
    taskDrawerAssistState.loading = false;
    taskDrawerAssistState.aiSuggestionId = String(
      payload?.aiSuggestionId || "",
    );
    taskDrawerAssistState.mustAbstain = !!envelope.must_abstain;
    taskDrawerAssistState.contractVersion = envelope.contractVersion;
    taskDrawerAssistState.requestId = envelope.requestId;
    taskDrawerAssistState.generatedAt = envelope.generatedAt;
    taskDrawerAssistState.suggestions = normalizeTaskDrawerAssistEnvelope(
      taskDrawerAssistState.aiSuggestionId,
      envelope,
      todoId,
    );
    taskDrawerAssistState.confirmSuggestionId = "";
    taskDrawerAssistState.applyingSuggestionId = "";
    renderTodoDrawerContent();
  } catch (error) {
    console.error("Task drawer AI load failed:", error);
    taskDrawerAssistState.loading = false;
    taskDrawerAssistState.error = "Could not load suggestions.";
    renderTodoDrawerContent();
  }
}

async function applyTaskDrawerSuggestion(suggestionId, confirmed = false) {
  if (!selectedTodoId) return;
  const suggestion = taskDrawerAssistState.suggestions.find(
    (item) => item.suggestionId === suggestionId,
  );
  if (!suggestion || !taskDrawerAssistState.aiSuggestionId) return;

  if (needsConfirmation(suggestion) && !confirmed) {
    taskDrawerAssistState.confirmSuggestionId = suggestionId;
    renderTodoDrawerContent();
    return;
  }

  const snapshotTodo = getTodoById(selectedTodoId);
  if (snapshotTodo) {
    taskDrawerAssistState.undoBySuggestionId[suggestionId] = JSON.parse(
      JSON.stringify(snapshotTodo),
    );
  }

  taskDrawerAssistState.applyingSuggestionId = suggestionId;
  taskDrawerAssistState.confirmSuggestionId = "";
  renderTodoDrawerContent();

  try {
    const response = await apiCall(
      `${API_URL}/ai/suggestions/${encodeURIComponent(taskDrawerAssistState.aiSuggestionId)}/apply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId,
          confirmed: confirmed === true,
        }),
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      taskDrawerAssistState.error =
        typeof data?.error === "string"
          ? data.error
          : "Could not apply suggestion.";
      taskDrawerAssistState.applyingSuggestionId = "";
      renderTodoDrawerContent();
      return;
    }

    const result = await response.json();
    if (result?.todo?.id) {
      const index = todos.findIndex((item) => item.id === result.todo.id);
      if (index >= 0) {
        todos[index] = result.todo;
      }
    } else {
      await loadTodos();
    }
    clearTaskDrawerDismissed(selectedTodoId);
    taskDrawerAssistState.lastUndoSuggestionId = "";
    await loadTaskDrawerDecisionAssist(selectedTodoId, false);
    renderTodos();
  } catch (error) {
    console.error("Task drawer AI apply failed:", error);
    taskDrawerAssistState.error = "Could not apply suggestion.";
    taskDrawerAssistState.applyingSuggestionId = "";
    renderTodoDrawerContent();
  }
}

async function dismissTaskDrawerSuggestions(suggestionId) {
  if (!taskDrawerAssistState.aiSuggestionId) return;
  try {
    await apiCall(
      `${API_URL}/ai/suggestions/${encodeURIComponent(taskDrawerAssistState.aiSuggestionId)}/dismiss`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, dismissAll: true }),
      },
    );
  } catch (error) {
    console.error("Task drawer AI dismiss failed:", error);
  }
  taskDrawerAssistState.suggestions = [];
  taskDrawerAssistState.mustAbstain = true;
  taskDrawerAssistState.confirmSuggestionId = "";
  taskDrawerAssistState.applyingSuggestionId = "";
  if (selectedTodoId) {
    markTaskDrawerDismissed(selectedTodoId);
  }
  renderTodoDrawerContent();
}

function undoTaskDrawerSuggestion(suggestionId) {
  const snapshot = taskDrawerAssistState.undoBySuggestionId[suggestionId];
  if (!snapshot || !selectedTodoId) return;
  const index = todos.findIndex((item) => item.id === selectedTodoId);
  if (index < 0) return;
  todos[index] = snapshot;
  initializeDrawerDraft(todos[index]);
  delete taskDrawerAssistState.undoBySuggestionId[suggestionId];
  taskDrawerAssistState.lastUndoSuggestionId = suggestionId;
  emitAiSuggestionUndoTelemetry({
    surface: "task_drawer",
    aiSuggestionDbId: taskDrawerAssistState.aiSuggestionId,
    suggestionId,
    todoId: selectedTodoId,
    selectedTodoIdsCount: 1,
  });
  renderTodos();
  syncTodoDrawerStateWithRender();
}

function openTodoDrawer(todoId, triggerEl) {
  const refs = getTodoDrawerElements();
  if (!refs) return;
  const todo = getTodoById(todoId);
  if (!todo) return;

  if (isRailSheetOpen) {
    closeProjectsRailSheet({ restoreFocus: false });
  }

  selectedTodoId = todoId;
  initializeDrawerDraft(todo);
  resetTaskDrawerAssistState(todoId);
  isDrawerDetailsOpen = false;
  openTodoKebabId = null;
  drawerSaveSequence = 0;
  setDrawerSaveState("idle");
  lastFocusedTodoTrigger = triggerEl instanceof HTMLElement ? triggerEl : null;
  lastFocusedTodoId =
    triggerEl instanceof HTMLElement
      ? triggerEl.dataset.todoId || todoId
      : todoId;
  isTodoDrawerOpen = true;

  const { drawer, backdrop } = refs;
  drawer.classList.add("todo-drawer--open");
  drawer.setAttribute("aria-hidden", "false");
  if (backdrop instanceof HTMLElement) {
    backdrop.classList.add("todo-drawer-backdrop--open");
    backdrop.setAttribute("aria-hidden", "false");
  }
  lockBodyScrollForDrawer();

  renderTodos();
  const titleInput = document.getElementById("drawerTitleInput");
  if (titleInput instanceof HTMLElement) {
    titleInput.focus();
  } else {
    refs.closeBtn.focus();
  }
  if (AI_DEBUG_ENABLED) {
    loadTaskDrawerDecisionAssist(todoId);
  }
}

function closeTodoDrawer({ restoreFocus = true } = {}) {
  const refs = getTodoDrawerElements();
  const focusTrigger = lastFocusedTodoTrigger;
  const focusTodoId = lastFocusedTodoId;

  isTodoDrawerOpen = false;
  selectedTodoId = null;
  isDrawerDetailsOpen = false;
  drawerDraft = null;
  resetTaskDrawerAssistState();
  drawerSaveSequence = 0;
  if (drawerSaveResetTimer) {
    clearTimeout(drawerSaveResetTimer);
    drawerSaveResetTimer = null;
  }
  if (drawerDescriptionSaveTimer) {
    clearTimeout(drawerDescriptionSaveTimer);
    drawerDescriptionSaveTimer = null;
  }
  setDrawerSaveState("idle");

  if (refs) {
    const { drawer, backdrop } = refs;
    drawer.classList.remove("todo-drawer--open");
    drawer.setAttribute("aria-hidden", "true");
    if (backdrop instanceof HTMLElement) {
      backdrop.classList.remove("todo-drawer-backdrop--open");
      backdrop.setAttribute("aria-hidden", "true");
    }
    renderTodoDrawerContent();
  }
  renderTodos();
  unlockBodyScrollForDrawer();

  lastFocusedTodoTrigger = null;
  lastFocusedTodoId = null;

  if (!restoreFocus) return;

  const focusFallbackRow = () => {
    if (!focusTodoId) return false;
    const fallback = document.querySelector(
      `.todo-item[data-todo-id="${escapeSelectorValue(focusTodoId)}"]`,
    );
    if (!(fallback instanceof HTMLElement)) return false;
    fallback.focus({ preventScroll: true });
    return true;
  };

  window.requestAnimationFrame(() => {
    if (focusTrigger instanceof HTMLElement && focusTrigger.isConnected) {
      focusTrigger.focus({ preventScroll: true });
      if (document.activeElement === focusTrigger) {
        return;
      }
    }
    focusFallbackRow();
  });
}

function syncTodoDrawerStateWithRender() {
  const refs = getTodoDrawerElements();
  if (!refs) return;

  if (!isTodoDrawerOpen || !selectedTodoId) {
    refs.drawer.classList.remove("todo-drawer--open");
    refs.drawer.setAttribute("aria-hidden", "true");
    if (refs.backdrop instanceof HTMLElement) {
      refs.backdrop.classList.remove("todo-drawer-backdrop--open");
      refs.backdrop.setAttribute("aria-hidden", "true");
    }
    return;
  }

  refs.drawer.classList.add("todo-drawer--open");
  refs.drawer.setAttribute("aria-hidden", "false");
  if (refs.backdrop instanceof HTMLElement) {
    refs.backdrop.classList.add("todo-drawer-backdrop--open");
    refs.backdrop.setAttribute("aria-hidden", "false");
  }
  renderTodoDrawerContent();
}

function toggleDrawerDetailsPanel() {
  if (!isTodoDrawerOpen || !selectedTodoId) return;
  isDrawerDetailsOpen = !isDrawerDetailsOpen;
  renderTodoDrawerContent();
}

async function deleteTodoFromDrawer() {
  if (!selectedTodoId) return;
  const deletedTodoId = selectedTodoId;
  const deleted = await deleteTodo(deletedTodoId);
  if (!deleted) return;

  closeTodoDrawer({ restoreFocus: false });
  window.requestAnimationFrame(() => {
    const nextRow = document.querySelector(".todo-item");
    if (nextRow instanceof HTMLElement) {
      nextRow.focus();
      return;
    }
    const listContainer = document.getElementById("todosContent");
    if (listContainer instanceof HTMLElement) {
      if (!listContainer.hasAttribute("tabindex")) {
        listContainer.setAttribute("tabindex", "-1");
      }
      listContainer.focus();
    }
  });
}

function escapeSelectorValue(value) {
  const raw = String(value);
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(raw);
  }
  return raw.replace(/["\\]/g, "\\$&");
}

function getKebabTriggerForTodo(todoId) {
  const selector = `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"] .todo-kebab`;
  const trigger = document.querySelector(selector);
  return trigger instanceof HTMLElement ? trigger : null;
}

function closeTodoKebabMenu({ restoreFocus = false } = {}) {
  const activeTodoId = openTodoKebabId;
  openTodoKebabId = null;
  renderTodos();

  if (!restoreFocus || !activeTodoId) return;
  window.requestAnimationFrame(() => {
    const trigger = getKebabTriggerForTodo(activeTodoId);
    trigger?.focus();
  });
}

function toggleTodoKebab(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();

  const shouldOpen = openTodoKebabId !== todoId;
  openTodoKebabId = shouldOpen ? todoId : null;
  renderTodos();

  if (!shouldOpen) return;
  window.requestAnimationFrame(() => {
    const firstAction = document.querySelector(
      `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"] .todo-kebab-menu .todo-kebab-item`,
    );
    if (firstAction instanceof HTMLElement) {
      firstAction.focus();
    }
  });
}

function openTodoFromKebab(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  openTodoKebabId = null;
  const row = document.querySelector(
    `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"]`,
  );
  openTodoDrawer(todoId, row instanceof HTMLElement ? row : null);
}

function openEditTodoFromKebab(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  openTodoKebabId = null;
  renderTodos();
  openEditTodoModal(todoId);
}

function openDrawerDangerZone(todoId, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  openTodoKebabId = null;
  const row = document.querySelector(
    `.todo-item[data-todo-id="${escapeSelectorValue(todoId)}"]`,
  );
  if (!isTodoDrawerOpen || selectedTodoId !== todoId) {
    openTodoDrawer(todoId, row instanceof HTMLElement ? row : null);
  }
  isDrawerDetailsOpen = true;
  renderTodoDrawerContent();
  window.requestAnimationFrame(() => {
    const deleteBtn = document.getElementById("drawerDeleteTodoButton");
    if (deleteBtn instanceof HTMLElement) {
      deleteBtn.focus();
      return;
    }
    const detailsToggle = document.getElementById("drawerDetailsToggle");
    if (detailsToggle instanceof HTMLElement) {
      detailsToggle.focus();
    }
  });
}

function renderTodoChips(todo, { isOverdue, dueDateStr }) {
  const chips = [];

  if (todo.dueDate) {
    const dueLabel = `${isOverdue ? "⚠️" : "📅"} ${dueDateStr}`;
    chips.push(
      `<span class="todo-chip todo-chip--due ${isOverdue ? "todo-chip--due-overdue" : ""}" title="${escapeHtml(dueLabel)}">${escapeHtml(dueLabel)}</span>`,
    );
  }

  if (todo.category) {
    chips.push(
      `<span class="todo-chip todo-chip--project" title="${escapeHtml(todo.category)}">🏷️ ${escapeHtml(todo.category)}</span>`,
    );
  }

  if (todo.priority === "high" && chips.length < 2) {
    chips.push(
      `<span class="todo-chip todo-chip--priority priority-badge high" title="High priority">HIGH</span>`,
    );
  }

  return chips.slice(0, 2).join("");
}

// Render todos
function renderTodos() {
  const container = document.getElementById("todosContent");
  if (!container) return;

  renderProjectsRail();
  renderTodayPlanPanel();
  const scrollRegion = document.getElementById("todosScrollRegion");

  if (todosLoadState !== "loading" && todos.length > 0) {
    todosLoadState = "ready";
    todosLoadErrorMessage = "";
  }

  if (todosLoadState === "loading") {
    updateHeaderFromVisibleTodos([]);
    const skeletonRows = Array.from({ length: 6 })
      .map(
        () => `
          <li class="todo-item todo-skeleton-row" aria-hidden="true">
            <span class="skeleton-block skeleton-block--checkbox"></span>
            <span class="skeleton-block skeleton-block--drag"></span>
            <span class="skeleton-block skeleton-block--checkbox"></span>
            <div class="todo-content">
              <span class="skeleton-line"></span>
              <span class="skeleton-line skeleton-line--short"></span>
              <div class="todo-meta">
                <span class="skeleton-chip"></span>
                <span class="skeleton-chip"></span>
                <span class="skeleton-chip"></span>
              </div>
            </div>
            <div class="todo-row-actions">
              <span class="skeleton-block skeleton-block--kebab"></span>
            </div>
          </li>
        `,
      )
      .join("");

    container.innerHTML = `
      <div id="todosLoadingState" class="todo-list-state todo-list-state--loading" role="status" aria-live="polite">
        <p>Loading tasks...</p>
      </div>
      <ul class="todos-list todos-list--skeleton">
        ${skeletonRows}
      </ul>
    `;
    syncTodoDrawerStateWithRender();
    updateBulkActionsVisibility();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (todosLoadState === "error" && todos.length === 0) {
    updateHeaderFromVisibleTodos([]);
    isTodoDrawerOpen = false;
    selectedTodoId = null;
    openTodoKebabId = null;
    container.innerHTML = `
      <div id="todosErrorState" class="todo-list-state todo-list-state--error" role="status" aria-live="polite">
        <div class="empty-state-icon">⚠️</div>
        <h3>Couldn't load tasks</h3>
        <p>${escapeHtml(todosLoadErrorMessage || "Please check your connection and try again.")}</p>
        <button id="todosRetryLoadButton" class="mini-btn" data-onclick="retryLoadTodos()">Retry</button>
      </div>
    `;
    syncTodoDrawerStateWithRender();
    updateBulkActionsVisibility();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  if (todos.length === 0) {
    updateHeaderFromVisibleTodos([]);
    isTodoDrawerOpen = false;
    selectedTodoId = null;
    openTodoKebabId = null;
    container.innerHTML = `
                    <div id="todosEmptyState" class="empty-state">
                        <div class="empty-state-icon">✨</div>
                        <h3>No tasks yet</h3>
                        <p>Add your first task to get started with a calm, focused list.</p>
                        <p class="empty-state-hint">Tip: press Ctrl/Cmd + N to create a task.</p>
                    </div>
                `;
    syncTodoDrawerStateWithRender();
    updateBulkActionsVisibility();
    updateIcsExportButtonState();
    assertNoHorizontalOverflow(scrollRegion);
    return;
  }

  const filteredTodos = getVisibleTodos();
  updateHeaderFromVisibleTodos(filteredTodos);
  if (
    openTodoKebabId &&
    !filteredTodos.some((todo) => String(todo.id) === String(openTodoKebabId))
  ) {
    openTodoKebabId = null;
  }
  const categorizedTodos = [...filteredTodos].sort((a, b) => {
    const categoryA = String(a.category || "Uncategorized");
    const categoryB = String(b.category || "Uncategorized");
    const categoryCompare = categoryA.localeCompare(categoryB);
    if (categoryCompare !== 0) return categoryCompare;
    return (a.order || 0) - (b.order || 0);
  });
  const categoryStats = new Map();
  for (const todo of categorizedTodos) {
    const key = String(todo.category || "Uncategorized");
    const stats = categoryStats.get(key) || { total: 0, done: 0 };
    stats.total += 1;
    if (todo.completed) {
      stats.done += 1;
    }
    categoryStats.set(key, stats);
  }

  let activeCategory = "";
  const rows = categorizedTodos
    .map((todo, index) => {
      const categoryLabel = String(todo.category || "Uncategorized");
      const categoryChanged = categoryLabel !== activeCategory;
      if (categoryChanged) {
        activeCategory = categoryLabel;
      }
      const stats = categoryStats.get(categoryLabel) || { total: 0, done: 0 };
      const categoryHeader = categoryChanged
        ? `
          <li class="todo-group-header">
            <span>📁 ${escapeHtml(categoryLabel)}</span>
            <span>${stats.done}/${stats.total} done</span>
          </li>
        `
        : "";

      const isOverdue =
        todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date();
      const dueDateStr = todo.dueDate
        ? new Date(todo.dueDate).toLocaleString()
        : "";
      const isSelected = selectedTodos.has(todo.id);
      const hasSubtasks = !!(todo.subtasks && todo.subtasks.length > 0);

      return `
        ${categoryHeader}
        <li class="todo-item ${todo.completed ? "completed" : ""} ${selectedTodoId === todo.id ? "todo-item--active" : ""}"
            draggable="true"
            data-todo-id="${todo.id}"
            tabindex="0"
            data-ondragstart="handleDragStart(event)"
            data-ondragover="handleDragOver(event)"
            data-ondrop="handleDrop(event)"
            data-ondragend="handleDragEnd(event)">
            <input
                type="checkbox"
                class="bulk-checkbox"
                aria-label="Select todo ${escapeHtml(todo.title)}"
                ${isSelected ? "checked" : ""}
                data-onchange="toggleSelectTodo('${todo.id}')"
                data-onclick="event.stopPropagation()"
            >
            <span class="drag-handle">⋮⋮</span>
            <input
                type="checkbox"
                class="todo-checkbox"
                aria-label="Mark todo ${escapeHtml(todo.title)} complete"
                ${todo.completed ? "checked" : ""}
                data-onchange="toggleTodo('${todo.id}')"
            >
            <div class="todo-content">
                <div class="todo-title" title="${escapeHtml(todo.title)}">${escapeHtml(todo.title)}</div>
                ${todo.description ? `<div class="todo-description">${escapeHtml(todo.description)}</div>` : ""}
                <div class="todo-meta">
                    ${renderTodoChips(todo, { isOverdue, dueDateStr })}
                </div>
                ${hasSubtasks ? renderSubtasks(todo) : ""}
                ${
                  todo.notes && todo.notes.trim()
                    ? `
                    <div class="notes-section">
                        <button class="notes-toggle" data-onclick="toggleNotes('${todo.id}', event)">
                            <span class="expand-icon" id="notes-icon-${todo.id}">▶</span>
                            <span>📝 Notes</span>
                        </button>
                        <div class="notes-content" id="notes-content-${todo.id}" style="display: none;">
                            ${escapeHtml(String(todo.notes))}
                        </div>
                    </div>
                `
                    : ""
                }
            </div>
            <div class="todo-row-actions">
              <button
                type="button"
                class="todo-kebab"
                aria-label="More actions for ${escapeHtml(todo.title)}"
                aria-expanded="${openTodoKebabId === todo.id ? "true" : "false"}"
                data-onclick="toggleTodoKebab('${todo.id}', event)"
              >
                ⋯
              </button>
              <div
                class="todo-kebab-menu ${openTodoKebabId === todo.id ? "todo-kebab-menu--open" : ""}"
                role="menu"
                aria-label="Actions for ${escapeHtml(todo.title)}"
              >
                <button type="button" class="todo-kebab-item" role="menuitem" data-onclick="openTodoFromKebab('${todo.id}', event)">
                  Open details
                </button>
                <button type="button" class="todo-kebab-item" role="menuitem" data-onclick="openEditTodoFromKebab('${todo.id}', event)">
                  Edit modal
                </button>
                <label class="todo-kebab-project-label">
                  Move to project
                  <select data-onclick="event.stopPropagation()" data-onchange="moveTodoToProject('${todo.id}', this.value)">
                    ${renderProjectOptions(String(todo.category || ""))}
                  </select>
                </label>
                <button
                  type="button"
                  class="todo-kebab-item"
                  role="menuitem"
                  ${hasSubtasks ? "disabled" : ""}
                  data-onclick="aiBreakdownTodo('${todo.id}')"
                >
                  ${hasSubtasks ? "AI Subtasks Generated" : "AI Break Down Into Subtasks"}
                </button>
                <button type="button" class="todo-kebab-item todo-kebab-item--danger" role="menuitem" data-onclick="openDrawerDangerZone('${todo.id}', event)">
                  Delete
                </button>
              </div>
            </div>
        </li>
      `;
    })
    .join("");

  container.innerHTML = `
                <ul class="todos-list">
                    ${rows}
                </ul>
            `;

  if (selectedTodoId && !getTodoById(selectedTodoId)) {
    isTodoDrawerOpen = false;
    selectedTodoId = null;
  }
  syncTodoDrawerStateWithRender();
  updateBulkActionsVisibility();
  updateIcsExportButtonState();
  assertNoHorizontalOverflow(scrollRegion);
}

// ========== AI UI HELPERS ==========
// isKnownSuggestionType … renderAiDebugSuggestionId — from aiSuggestionUtils.js

function createInitialOnCreateAssistState() {
  return {
    titleBasis: "",
    envelope: null,
    suggestions: [],
    showAll: false,
    aiSuggestionId: "",
    liveTodoId: "",
    loading: false,
    error: "",
    unavailable: false,
    mode: "mock",
    dismissedTodoIds: new Set(),
    // lint-first: show chip only; reveal full row when user clicks Fix/Review
    showFullAssist: false,
    lintIssue: null,
  };
}

function resetOnCreateAssistState() {
  const dismissedTodoIds = onCreateAssistState?.dismissedTodoIds || new Set();
  onCreateAssistState = createInitialOnCreateAssistState();
  onCreateAssistState.dismissedTodoIds = dismissedTodoIds;
}

function loadOnCreateDismissedTodoIds() {
  try {
    const raw = window.localStorage.getItem(AI_ON_CREATE_DISMISSED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.map((value) => String(value || "").trim()).filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function persistOnCreateDismissedTodoIds() {
  try {
    const values = Array.from(
      onCreateAssistState.dismissedTodoIds || new Set(),
    );
    window.localStorage.setItem(
      AI_ON_CREATE_DISMISSED_STORAGE_KEY,
      JSON.stringify(values),
    );
  } catch {
    // Ignore storage failures.
  }
}

function markOnCreateDismissed(todoId) {
  if (!todoId) return;
  onCreateAssistState.dismissedTodoIds.add(String(todoId));
  persistOnCreateDismissedTodoIds();
}

function clearOnCreateDismissed(todoId) {
  if (!todoId) return;
  onCreateAssistState.dismissedTodoIds.delete(String(todoId));
  persistOnCreateDismissedTodoIds();
}

function isOnCreateDismissed(todoId) {
  if (!todoId) return false;
  return onCreateAssistState.dismissedTodoIds.has(String(todoId));
}

function getOnCreateImpactRank(type) {
  return impactRankForSurface(ON_CREATE_SURFACE, type);
}

function getOnCreateConfidenceBadge(confidence) {
  return confidenceLabel(confidence);
}

function clampOnCreateRationale(value) {
  return truncateRationale(value, 120);
}

function formatOnCreateSuggestionLabel(type) {
  return labelForType(type);
}

function formatOnCreateChoiceValue(choice) {
  if (typeof choice === "string") {
    return { value: choice, label: choice };
  }
  const value = String(
    choice?.value ||
      choice?.projectName ||
      choice?.category ||
      choice?.label ||
      "",
  ).trim();
  const label = String(choice?.label || value).trim();
  if (!value) return null;
  return {
    value,
    label,
    projectName: choice?.projectName,
    category: choice?.category,
  };
}

function normalizeOnCreateSuggestion(rawSuggestion) {
  if (!rawSuggestion || typeof rawSuggestion !== "object") return null;
  const type = String(rawSuggestion.type || "");
  if (!isKnownSuggestionType(type)) return null;
  if (!shouldRenderTypeForSurface(ON_CREATE_SURFACE, type)) return null;
  const suggestionId = String(rawSuggestion.suggestionId || "").trim();
  if (!suggestionId) return null;
  const payload =
    rawSuggestion.payload && typeof rawSuggestion.payload === "object"
      ? rawSuggestion.payload
      : {};
  const normalized = {
    type,
    suggestionId,
    confidence: Math.max(0, Math.min(1, Number(rawSuggestion.confidence) || 0)),
    rationale: clampOnCreateRationale(rawSuggestion.rationale),
    payload,
    requiresConfirmation: !!rawSuggestion.requiresConfirmation,
    dismissed: false,
    applied: false,
    confirmationOpen: false,
    undoSnapshot: null,
    clarificationExpanded: false,
    clarificationAnswered: false,
    clarificationAnswer: "",
    helperText: "",
  };
  if (type === "ask_clarification") {
    const choicesRaw = Array.isArray(payload.choices) ? payload.choices : [];
    normalized.payload = {
      ...payload,
      question: String(payload.question || "Pick one option").slice(0, 120),
      choices: choicesRaw
        .map((choice) => formatOnCreateChoiceValue(choice))
        .filter(Boolean)
        .slice(0, 4),
    };
  }
  return normalized;
}

function buildOnCreateSuggestion(
  type,
  suggestionId,
  confidence,
  rationale,
  payload,
  options = {},
) {
  return {
    type,
    suggestionId,
    confidence,
    rationale,
    payload,
    ...(options.requiresConfirmation ? { requiresConfirmation: true } : {}),
  };
}

function nextWeekdayAtNoonIso(day) {
  const target = new Date();
  const currentDay = target.getDay();
  let delta = (day - currentDay + 7) % 7;
  if (delta === 0) delta = 7;
  target.setDate(target.getDate() + delta);
  target.setHours(12, 0, 0, 0);
  return target.toISOString();
}

function yesterdayAtNoonIso() {
  const target = new Date();
  target.setDate(target.getDate() - 1);
  target.setHours(12, 0, 0, 0);
  return target.toISOString();
}

function buildMockOnCreateAssistEnvelope(rawTitle) {
  const title = String(rawTitle || "").trim();
  const titleLower = title.toLowerCase();
  const suggestions = [];

  if (titleLower.includes("tomorrow")) {
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(12, 0, 0, 0);
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-tomorrow",
        0.88,
        "Detected a relative deadline in the title.",
        { dueDateISO: due.toISOString() },
      ),
    );
  } else if (titleLower.includes("by friday")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-friday",
        0.82,
        '"By Friday" implies a firm due date.',
        { dueDateISO: nextWeekdayAtNoonIso(5) },
      ),
    );
  }

  if (titleLower.includes("yesterday")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_due_date",
        "oc-set-due-past",
        0.51,
        "Parsed a past date mention. Confirm before applying.",
        { dueDateISO: yesterdayAtNoonIso() },
        { requiresConfirmation: true },
      ),
    );
  }

  if (/\burgent\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_priority",
        "oc-set-priority-urgent",
        0.9,
        "“Urgent” strongly signals high priority.",
        { priority: "high" },
      ),
    );
  } else if (/\basap\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_priority",
        "oc-set-priority-asap",
        0.67,
        "ASAP often maps to high priority. Confirm escalation.",
        { priority: "high" },
        { requiresConfirmation: true },
      ),
    );
  }

  const mentionsWebsite = titleLower.includes("website");
  const mentionsMarketing = titleLower.includes("marketing");
  if (mentionsWebsite && mentionsMarketing) {
    suggestions.push(
      buildOnCreateSuggestion(
        "ask_clarification",
        "oc-clarify-project",
        0.6,
        "Project target is ambiguous between website and marketing.",
        {
          questionId: "oc-project-choice",
          question: "Which project should this task belong to?",
          choices: [
            { value: "Website", label: "Website", projectName: "Website" },
            { value: "Marketing", label: "Marketing", category: "Marketing" },
          ],
        },
      ),
    );
  } else if (mentionsWebsite) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_project",
        "oc-set-project-website",
        0.84,
        "Detected a known project keyword.",
        { projectName: "Website", category: "Website" },
      ),
    );
  } else if (mentionsMarketing) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_category",
        "oc-set-category-marketing",
        0.8,
        "Detected a category keyword.",
        { category: "Marketing" },
      ),
    );
  }

  if (titleLower.includes("personal")) {
    suggestions.push(
      buildOnCreateSuggestion(
        "set_category",
        "oc-set-category-personal",
        0.73,
        "“Personal” maps cleanly to a category.",
        { category: "Personal" },
      ),
    );
  }

  if (/\b(email|follow up|stuff)\b/.test(titleLower)) {
    suggestions.push(
      buildOnCreateSuggestion(
        "rewrite_title",
        "oc-rewrite-vague",
        0.77,
        "Title is vague; propose a concrete next-action title.",
        { title: "Email stakeholder with specific next step and deadline" },
      ),
    );
  }

  if (titleLower.includes("unknown")) {
    suggestions.push({
      type: "not_supported",
      suggestionId: "oc-unknown-type",
      confidence: 0.5,
      rationale: "Should be ignored by UI.",
      payload: {},
    });
  }

  return {
    contractVersion: 1,
    generatedAt: new Date().toISOString(),
    surface: ON_CREATE_SURFACE,
    requestId: `on-create-${encodeURIComponent(titleLower.slice(0, 24) || "empty")}`,
    must_abstain: false,
    suggestions,
  };
}

function getOnCreateAssistElements() {
  const row = document.getElementById("aiOnCreateAssistRow");
  const titleInput = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  if (!(row instanceof HTMLElement)) return null;
  if (!(titleInput instanceof HTMLInputElement)) return null;
  return { row, titleInput, projectSelect, dueDateInput };
}

function ensureOnCreateProjectOption(projectName) {
  const refs = getOnCreateAssistElements();
  if (!refs || !(refs.projectSelect instanceof HTMLSelectElement)) return;
  const normalized = normalizeProjectPath(projectName);
  if (!normalized) return;
  const hasOption = Array.from(refs.projectSelect.options).some(
    (option) => normalizeProjectPath(option.value) === normalized,
  );
  if (hasOption) return;
  const option = document.createElement("option");
  option.value = normalized;
  option.textContent = normalized;
  refs.projectSelect.append(option);
}

function normalizeOnCreateAssistEnvelope(rawEnvelope) {
  const suggestionsRaw = Array.isArray(rawEnvelope?.suggestions)
    ? rawEnvelope.suggestions
    : [];
  const normalizedSuggestions = suggestionsRaw
    .map((suggestion) => normalizeOnCreateSuggestion(suggestion))
    .filter(Boolean)
    .map((suggestion) => ({
      ...suggestion,
      rationale: truncateRationale(suggestion.rationale, 120),
    }));
  const sortedSuggestions = sortSuggestions(
    ON_CREATE_SURFACE,
    normalizedSuggestions,
  );
  const cappedSuggestions = capSuggestions(sortedSuggestions, 6);

  let seenClarification = false;
  for (const suggestion of cappedSuggestions) {
    if (suggestion.type !== "ask_clarification") continue;
    if (!seenClarification) {
      seenClarification = true;
      continue;
    }
    suggestion.dismissed = true;
  }

  return {
    contractVersion: rawEnvelope?.contractVersion || 1,
    generatedAt: String(rawEnvelope?.generatedAt || new Date().toISOString()),
    requestId: String(rawEnvelope?.requestId || "on-create"),
    surface: ON_CREATE_SURFACE,
    must_abstain: !!rawEnvelope?.must_abstain,
    suggestions: cappedSuggestions,
  };
}

async function fetchOnCreateLatestSuggestion(todoId) {
  return apiCall(
    `${API_URL}/ai/suggestions/latest?todoId=${encodeURIComponent(todoId)}&surface=${ON_CREATE_SURFACE}`,
  );
}

async function generateOnCreateSuggestion(todo) {
  return apiCall(`${API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: ON_CREATE_SURFACE,
      todoId: todo.id,
      title: todo.title,
      description: todo.description || "",
      notes: todo.notes || "",
    }),
  });
}

async function loadOnCreateDecisionAssist(todo, allowGenerate = true) {
  if (!todo?.id) return;
  const todoId = String(todo.id);
  onCreateAssistState.loading = true;
  onCreateAssistState.error = "";
  onCreateAssistState.unavailable = false;
  onCreateAssistState.mode = "live";
  onCreateAssistState.liveTodoId = todoId;
  onCreateAssistState.aiSuggestionId = "";
  onCreateAssistState.envelope = null;
  onCreateAssistState.suggestions = [];
  onCreateAssistState.showAll = false;
  renderOnCreateAssistRow();

  try {
    let latestResponse = await fetchOnCreateLatestSuggestion(todoId);
    if (latestResponse.status === 403 || latestResponse.status === 404) {
      onCreateAssistState.loading = false;
      onCreateAssistState.unavailable = true;
      renderOnCreateAssistRow();
      return;
    }

    if (latestResponse.status === 204) {
      if (isOnCreateDismissed(todoId) || !allowGenerate) {
        onCreateAssistState.loading = false;
        onCreateAssistState.envelope = normalizeOnCreateAssistEnvelope({
          surface: ON_CREATE_SURFACE,
          must_abstain: true,
          suggestions: [],
        });
        onCreateAssistState.suggestions = [];
        renderOnCreateAssistRow();
        return;
      }

      const generated = await generateOnCreateSuggestion(todo);
      if (generated.status === 403 || generated.status === 404) {
        onCreateAssistState.loading = false;
        onCreateAssistState.unavailable = true;
        renderOnCreateAssistRow();
        return;
      }
      latestResponse = await fetchOnCreateLatestSuggestion(todoId);
    }

    if (latestResponse.status === 204) {
      onCreateAssistState.loading = false;
      onCreateAssistState.envelope = normalizeOnCreateAssistEnvelope({
        surface: ON_CREATE_SURFACE,
        must_abstain: true,
        suggestions: [],
      });
      onCreateAssistState.suggestions = [];
      renderOnCreateAssistRow();
      return;
    }

    if (!latestResponse.ok) {
      onCreateAssistState.loading = false;
      onCreateAssistState.error = "Could not load suggestions.";
      renderOnCreateAssistRow();
      return;
    }

    const payload = await latestResponse.json();
    const envelope = normalizeOnCreateAssistEnvelope(
      payload?.outputEnvelope || {},
    );
    onCreateAssistState.loading = false;
    onCreateAssistState.aiSuggestionId = String(payload?.aiSuggestionId || "");
    onCreateAssistState.envelope = envelope;
    onCreateAssistState.suggestions = envelope.suggestions;
    onCreateAssistState.mode = "live";
    onCreateAssistState.liveTodoId = todoId;
    renderOnCreateAssistRow();
  } catch (error) {
    console.error("On-create AI load failed:", error);
    onCreateAssistState.loading = false;
    onCreateAssistState.error = "Could not load suggestions.";
    renderOnCreateAssistRow();
  }
}

function refreshOnCreateAssistFromTitle(force = false) {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  const title = refs.titleInput.value.trim();
  if (!title) {
    resetOnCreateAssistState();
    renderOnCreateAssistRow();
    return;
  }
  if (!force && onCreateAssistState.titleBasis === title) {
    renderOnCreateAssistRow();
    return;
  }
  const envelope = normalizeOnCreateAssistEnvelope(
    buildMockOnCreateAssistEnvelope(title),
  );
  onCreateAssistState = {
    ...createInitialOnCreateAssistState(),
    dismissedTodoIds: onCreateAssistState.dismissedTodoIds,
    titleBasis: title,
    envelope,
    suggestions: envelope.suggestions,
    mode: "mock",
    showAll: false,
  };
  renderOnCreateAssistRow();
}

function getOnCreateSuggestionById(suggestionId) {
  return onCreateAssistState.suggestions.find(
    (suggestion) => suggestion.suggestionId === suggestionId,
  );
}

function getActiveOnCreateSuggestions() {
  return onCreateAssistState.suggestions.filter(
    (suggestion) => !suggestion.dismissed,
  );
}

function formatOnCreateDueDateLabel(dueDateIso) {
  const date = new Date(dueDateIso);
  if (Number.isNaN(date.getTime())) return "Set due date";
  return `Due ${date.toLocaleDateString()}`;
}

function buildOnCreateChipSummary(suggestion) {
  if (suggestion.type === "set_due_date") {
    return formatOnCreateDueDateLabel(suggestion.payload.dueDateISO);
  }
  if (suggestion.type === "set_priority") {
    return `Priority ${String(suggestion.payload.priority || "").toUpperCase() || "MEDIUM"}`;
  }
  if (suggestion.type === "set_project") {
    return `Project ${String(suggestion.payload.projectName || suggestion.payload.category || "suggested")}`;
  }
  if (suggestion.type === "set_category") {
    return `Category ${String(suggestion.payload.category || "suggested")}`;
  }
  if (suggestion.type === "rewrite_title") {
    return "Refine title";
  }
  if (suggestion.type === "ask_clarification") {
    return "Need one choice";
  }
  return "Suggestion";
}

function renderOnCreateChipChoices(suggestion) {
  if (
    suggestion.type !== "ask_clarification" ||
    !suggestion.clarificationExpanded ||
    suggestion.clarificationAnswered
  ) {
    return "";
  }
  const choices = Array.isArray(suggestion.payload.choices)
    ? suggestion.payload.choices
    : [];
  if (choices.length === 0) return "";
  return `
    <div
      class="ai-create-chip__choices"
      role="radiogroup"
      aria-label="Clarification choices"
      aria-describedby="ai-create-rationale-${escapeHtml(suggestion.suggestionId)}"
    >
      ${choices
        .map(
          (choice) => `
            <button
              type="button"
              class="ai-create-chip__choice ai-action-btn"
              role="radio"
              aria-checked="false"
              data-ai-create-action="choose"
              data-ai-create-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
              data-ai-create-choice-value="${escapeHtml(String(choice.value || ""))}"
              aria-label="Choose ${escapeHtml(String(choice.label || choice.value || ""))}"
            >
              ${escapeHtml(String(choice.label || choice.value || ""))}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderOnCreateChipActions(suggestion) {
  const suggestionId = escapeHtml(suggestion.suggestionId);
  const label = escapeHtml(formatOnCreateSuggestionLabel(suggestion.type));
  const rationaleId = `ai-create-rationale-${suggestionId}`;
  if (suggestion.applied) {
    return `
      <span class="ai-create-chip__applied">Applied</span>
      <button
        type="button"
        class="ai-create-chip__undo ai-undo"
        data-testid="ai-chip-undo-${suggestionId}"
        aria-label="Undo ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="undo"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        Undo
      </button>
    `;
  }
  if (suggestion.requiresConfirmation && suggestion.confirmationOpen) {
    return `
      <div class="ai-confirm" role="group" aria-label="Confirm apply ${label}">
        <button
          type="button"
          class="ai-create-chip__confirm ai-action-btn"
          data-testid="ai-chip-confirm-${suggestionId}"
          aria-label="Confirm apply ${label}"
          aria-describedby="${rationaleId}"
          data-ai-create-action="confirm-apply"
          data-ai-create-suggestion-id="${suggestionId}"
        >
          Confirm
        </button>
        <button
          type="button"
          class="ai-create-chip__action ai-action-btn"
          aria-label="Cancel confirmation for ${label}"
          aria-describedby="${rationaleId}"
          data-ai-create-action="cancel-confirm"
          data-ai-create-suggestion-id="${suggestionId}"
        >
          Cancel
        </button>
      </div>
    `;
  }
  if (
    suggestion.type === "ask_clarification" &&
    !suggestion.clarificationAnswered
  ) {
    return `
      <button
        type="button"
        class="ai-create-chip__action ai-action-btn"
        data-testid="ai-chip-apply-${suggestionId}"
        aria-label="Open choices for ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="toggle-choices"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        Choose
      </button>
      <button
        type="button"
        class="ai-create-chip__dismiss ai-action-btn"
        data-testid="ai-chip-dismiss-${suggestionId}"
        aria-label="Dismiss ${label}"
        aria-describedby="${rationaleId}"
        data-ai-create-action="dismiss"
        data-ai-create-suggestion-id="${suggestionId}"
      >
        ×
      </button>
    `;
  }
  return `
    <button
      type="button"
      class="ai-create-chip__action ai-action-btn"
      data-testid="ai-chip-apply-${suggestionId}"
      aria-label="Apply ${label}"
      aria-describedby="${rationaleId}"
      data-ai-create-action="apply"
      data-ai-create-suggestion-id="${suggestionId}"
    >
      Apply
    </button>
    <button
      type="button"
      class="ai-create-chip__dismiss ai-action-btn"
      data-testid="ai-chip-dismiss-${suggestionId}"
      aria-label="Dismiss ${label}"
      aria-describedby="${rationaleId}"
      data-ai-create-action="dismiss"
      data-ai-create-suggestion-id="${suggestionId}"
    >
      ×
    </button>
  `;
}

function renderOnCreateAssistRow() {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  const title = refs.titleInput.value.trim();
  const hasLiveContext = !!onCreateAssistState.liveTodoId;
  if (!title && !hasLiveContext && !onCreateAssistState.loading) {
    refs.row.hidden = true;
    refs.row.innerHTML = "";
    return;
  }

  // Lint-first gate: show one chip only; full panel revealed by Fix/Review.
  // In debug mode, always show the full panel so developers see all metadata.
  if (!onCreateAssistState.showFullAssist && !AI_DEBUG_ENABLED) {
    const issue = lintTodoFields({
      title,
      dueDate: refs.dueDateInput ? refs.dueDateInput.value : "",
      priority: currentPriority,
      allTodos: todos,
      surface: "on_create",
    });
    onCreateAssistState.lintIssue = issue;
    if (!issue) {
      refs.row.hidden = true;
      refs.row.innerHTML = "";
    } else {
      refs.row.hidden = false;
      refs.row.innerHTML = renderLintChip(issue);
    }
    return;
  }

  refs.row.hidden = false;
  if (onCreateAssistState.loading) {
    refs.row.innerHTML = `
      <div class="ai-create-assist__header">
        <span class="ai-create-assist__title">AI Assist</span>
      </div>
      <div class="ai-create-assist__empty ai-empty" role="status">Loading suggestions...</div>
    `;
    return;
  }
  if (onCreateAssistState.unavailable) {
    refs.row.innerHTML = `
      <div class="ai-create-assist__header">
        <span class="ai-create-assist__title">AI Assist</span>
      </div>
      <div class="ai-create-assist__empty ai-empty" role="status">AI Suggestions unavailable.</div>
    `;
    return;
  }
  if (onCreateAssistState.error) {
    refs.row.innerHTML = `
      <div class="ai-create-assist__header">
        <span class="ai-create-assist__title">AI Assist</span>
      </div>
      <div class="ai-create-assist__empty ai-empty" role="status">No suggestions right now.</div>
    `;
    return;
  }
  const activeSuggestions = getActiveOnCreateSuggestions();
  if (activeSuggestions.length === 0) {
    refs.row.innerHTML = `
      <div class="ai-create-assist__header">
        <span class="ai-create-assist__title">AI Assist</span>
      </div>
      ${renderAiDebugMeta(onCreateAssistState.envelope || {})}
      <div class="ai-create-assist__empty ai-empty" role="status">No suggestions right now.</div>
    `;
    return;
  }

  const defaultLimit = 4;
  const visibleLimit = onCreateAssistState.showAll ? 6 : defaultLimit;
  const visibleSuggestions = activeSuggestions.slice(0, visibleLimit);
  const hiddenCount = Math.max(
    0,
    activeSuggestions.length - visibleSuggestions.length,
  );

  refs.row.innerHTML = `
    <div class="ai-create-assist__header">
      <span class="ai-create-assist__title">AI Assist</span>
      ${
        hiddenCount > 0
          ? `
          <button
            type="button"
            class="ai-create-assist__expand"
            data-testid="ai-chip-expand-more"
            data-ai-create-action="toggle-more"
            aria-label="${onCreateAssistState.showAll ? "Show fewer suggestions" : `Show ${hiddenCount} more suggestions`}"
          >
            ${onCreateAssistState.showAll ? "Show less" : `+${hiddenCount} more`}
          </button>
        `
          : ""
      }
    </div>
    ${renderAiDebugMeta(onCreateAssistState.envelope || {})}
    <div class="ai-create-assist__chips">
      ${visibleSuggestions
        .map((suggestion) => {
          const confidenceLabel = getOnCreateConfidenceBadge(
            suggestion.confidence,
          );
          return `
            <div
              class="ai-create-chip ai-card ${suggestion.applied ? "ai-create-chip--applied" : ""}"
              data-testid="ai-chip-${escapeHtml(suggestion.suggestionId)}"
            >
              <div class="ai-create-chip__top">
                <span class="ai-create-chip__label">${escapeHtml(formatOnCreateSuggestionLabel(suggestion.type))}</span>
                <span
                  class="ai-create-chip__confidence ai-badge ai-badge--${escapeHtml(confidenceBand(suggestion.confidence))}"
                  aria-label="Confidence ${escapeHtml(confidenceLabel)}"
                >
                  ${escapeHtml(confidenceLabel)}
                </span>
              </div>
              <div
                class="ai-create-chip__summary"
                id="ai-create-rationale-${escapeHtml(suggestion.suggestionId)}"
                title="${escapeHtml(suggestion.rationale || buildOnCreateChipSummary(suggestion))}"
              >
                ${escapeHtml(buildOnCreateChipSummary(suggestion))}
              </div>
              <div class="ai-create-chip__rationale ai-tooltip">${escapeHtml(suggestion.rationale || buildOnCreateChipSummary(suggestion))}</div>
              ${renderAiDebugSuggestionId(suggestion.suggestionId)}
              ${
                suggestion.clarificationAnswered
                  ? `<div class="ai-create-chip__helper">Answer: ${escapeHtml(suggestion.clarificationAnswer)}</div>`
                  : ""
              }
              ${suggestion.helperText ? `<div class="ai-create-chip__helper">${escapeHtml(suggestion.helperText)}</div>` : ""}
              ${renderOnCreateChipChoices(suggestion)}
              <div class="ai-create-chip__actions ai-actions">
                ${renderOnCreateChipActions(suggestion)}
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  const confirmationSuggestion = visibleSuggestions.find(
    (suggestion) =>
      needsConfirmation(suggestion) && suggestion.confirmationOpen,
  );
  if (confirmationSuggestion) {
    window.requestAnimationFrame(() => {
      const confirmButton = refs.row.querySelector(
        `[data-testid="ai-chip-confirm-${escapeSelectorValue(confirmationSuggestion.suggestionId)}"]`,
      );
      if (confirmButton instanceof HTMLElement) {
        confirmButton.focus({ preventScroll: true });
      }
    });
  }
}

function snapshotOnCreateDraftState() {
  const refs = getOnCreateAssistElements();
  if (!refs) return null;
  return {
    title: refs.titleInput.value,
    dueDate:
      refs.dueDateInput instanceof HTMLInputElement
        ? refs.dueDateInput.value
        : "",
    project:
      refs.projectSelect instanceof HTMLSelectElement
        ? refs.projectSelect.value
        : "",
    priority: currentPriority,
  };
}

function restoreOnCreateDraftState(snapshot) {
  if (!snapshot) return;
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  suppressOnCreateAssistInput = true;
  refs.titleInput.value = snapshot.title || "";
  if (refs.dueDateInput instanceof HTMLInputElement) {
    refs.dueDateInput.value = snapshot.dueDate || "";
  }
  if (refs.projectSelect instanceof HTMLSelectElement) {
    if (snapshot.project) {
      ensureOnCreateProjectOption(snapshot.project);
    }
    refs.projectSelect.value = snapshot.project || "";
  }
  if (
    snapshot.priority === "low" ||
    snapshot.priority === "medium" ||
    snapshot.priority === "high"
  ) {
    setPriority(snapshot.priority);
  }
  suppressOnCreateAssistInput = false;
}

function applyOnCreateSuggestion(suggestion, clarificationChoice = "") {
  const refs = getOnCreateAssistElements();
  if (!refs) return;
  suggestion.undoSnapshot = snapshotOnCreateDraftState();
  suggestion.applied = true;
  suggestion.confirmationOpen = false;
  suggestion.helperText = "";

  if (suggestion.type === "rewrite_title") {
    const nextTitle = String(suggestion.payload.title || "").trim();
    if (nextTitle) {
      suppressOnCreateAssistInput = true;
      refs.titleInput.value = nextTitle;
      suppressOnCreateAssistInput = false;
    }
  } else if (suggestion.type === "set_due_date") {
    const dueDateIso = String(suggestion.payload.dueDateISO || "");
    if (refs.dueDateInput instanceof HTMLInputElement) {
      refs.dueDateInput.value = toDateTimeLocalValue(dueDateIso);
    }
  } else if (suggestion.type === "set_priority") {
    const nextPriority = String(
      suggestion.payload.priority || "",
    ).toLowerCase();
    if (
      nextPriority === "low" ||
      nextPriority === "medium" ||
      nextPriority === "high"
    ) {
      setPriority(nextPriority);
    }
  } else if (suggestion.type === "set_project") {
    const rawProject = String(
      suggestion.payload.projectName || suggestion.payload.category || "",
    );
    const normalized = normalizeProjectPath(rawProject);
    if (normalized && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(normalized);
      refs.projectSelect.value = normalized;
    }
  } else if (suggestion.type === "set_category") {
    const rawCategory = String(suggestion.payload.category || "");
    const normalized = normalizeProjectPath(rawCategory);
    if (normalized && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(normalized);
      refs.projectSelect.value = normalized;
    }
  } else if (suggestion.type === "ask_clarification") {
    suggestion.clarificationAnswered = true;
    suggestion.clarificationExpanded = false;
    suggestion.clarificationAnswer = clarificationChoice || "Selected";
    const selectedChoice =
      (Array.isArray(suggestion.payload.choices)
        ? suggestion.payload.choices.find(
            (choice) => String(choice.value || "") === clarificationChoice,
          )
        : null) || null;
    const projectValue = normalizeProjectPath(
      String(
        selectedChoice?.projectName ||
          selectedChoice?.category ||
          selectedChoice?.value ||
          "",
      ),
    );
    if (projectValue && refs.projectSelect instanceof HTMLSelectElement) {
      ensureOnCreateProjectOption(projectValue);
      refs.projectSelect.value = projectValue;
    }
    suggestion.helperText = "Thanks — will refine next time.";
  }
}

async function applyLiveOnCreateSuggestion(suggestion, confirmed = false) {
  if (!onCreateAssistState.aiSuggestionId) return;
  const response = await apiCall(
    `${API_URL}/ai/suggestions/${encodeURIComponent(onCreateAssistState.aiSuggestionId)}/apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionId: suggestion.suggestionId,
        confirmed: confirmed === true,
      }),
    },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    onCreateAssistState.error =
      typeof data?.error === "string"
        ? data.error
        : "Could not apply suggestion.";
    renderOnCreateAssistRow();
    return;
  }

  const data = await response.json().catch(() => ({}));
  if (data?.todo?.id) {
    const index = todos.findIndex((item) => item.id === data.todo.id);
    if (index >= 0) {
      todos[index] = data.todo;
    }
    renderTodos();
  }
  clearOnCreateDismissed(onCreateAssistState.liveTodoId);
  const refreshedTodo =
    (onCreateAssistState.liveTodoId &&
      todos.find((item) => item.id === onCreateAssistState.liveTodoId)) ||
    null;
  if (refreshedTodo) {
    await loadOnCreateDecisionAssist(refreshedTodo, false);
  } else {
    resetOnCreateAssistState();
    renderOnCreateAssistRow();
  }
}

async function onCreateAssistApplySuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || suggestion.dismissed || suggestion.applied) return;
  if (suggestion.type === "ask_clarification") {
    suggestion.clarificationExpanded = !suggestion.clarificationExpanded;
    renderOnCreateAssistRow();
    return;
  }
  if (suggestion.requiresConfirmation) {
    suggestion.confirmationOpen = true;
    renderOnCreateAssistRow();
    return;
  }
  if (onCreateAssistState.mode === "live") {
    await applyLiveOnCreateSuggestion(suggestion, false);
    return;
  }
  applyOnCreateSuggestion(suggestion);
  renderOnCreateAssistRow();
}

async function onCreateAssistConfirmApplySuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || suggestion.dismissed || suggestion.applied) return;
  if (onCreateAssistState.mode === "live") {
    await applyLiveOnCreateSuggestion(suggestion, true);
    return;
  }
  applyOnCreateSuggestion(suggestion);
  renderOnCreateAssistRow();
}

async function onCreateAssistDismissSuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion) return;
  if (
    onCreateAssistState.mode === "live" &&
    onCreateAssistState.aiSuggestionId
  ) {
    try {
      await apiCall(
        `${API_URL}/ai/suggestions/${encodeURIComponent(onCreateAssistState.aiSuggestionId)}/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId, dismissAll: true }),
        },
      );
    } catch (error) {
      console.error("On-create AI dismiss failed:", error);
    }
    markOnCreateDismissed(onCreateAssistState.liveTodoId);
    onCreateAssistState.suggestions = [];
    onCreateAssistState.envelope = normalizeOnCreateAssistEnvelope({
      surface: ON_CREATE_SURFACE,
      must_abstain: true,
      suggestions: [],
    });
    onCreateAssistState.aiSuggestionId = "";
    onCreateAssistState.error = "";
    renderOnCreateAssistRow();
    return;
  }
  suggestion.dismissed = true;
  renderOnCreateAssistRow();
}

function onCreateAssistUndoSuggestion(suggestionId) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (!suggestion || !suggestion.applied) return;
  restoreOnCreateDraftState(suggestion.undoSnapshot);
  suggestion.applied = false;
  suggestion.confirmationOpen = false;
  suggestion.clarificationAnswered = false;
  suggestion.clarificationAnswer = "";
  suggestion.helperText = "";
  suggestion.clarificationExpanded = false;
  suggestion.undoSnapshot = null;
  emitAiSuggestionUndoTelemetry({
    surface: ON_CREATE_SURFACE,
    aiSuggestionDbId: onCreateAssistState.aiSuggestionId,
    suggestionId,
    todoId: onCreateAssistState.liveTodoId || "",
    selectedTodoIdsCount: 1,
  });
  renderOnCreateAssistRow();
}

function onCreateAssistChooseClarification(suggestionId, choiceValue) {
  const suggestion = getOnCreateSuggestionById(suggestionId);
  if (
    !suggestion ||
    suggestion.type !== "ask_clarification" ||
    suggestion.applied
  ) {
    return;
  }
  applyOnCreateSuggestion(suggestion, String(choiceValue || "").trim());
  renderOnCreateAssistRow();
}

function bindOnCreateAssistHandlers() {
  if (window.__onCreateAssistHandlersBound) {
    return;
  }
  window.__onCreateAssistHandlersBound = true;

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== "todoInput") return;
    if (suppressOnCreateAssistInput) {
      renderOnCreateAssistRow();
      return;
    }
    refreshOnCreateAssistFromTitle();
  });

  // Lint chip Fix/Review delegation (on-create surface only).
  // Excludes clicks inside #todoDetailsDrawer which has its own handler.
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("#todoDetailsDrawer")) return;
    const lintEl = target.closest("[data-ai-lint-action]");
    if (!(lintEl instanceof HTMLElement)) return;
    const lintAction = lintEl.getAttribute("data-ai-lint-action");
    onCreateAssistState.showFullAssist = true;
    if (onCreateAssistState.liveTodoId) {
      // Post-create mode: load server-backed suggestions for the saved todo.
      const todo = getTodoById(onCreateAssistState.liveTodoId);
      await loadOnCreateDecisionAssist(todo, lintAction === "fix");
    } else {
      // Pre-create mode: regenerate client-side mock suggestions and reveal them.
      // refreshOnCreateAssistFromTitle resets state; set showFullAssist after.
      refreshOnCreateAssistFromTitle(true);
      onCreateAssistState.showFullAssist = true;
      renderOnCreateAssistRow();
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest("[data-ai-create-action]");
    if (!(actionEl instanceof HTMLElement)) return;
    const action = actionEl.getAttribute("data-ai-create-action");
    const suggestionId =
      actionEl.getAttribute("data-ai-create-suggestion-id") || "";
    if (action === "toggle-more") {
      onCreateAssistState.showAll = !onCreateAssistState.showAll;
      renderOnCreateAssistRow();
      return;
    }
    if (action === "apply" || action === "toggle-choices") {
      await onCreateAssistApplySuggestion(suggestionId);
      return;
    }
    if (action === "confirm-apply") {
      await onCreateAssistConfirmApplySuggestion(suggestionId);
      return;
    }
    if (action === "cancel-confirm") {
      const suggestion = getOnCreateSuggestionById(suggestionId);
      if (!suggestion) return;
      suggestion.confirmationOpen = false;
      renderOnCreateAssistRow();
      return;
    }
    if (action === "dismiss") {
      await onCreateAssistDismissSuggestion(suggestionId);
      return;
    }
    if (action === "undo") {
      onCreateAssistUndoSuggestion(suggestionId);
      return;
    }
    if (action === "choose") {
      const choiceValue =
        actionEl.getAttribute("data-ai-create-choice-value") || "";
      onCreateAssistChooseClarification(suggestionId, choiceValue);
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (
      !onCreateAssistState.suggestions.some((item) => item.confirmationOpen)
    ) {
      return;
    }
    const target = event.target;
    if (target instanceof Element && !target.closest("#aiOnCreateAssistRow")) {
      return;
    }
    onCreateAssistState.suggestions.forEach((item) => {
      item.confirmationOpen = false;
    });
    renderOnCreateAssistRow();
  });
}

function createInitialTodayPlanState() {
  return {
    goalText: "",
    generating: false,
    loading: false,
    unavailable: false,
    error: "",
    hasLoaded: false,
    mode: "live",
    aiSuggestionId: "",
    envelope: null,
    selectedTodoIds: new Set(),
    dismissedSuggestionIds: new Set(),
    notesDraftByTodoId: {},
    lastApplyBatch: null,
    loadingMessage: "",
  };
}

function resetTodayPlanState() {
  todayPlanState = createInitialTodayPlanState();
}

function getTodayPlanPanelElement() {
  const panel = document.getElementById("todayPlanPanel");
  if (!(panel instanceof HTMLElement)) return null;
  return panel;
}

function getTodayPlanImpactRank(type) {
  return impactRankForSurface(TODAY_PLAN_SURFACE, type);
}

function getTodayPlanConfidenceBadge(confidence) {
  return confidenceLabel(confidence);
}

function isTodayPlanViewActive() {
  return currentDateView === "today";
}

function toEpoch(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return Infinity;
  return date.getTime();
}

function normalizePriorityValue(priority) {
  const value = String(priority || "").toLowerCase();
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium";
}

function priorityWeight(priority) {
  const value = normalizePriorityValue(priority);
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function estimateTodoMinutes(todo, mode = "balanced") {
  const title = String(todo?.title || "").trim();
  const words = title ? title.split(/\s+/).length : 1;
  const base = Math.max(15, Math.min(120, words * 9));
  if (mode === "quick") {
    return Math.max(10, Math.min(30, Math.round(base * 0.6)));
  }
  if (mode === "deep") {
    return Math.max(45, Math.min(150, Math.round(base * 1.35)));
  }
  return base;
}

function rankTodayTodos(goalLower, todayTodos) {
  const mode = goalLower.includes("quick")
    ? "quick"
    : goalLower.includes("deep") || goalLower.includes("focus")
      ? "deep"
      : "balanced";
  const now = Date.now();
  const ranked = [...todayTodos].sort((a, b) => {
    const dueA = toEpoch(a.dueDate);
    const dueB = toEpoch(b.dueDate);
    const dueScoreA = dueA === Infinity ? Infinity : Math.max(0, dueA - now);
    const dueScoreB = dueB === Infinity ? Infinity : Math.max(0, dueB - now);
    const recencyA = toEpoch(a.updatedAt || a.createdAt);
    const recencyB = toEpoch(b.updatedAt || b.createdAt);
    const prioA = priorityWeight(a.priority);
    const prioB = priorityWeight(b.priority);
    if (mode === "quick") {
      const quickA = estimateTodoMinutes(a, "quick");
      const quickB = estimateTodoMinutes(b, "quick");
      if (quickA !== quickB) return quickA - quickB;
      if (dueScoreA !== dueScoreB) return dueScoreA - dueScoreB;
      if (prioA !== prioB) return prioB - prioA;
      return recencyB - recencyA;
    }
    if (mode === "deep") {
      const deepA = estimateTodoMinutes(a, "deep");
      const deepB = estimateTodoMinutes(b, "deep");
      if (deepA !== deepB) return deepB - deepA;
      if (prioA !== prioB) return prioB - prioA;
      if (dueScoreA !== dueScoreB) return dueScoreA - dueScoreB;
      return recencyB - recencyA;
    }
    if (dueScoreA !== dueScoreB) return dueScoreA - dueScoreB;
    if (prioA !== prioB) return prioB - prioA;
    return recencyB - recencyA;
  });
  return { mode, ranked };
}

function buildTodayPlanSuggestion(
  type,
  suggestionId,
  confidence,
  rationale,
  payload,
) {
  return {
    type,
    suggestionId,
    confidence,
    rationale: truncateRationale(rationale, 120),
    payload,
  };
}

function mockPlanFromGoal(goalText, todayTodos) {
  const goal = String(goalText || "").trim();
  const goalLower = goal.toLowerCase();
  const generatedAt = new Date().toISOString();

  if (
    goalLower.includes("abstain") ||
    !Array.isArray(todayTodos) ||
    !todayTodos.length
  ) {
    return {
      contractVersion: 1,
      generatedAt,
      requestId: `today-plan-${encodeURIComponent(goalLower || "empty")}`,
      surface: TODAY_PLAN_SURFACE,
      must_abstain: true,
      planPreview: { topN: 0, items: [] },
      suggestions: [],
    };
  }

  const { mode, ranked } = rankTodayTodos(goalLower, todayTodos);
  const topN =
    ranked.length >= 5 && (mode === "quick" || mode === "deep") ? 5 : 3;
  const selected = ranked.slice(0, Math.min(topN, ranked.length));
  const previewItems = selected.map((todo, index) => {
    const estimateMode =
      mode === "quick"
        ? "quick"
        : mode === "deep" && index === 0
          ? "deep"
          : "balanced";
    const minutes = estimateTodoMinutes(todo, estimateMode);
    const rationale =
      mode === "quick"
        ? "Quick-win candidate with low setup cost."
        : mode === "deep" && index === 0
          ? "Primary focus block for deep work."
          : "Urgency and priority alignment for today.";
    return {
      todoId: String(todo.id),
      rank: index + 1,
      timeEstimateMin: minutes,
      rationale,
    };
  });

  const suggestions = [];
  for (const item of previewItems) {
    const todo = selected.find((entry) => String(entry.id) === item.todoId);
    if (!todo) continue;
    if (item.rank <= 2) {
      const due = new Date();
      due.setDate(due.getDate() + item.rank);
      due.setHours(9 + item.rank, 0, 0, 0);
      suggestions.push(
        buildTodayPlanSuggestion(
          "set_due_date",
          `today-set-due-${item.todoId}`,
          0.8 - item.rank * 0.04,
          "Assign a concrete deadline for today's execution.",
          { todoId: item.todoId, dueDateISO: due.toISOString() },
        ),
      );
    }
    if (normalizePriorityValue(todo.priority) !== "high" && item.rank === 1) {
      suggestions.push(
        buildTodayPlanSuggestion(
          "set_priority",
          `today-set-priority-${item.todoId}`,
          0.77,
          "Top ranked item should be elevated for focus.",
          { todoId: item.todoId, priority: "high" },
        ),
      );
    }
    if (item.rank <= 2) {
      suggestions.push(
        buildTodayPlanSuggestion(
          "propose_next_action",
          `today-next-action-${item.todoId}`,
          0.7,
          "Define the first concrete step before context switching.",
          {
            todoId: item.todoId,
            text: `Start: ${String(todo.title || "").slice(0, 80)} and draft first deliverable.`,
          },
        ),
      );
    }
  }

  if (previewItems[0]) {
    const todoId = previewItems[0].todoId;
    suggestions.push(
      buildTodayPlanSuggestion(
        "split_subtasks",
        `today-split-${todoId}`,
        0.68,
        "Split one larger item into scoped execution steps.",
        {
          todoId,
          subtasks: [
            { title: "Outline deliverable", order: 1 },
            { title: "Execute focused work block", order: 2 },
            { title: "Review and close loop", order: 3 },
          ],
        },
      ),
    );
  }

  suggestions.push({
    type: "unknown_type",
    suggestionId: "today-unknown",
    confidence: 0.5,
    rationale: "Should be ignored",
    payload: { todoId: previewItems[0]?.todoId || "" },
  });

  return {
    contractVersion: 1,
    generatedAt,
    requestId: `today-plan-${encodeURIComponent(goalLower || "none")}-${todayTodos.length}`,
    surface: TODAY_PLAN_SURFACE,
    must_abstain: false,
    planPreview: {
      topN: previewItems.length,
      items: previewItems,
    },
    suggestions,
  };
}

function normalizeTodayPlanEnvelope(rawEnvelope) {
  const suggestionsRaw = Array.isArray(rawEnvelope?.suggestions)
    ? rawEnvelope.suggestions
    : [];
  const normalizedSuggestions = suggestionsRaw
    .filter((suggestion) =>
      shouldRenderTypeForSurface(TODAY_PLAN_SURFACE, suggestion?.type),
    )
    .map((suggestion) => ({
      type: String(suggestion.type),
      suggestionId: String(suggestion.suggestionId || ""),
      confidence: Math.max(0, Math.min(1, Number(suggestion.confidence) || 0)),
      rationale: truncateRationale(suggestion.rationale, 120),
      payload:
        suggestion.payload && typeof suggestion.payload === "object"
          ? suggestion.payload
          : {},
    }))
    .filter((suggestion) => suggestion.suggestionId);

  const previewItemsRaw = Array.isArray(rawEnvelope?.planPreview?.items)
    ? rawEnvelope.planPreview.items
    : [];
  const previewItems = previewItemsRaw
    .map((item) => ({
      todoId: String(item?.todoId || ""),
      rank: Number(item?.rank) || 0,
      timeEstimateMin: Number(item?.timeEstimateMin) || 0,
      rationale: truncateRationale(item?.rationale, 120),
    }))
    .filter((item) => item.todoId && item.rank > 0);

  return {
    contractVersion: Number(rawEnvelope?.contractVersion) || 1,
    generatedAt: String(rawEnvelope?.generatedAt || new Date().toISOString()),
    requestId: String(rawEnvelope?.requestId || "today-plan"),
    surface: TODAY_PLAN_SURFACE,
    must_abstain: !!rawEnvelope?.must_abstain,
    planPreview: {
      topN: Number(rawEnvelope?.planPreview?.topN) || previewItems.length,
      items: previewItems,
    },
    suggestions: normalizedSuggestions,
  };
}

async function fetchTodayPlanLatestSuggestion() {
  return apiCall(
    `${API_URL}/ai/suggestions/latest?surface=${TODAY_PLAN_SURFACE}`,
  );
}

function buildTodayPlanCandidates() {
  return getVisibleTodos().map((todo) => ({
    id: String(todo.id),
    title: String(todo.title || ""),
    dueDate: todo.dueDate || undefined,
    priority: todo.priority || undefined,
    createdAt: todo.createdAt || undefined,
    updatedAt: todo.updatedAt || undefined,
  }));
}

async function generateTodayPlanSuggestion(goalText) {
  const candidates = buildTodayPlanCandidates();
  const preferredTopN = candidates.length >= 5 ? 5 : 3;
  return apiCall(`${API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ai-explicit-request": "1",
    },
    body: JSON.stringify({
      surface: TODAY_PLAN_SURFACE,
      goal: goalText || undefined,
      topN: preferredTopN,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      anchorDateISO: new Date().toISOString(),
      todoCandidates: candidates,
    }),
  });
}

async function loadTodayPlanDecisionAssist(allowGenerate = false) {
  if (!isTodayPlanViewActive()) return;
  if (!FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    todayPlanState.loading = false;
    todayPlanState.generating = false;
    todayPlanState.unavailable = true;
    todayPlanState.hasLoaded = true;
    renderTodayPlanPanel();
    return;
  }

  todayPlanState.loading = true;
  todayPlanState.error = "";
  todayPlanState.unavailable = false;
  renderTodayPlanPanel();

  try {
    let latestResponse = await fetchTodayPlanLatestSuggestion();
    if (latestResponse.status === 403 || latestResponse.status === 404) {
      todayPlanState.loading = false;
      todayPlanState.generating = false;
      todayPlanState.unavailable = true;
      todayPlanState.hasLoaded = true;
      renderTodayPlanPanel();
      return;
    }

    if (latestResponse.status === 204 && allowGenerate) {
      const generated = await generateTodayPlanSuggestion(
        todayPlanState.goalText,
      );
      if (generated.status === 403 || generated.status === 404) {
        todayPlanState.loading = false;
        todayPlanState.generating = false;
        todayPlanState.unavailable = true;
        todayPlanState.hasLoaded = true;
        renderTodayPlanPanel();
        return;
      }
      latestResponse = await fetchTodayPlanLatestSuggestion();
    }

    if (latestResponse.status === 204) {
      todayPlanState.loading = false;
      todayPlanState.generating = false;
      todayPlanState.hasLoaded = true;
      todayPlanState.aiSuggestionId = "";
      todayPlanState.envelope = normalizeTodayPlanEnvelope({
        surface: TODAY_PLAN_SURFACE,
        must_abstain: false,
        planPreview: { topN: 3, items: [] },
        suggestions: [],
      });
      todayPlanState.selectedTodoIds = new Set();
      todayPlanState.dismissedSuggestionIds = new Set();
      renderTodayPlanPanel();
      return;
    }

    if (!latestResponse.ok) {
      todayPlanState.loading = false;
      todayPlanState.generating = false;
      todayPlanState.error = "Could not load suggestions.";
      todayPlanState.hasLoaded = true;
      renderTodayPlanPanel();
      return;
    }

    const payload = await latestResponse.json();
    const envelope = normalizeTodayPlanEnvelope(payload?.outputEnvelope || {});
    todayPlanState.loading = false;
    todayPlanState.generating = false;
    todayPlanState.hasLoaded = true;
    todayPlanState.aiSuggestionId = String(payload?.aiSuggestionId || "");
    todayPlanState.envelope = envelope;
    todayPlanState.dismissedSuggestionIds = new Set();
    todayPlanState.selectedTodoIds = new Set(
      envelope.planPreview.items
        .map((item) => String(item.todoId))
        .filter(Boolean),
    );
    renderTodayPlanPanel();
  } catch (error) {
    console.error("Today plan AI load failed:", error);
    todayPlanState.loading = false;
    todayPlanState.generating = false;
    todayPlanState.error = "Could not load suggestions.";
    todayPlanState.hasLoaded = true;
    renderTodayPlanPanel();
  }
}

function getTodayPlanSelectedSuggestionCards() {
  if (!todayPlanState.envelope) return [];
  const selectedIds = todayPlanState.selectedTodoIds;
  const filtered = todayPlanState.envelope.suggestions
    .filter((suggestion) => {
      const todoId = String(suggestion.payload?.todoId || "");
      return todoId && selectedIds.has(todoId);
    })
    .filter(
      (suggestion) =>
        !todayPlanState.dismissedSuggestionIds.has(suggestion.suggestionId),
    )
    .filter((suggestion) =>
      shouldRenderTypeForSurface(TODAY_PLAN_SURFACE, suggestion.type),
    );
  return capSuggestions(sortSuggestions(TODAY_PLAN_SURFACE, filtered), 6);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function renderTodayPlanPanel() {
  const panel = getTodayPlanPanelElement();
  if (!panel) return;
  if (!isTodayPlanViewActive()) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  panel.hidden = false;
  const goalText = todayPlanState.goalText || "";
  const envelope = todayPlanState.envelope;
  const previewItems = Array.isArray(envelope?.planPreview?.items)
    ? envelope.planPreview.items
    : [];
  const suggestionCards = getTodayPlanSelectedSuggestionCards();
  const emptyMessage = envelope?.must_abstain
    ? "No safe plan right now."
    : envelope && !todayPlanState.generating && suggestionCards.length === 0
      ? "No suggestions right now."
      : "";

  panel.setAttribute("data-testid", "today-plan-panel");
  panel.innerHTML = `
    <div class="today-plan-panel__header">
      <div class="today-plan-panel__title">Plan my day</div>
      ${
        todayPlanState.lastApplyBatch
          ? `
          <button
            type="button"
            class="today-plan-panel__undo ai-undo"
            data-testid="today-plan-undo"
            aria-label="Undo last plan apply"
            data-today-plan-action="undo"
          >
            Undo
          </button>
        `
          : ""
      }
    </div>
    <div class="today-plan-panel__controls">
      <label class="sr-only" for="todayPlanGoalInput">Goal (optional)</label>
      <input
        id="todayPlanGoalInput"
        data-testid="today-plan-goal-input"
        type="text"
        placeholder="Goal (optional)"
        value="${escapeHtml(goalText)}"
        aria-label="Goal (optional)"
      />
      <button
        id="todayPlanGenerateButton"
        data-testid="today-plan-generate"
        type="button"
        class="mini-btn"
        aria-label="Generate plan"
        data-today-plan-action="generate"
        ${todayPlanState.loading || todayPlanState.generating ? "disabled" : ""}
      >
        ${todayPlanState.loading || todayPlanState.generating ? "Generating..." : "Generate plan"}
      </button>
    </div>
    ${renderAiDebugMeta(envelope || {})}
    ${
      todayPlanState.loading || todayPlanState.generating
        ? '<div class="today-plan-panel__loading ai-empty" role="status">Generating plan preview...</div>'
        : ""
    }
    ${
      todayPlanState.unavailable
        ? '<div class="today-plan-panel__empty ai-empty" role="status">AI Suggestions unavailable.</div>'
        : ""
    }
    ${
      todayPlanState.error
        ? `<div class="today-plan-panel__empty ai-empty" role="status">${escapeHtml(todayPlanState.error)}</div>`
        : ""
    }
    ${
      previewItems.length > 0
        ? `
        <div class="today-plan-preview" data-testid="today-plan-preview">
          ${previewItems
            .map((item) => {
              const todo = todos.find(
                (entry) => String(entry.id) === String(item.todoId),
              );
              const checked = todayPlanState.selectedTodoIds.has(item.todoId);
              return `
                <div class="today-plan-preview__item" data-testid="today-plan-item-${escapeHtml(item.todoId)}">
                  <input
                    type="checkbox"
                    data-testid="today-plan-item-checkbox-${escapeHtml(item.todoId)}"
                    data-today-plan-action="toggle-item"
                    data-today-plan-todo-id="${escapeHtml(item.todoId)}"
                    aria-label="Select plan item ${escapeHtml(String(todo?.title || item.todoId))}"
                    ${checked ? "checked" : ""}
                  />
                  <div class="today-plan-preview__rank">${item.rank}</div>
                  <div class="today-plan-preview__body">
                    <div class="today-plan-preview__title">${escapeHtml(String(todo?.title || "Task"))}</div>
                    <div class="today-plan-preview__meta">${item.timeEstimateMin} min • ${escapeHtml(item.rationale)}</div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `
        : ""
    }
    ${emptyMessage ? `<div class="today-plan-panel__empty ai-empty" role="status">${escapeHtml(emptyMessage)}</div>` : ""}
    ${
      suggestionCards.length > 0
        ? `
        <div class="today-plan-suggestions">
          ${suggestionCards
            .map((suggestion) => {
              const todoId = String(suggestion.payload?.todoId || "");
              const todo = todos.find((entry) => String(entry.id) === todoId);
              const summary =
                suggestion.type === "set_due_date"
                  ? `Set due ${new Date(String(suggestion.payload?.dueDateISO || "")).toLocaleDateString()}`
                  : suggestion.type === "set_priority"
                    ? `Set priority ${String(suggestion.payload?.priority || "").toUpperCase()}`
                    : suggestion.type === "split_subtasks"
                      ? `Split into ${Array.isArray(suggestion.payload?.subtasks) ? suggestion.payload.subtasks.length : 0} subtasks`
                      : `Next action: ${String(suggestion.payload?.text || "").slice(0, 60)}`;
              return `
                <div
                  class="today-plan-suggestion ai-card"
                  data-testid="today-plan-suggestion-${escapeHtml(suggestion.suggestionId)}"
                  data-today-plan-todo-id="${escapeHtml(todoId)}"
                >
                  <div class="today-plan-suggestion__title">${escapeHtml(labelForType(suggestion.type))}</div>
                  <div class="today-plan-suggestion__summary">${escapeHtml(summary)}</div>
                  <div
                    class="today-plan-suggestion__rationale ai-tooltip"
                    id="today-plan-rationale-${escapeHtml(suggestion.suggestionId)}"
                  >
                    ${escapeHtml(suggestion.rationale)}
                  </div>
                  ${renderAiDebugSuggestionId(suggestion.suggestionId)}
                  <div class="today-plan-suggestion__footer ai-actions">
                    <span class="today-plan-suggestion__confidence ai-badge ai-badge--${escapeHtml(confidenceBand(suggestion.confidence))}" aria-label="Confidence ${escapeHtml(getTodayPlanConfidenceBadge(suggestion.confidence))}">
                      ${escapeHtml(getTodayPlanConfidenceBadge(suggestion.confidence))}
                    </span>
                    <button
                      type="button"
                      class="today-plan-suggestion__dismiss ai-action-btn"
                      data-testid="today-plan-suggestion-dismiss-${escapeHtml(suggestion.suggestionId)}"
                      aria-label="Dismiss suggestion ${escapeHtml(suggestion.suggestionId)}"
                      aria-describedby="today-plan-rationale-${escapeHtml(suggestion.suggestionId)}"
                      data-today-plan-action="dismiss-suggestion"
                      data-today-plan-suggestion-id="${escapeHtml(suggestion.suggestionId)}"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
        <div class="today-plan-panel__actions">
          <button
            type="button"
            class="add-btn"
            data-testid="today-plan-apply-selected"
            aria-label="Apply selected plan suggestions"
            data-today-plan-action="apply-selected"
          >
            Apply selected
          </button>
        </div>
      `
        : ""
    }
  `;
}

async function handleTodayPlanGenerate() {
  const goalInput = document.getElementById("todayPlanGoalInput");
  const goalText =
    goalInput instanceof HTMLInputElement ? goalInput.value.trim() : "";
  todayPlanState.goalText = goalText;
  todayPlanState.generating = true;
  todayPlanState.loading = true;
  todayPlanState.error = "";
  todayPlanState.unavailable = false;
  todayPlanState.loadingMessage = "Generating plan preview...";
  renderTodayPlanPanel();

  const generationId = ++todayPlanGenerationSeq;
  await loadTodayPlanDecisionAssist(true);
  if (generationId !== todayPlanGenerationSeq) return;
  todayPlanState.loadingMessage = "";
  todayPlanState.lastApplyBatch = null;
  renderTodayPlanPanel();
}

function handleTodayPlanToggleItem(todoId, checked) {
  if (checked) {
    todayPlanState.selectedTodoIds.add(todoId);
  } else {
    todayPlanState.selectedTodoIds.delete(todoId);
  }
  renderTodayPlanPanel();
}

async function handleTodayPlanDismissSuggestion(suggestionId) {
  if (todayPlanState.mode === "live" && todayPlanState.aiSuggestionId) {
    try {
      await apiCall(
        `${API_URL}/ai/suggestions/${encodeURIComponent(todayPlanState.aiSuggestionId)}/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId, dismissAll: true }),
        },
      );
    } catch (error) {
      console.error("Today plan dismiss failed:", error);
    }
    todayPlanState.aiSuggestionId = "";
    todayPlanState.envelope = normalizeTodayPlanEnvelope({
      surface: TODAY_PLAN_SURFACE,
      must_abstain: false,
      planPreview: { topN: 3, items: [] },
      suggestions: [],
    });
    todayPlanState.selectedTodoIds = new Set();
    todayPlanState.dismissedSuggestionIds = new Set();
    renderTodayPlanPanel();
    return;
  }
  todayPlanState.dismissedSuggestionIds.add(suggestionId);
  renderTodayPlanPanel();
}

async function handleTodayPlanApplySelected() {
  if (!todayPlanState.envelope) return;
  const suggestionsToApply = getTodayPlanSelectedSuggestionCards();
  if (!suggestionsToApply.length) return;

  const affectedTodoIds = new Set(
    suggestionsToApply
      .map((suggestion) => String(suggestion.payload?.todoId || ""))
      .filter(Boolean),
  );
  const todoSnapshots = {};
  for (const todoId of affectedTodoIds) {
    const todo = todos.find((entry) => String(entry.id) === todoId);
    if (!todo) continue;
    todoSnapshots[todoId] = deepClone(todo);
  }
  const notesDraftSnapshot = deepClone(todayPlanState.notesDraftByTodoId);
  if (todayPlanState.mode === "live" && todayPlanState.aiSuggestionId) {
    try {
      const response = await apiCall(
        `${API_URL}/ai/suggestions/${encodeURIComponent(todayPlanState.aiSuggestionId)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedTodoIds: Array.from(todayPlanState.selectedTodoIds),
            confirmed: true,
          }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        todayPlanState.error =
          typeof data?.error === "string"
            ? data.error
            : "Could not apply selected suggestions.";
        renderTodayPlanPanel();
        return;
      }
      const data = await response.json().catch(() => ({}));
      const updatedTodos = Array.isArray(data?.todos) ? data.todos : [];
      for (const updatedTodo of updatedTodos) {
        if (!updatedTodo?.id) continue;
        const index = todos.findIndex(
          (item) => String(item.id) === String(updatedTodo.id),
        );
        if (index >= 0) {
          todos[index] = updatedTodo;
        }
      }
      await loadTodayPlanDecisionAssist(false);
    } catch (error) {
      console.error("Today plan apply failed:", error);
      todayPlanState.error = "Could not apply selected suggestions.";
      renderTodayPlanPanel();
      return;
    }
  } else {
    for (const suggestion of suggestionsToApply) {
      const todoId = String(suggestion.payload?.todoId || "");
      const todo = todos.find((entry) => String(entry.id) === todoId);
      if (!todo) continue;

      if (suggestion.type === "set_priority") {
        todo.priority = normalizePriorityValue(suggestion.payload?.priority);
        continue;
      }
      if (suggestion.type === "set_due_date") {
        const dueDate = String(suggestion.payload?.dueDateISO || "");
        const parsed = new Date(dueDate);
        if (!Number.isNaN(parsed.getTime())) {
          todo.dueDate = parsed.toISOString();
        }
        continue;
      }
      if (suggestion.type === "split_subtasks") {
        const subtasksRaw = Array.isArray(suggestion.payload?.subtasks)
          ? suggestion.payload.subtasks
          : [];
        todo.subtasks = subtasksRaw.slice(0, 5).map((subtask, index) => ({
          id: `local-today-plan-${suggestion.suggestionId}-${index + 1}`,
          title: String(subtask?.title || "").slice(0, 200),
          completed: false,
          order: Number(subtask?.order) || index + 1,
        }));
        continue;
      }
      if (suggestion.type === "propose_next_action") {
        todayPlanState.notesDraftByTodoId[todoId] = String(
          suggestion.payload?.text || "",
        ).slice(0, 500);
      }
    }
  }

  todayPlanState.lastApplyBatch = {
    todoSnapshots,
    notesDraftSnapshot,
  };
  renderTodos();
}

function handleTodayPlanUndoBatch() {
  const batch = todayPlanState.lastApplyBatch;
  if (!batch) return;
  Object.entries(batch.todoSnapshots || {}).forEach(([todoId, snapshot]) => {
    const index = todos.findIndex((entry) => String(entry.id) === todoId);
    if (index === -1) return;
    todos[index] = snapshot;
  });
  todayPlanState.notesDraftByTodoId = deepClone(batch.notesDraftSnapshot || {});
  todayPlanState.lastApplyBatch = null;
  emitAiSuggestionUndoTelemetry({
    surface: TODAY_PLAN_SURFACE,
    aiSuggestionDbId: todayPlanState.aiSuggestionId,
    suggestionId: todayPlanState.envelope?.requestId || "",
    selectedTodoIdsCount: Object.keys(batch.todoSnapshots || {}).length,
  });
  renderTodos();
}

function bindTodayPlanHandlers() {
  if (window.__todayPlanHandlersBound) {
    return;
  }
  window.__todayPlanHandlersBound = true;

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== "todayPlanGoalInput") return;
    if (!(target instanceof HTMLInputElement)) return;
    todayPlanState.goalText = target.value;
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-today-plan-action");
    if (action !== "toggle-item") return;
    const todoId = String(target.getAttribute("data-today-plan-todo-id") || "");
    if (!todoId || !(target instanceof HTMLInputElement)) return;
    handleTodayPlanToggleItem(todoId, target.checked);
  });

  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest("[data-today-plan-action]");
    if (!(actionEl instanceof HTMLElement)) return;
    const action = actionEl.getAttribute("data-today-plan-action");
    if (action === "toggle-item" && actionEl instanceof HTMLInputElement) {
      const todoId = String(
        actionEl.getAttribute("data-today-plan-todo-id") || "",
      );
      if (!todoId) return;
      handleTodayPlanToggleItem(todoId, actionEl.checked);
      return;
    }
    if (action === "generate") {
      await handleTodayPlanGenerate();
      return;
    }
    if (action === "dismiss-suggestion") {
      const suggestionId = String(
        actionEl.getAttribute("data-today-plan-suggestion-id") || "",
      );
      if (!suggestionId) return;
      await handleTodayPlanDismissSuggestion(suggestionId);
      return;
    }
    if (action === "apply-selected") {
      await handleTodayPlanApplySelected();
      return;
    }
    if (action === "undo") {
      handleTodayPlanUndoBatch();
    }
  });
}

// ========== PHASE B: PRIORITY, NOTES, SUBTASKS ==========
let currentPriority = "medium";

function handleTodoKeyPress(event) {
  if (event.key === "Enter") {
    addTodo();
  }
}

function setPriority(priority) {
  currentPriority = priority;

  // Update button states
  document.querySelectorAll(".priority-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document
    .getElementById(
      `priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
    )
    .classList.add("active");
}

function getPriorityIcon(priority) {
  const icons = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };
  return icons[priority] || icons.medium;
}

function toggleNotesInput() {
  const notesInput = document.getElementById("todoNotesInput");
  const icon = document.getElementById("notesExpandIcon");

  if (notesInput.style.display === "none") {
    notesInput.style.display = "block";
    icon.classList.add("expanded");
  } else {
    notesInput.style.display = "none";
    icon.classList.remove("expanded");
  }
}

function toggleNotes(todoId, event) {
  event.stopPropagation();
  const content = document.getElementById(`notes-content-${todoId}`);
  const icon = document.getElementById(`notes-icon-${todoId}`);

  if (content.style.display === "none") {
    content.style.display = "block";
    icon.classList.add("expanded");
  } else {
    content.style.display = "none";
    icon.classList.remove("expanded");
  }
}

function renderSubtasks(todo) {
  const completedCount = todo.subtasks.filter((s) => s.completed).length;
  const totalCount = todo.subtasks.length;

  return `
                <div class="subtasks-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span style="font-size: 0.85em; color: var(--text-secondary);">
                            ☑️ Subtasks: ${completedCount}/${totalCount}
                        </span>
                    </div>
                    <ul class="subtask-list">
                        ${todo.subtasks
                          .map(
                            (subtask) => `
                            <li class="subtask-item ${subtask.completed ? "completed" : ""}">
                                <input
                                    type="checkbox"
                                    class="todo-checkbox"
                                    aria-label="Mark subtask ${escapeHtml(subtask.title)} complete"
                                    style="width: 16px; height: 16px;"
                                    ${subtask.completed ? "checked" : ""}
                                    data-onchange="toggleSubtask('${todo.id}', '${subtask.id}')"
                                >
                                <span class="subtask-title">${escapeHtml(subtask.title)}</span>
                            </li>
                        `,
                          )
                          .join("")}
                    </ul>
                </div>
            `;
}

async function toggleSubtask(todoId, subtaskId) {
  const todo = todos.find((t) => t.id === todoId);
  if (!todo || !todo.subtasks) return;

  const subtask = todo.subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return;

  try {
    const response = await apiCall(
      `${API_URL}/todos/${todoId}/subtasks/${subtaskId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !subtask.completed }),
      },
    );

    if (response && response.ok) {
      const updatedSubtask = await response.json();
      todo.subtasks = todo.subtasks.map((s) =>
        s.id === subtaskId ? updatedSubtask : s,
      );
      renderTodos();
    }
  } catch (error) {
    console.error("Toggle subtask failed:", error);
  }
}

async function aiBreakdownTodo(todoId, force = false) {
  const todo = todos.find((item) => item.id === todoId);
  if (!todo) return;

  try {
    const response = await apiCall(`${API_URL}/ai/todos/${todoId}/breakdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxSubtasks: 5, force }),
    });
    const data = response ? await parseApiBody(response) : {};

    if (response && response.ok) {
      await loadTodos();
      await loadAiInsights();
      await loadAiFeedbackSummary();
      showMessage(
        "todosMessage",
        `Added ${data.createdCount || 0} AI subtasks for "${todo.title}"`,
        "success",
      );
      return;
    }

    if (response && response.status === 409) {
      const proceed = confirm(
        "This task already has subtasks. Generate additional subtasks anyway?",
      );
      if (proceed) {
        await aiBreakdownTodo(todoId, true);
      }
      return;
    }

    showMessage(
      "todosMessage",
      data.error || "Failed to generate subtasks",
      "error",
    );
  } catch (error) {
    console.error("AI breakdown error:", error);
    showMessage("todosMessage", "Failed to generate subtasks", "error");
  }
}

// ========== PHASE A: DRAG & DROP FUNCTIONALITY ==========
let draggedTodoId = null;
let draggedOverTodoId = null;

function handleDragStart(e) {
  draggedTodoId = e.target.dataset.todoId;
  e.target.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  const todoId = e.currentTarget.dataset.todoId;
  if (todoId !== draggedTodoId) {
    e.currentTarget.classList.add("drag-over");
    draggedOverTodoId = todoId;
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const dropTargetId = e.currentTarget.dataset.todoId;
  e.currentTarget.classList.remove("drag-over");

  if (draggedTodoId && dropTargetId && draggedTodoId !== dropTargetId) {
    reorderTodos(draggedTodoId, dropTargetId);
  }
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging");
  document.querySelectorAll(".todo-item").forEach((item) => {
    item.classList.remove("drag-over");
  });
  draggedTodoId = null;
  draggedOverTodoId = null;
}

async function reorderTodos(draggedId, targetId) {
  const draggedIndex = todos.findIndex((t) => t.id === draggedId);
  const targetIndex = todos.findIndex((t) => t.id === targetId);

  if (draggedIndex === -1 || targetIndex === -1) return;

  // Reorder in local array
  const [draggedTodo] = todos.splice(draggedIndex, 1);
  todos.splice(targetIndex, 0, draggedTodo);

  // Update order values
  todos.forEach((todo, index) => {
    todo.order = index;
  });

  renderTodos();

  // Persist complete ordering on backend in a single request.
  try {
    const response = await apiCall(`${API_URL}/todos/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        todos.map((todo) => ({ id: todo.id, order: todo.order })),
      ),
    });

    if (!response || !response.ok) {
      console.error(
        "Failed to persist full todo ordering, reloading from server",
      );
      await loadTodos();
    }
  } catch (error) {
    console.error("Failed to update todo order:", error);
    await loadTodos();
  }
}

// ========== PHASE A: BULK ACTIONS ==========
let selectedTodos = new Set();

function toggleSelectTodo(todoId) {
  if (selectedTodos.has(todoId)) {
    selectedTodos.delete(todoId);
  } else {
    selectedTodos.add(todoId);
  }
  updateBulkActionsVisibility();
  updateSelectAllCheckbox();
}

function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const filteredTodos = filterTodosList(todos);

  if (selectAllCheckbox.checked) {
    filteredTodos.forEach((todo) => selectedTodos.add(todo.id));
  } else {
    filteredTodos.forEach((todo) => selectedTodos.delete(todo.id));
  }

  renderTodos();
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const filteredTodos = filterTodosList(todos);
  const allSelected =
    filteredTodos.length > 0 &&
    filteredTodos.every((todo) => selectedTodos.has(todo.id));

  selectAllCheckbox.checked = allSelected;
}

function updateBulkActionsVisibility() {
  const toolbar = document.getElementById("bulkActionsToolbar");
  const bulkCount = document.getElementById("bulkCount");

  if (selectedTodos.size > 0) {
    toolbar.style.display = "flex";
    bulkCount.textContent = `${selectedTodos.size} selected`;
  } else {
    toolbar.style.display = "none";
  }

  updateSelectAllCheckbox();
}

async function completeSelected() {
  if (selectedTodos.size === 0) return;

  const selectedIds = Array.from(selectedTodos);
  const completedIds = [];

  for (const todoId of selectedIds) {
    try {
      const response = await apiCall(`${API_URL}/todos/${todoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });

      if (response && response.ok) {
        const todo = todos.find((t) => t.id === todoId);
        if (todo) {
          todo.completed = true;
          completedIds.push(todoId);
        }
      }
    } catch (error) {
      console.error("Failed to complete todo:", error);
    }
  }

  if (completedIds.length > 0) {
    addUndoAction(
      "bulk-complete",
      completedIds,
      `${completedIds.length} todos marked as complete`,
    );
  }

  selectedTodos.clear();
  renderTodos();
}

async function deleteSelected() {
  if (selectedTodos.size === 0) return;

  if (!confirm(`Delete ${selectedTodos.size} selected todo(s)?`)) return;

  const selectedIds = Array.from(selectedTodos);
  const deletedTodos = [];
  let deletedCount = 0;

  for (const todoId of selectedIds) {
    try {
      const response = await apiCall(`${API_URL}/todos/${todoId}`, {
        method: "DELETE",
      });

      if (response && response.ok) {
        const todo = todos.find((t) => t.id === todoId);
        if (todo) {
          deletedTodos.push({ ...todo });
        }
        todos = todos.filter((t) => t.id !== todoId);
        deletedCount += 1;
      } else {
        const errorData = response
          ? await response.json().catch(() => ({}))
          : {};
        console.error(
          "Failed to delete todo:",
          todoId,
          errorData.error || "Unknown error",
        );
      }
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  }

  if (deletedTodos.length > 0) {
    addUndoAction(
      "bulk-delete",
      deletedTodos,
      `${deletedTodos.length} todos deleted`,
    );
  }

  selectedTodos.clear();
  renderTodos();
  updateCategoryFilter();
  if (deletedCount > 0) {
    await loadTodos();
  }
}

// ========== PHASE A: KEYBOARD SHORTCUTS ==========
function toggleShortcuts() {
  const overlay = document.getElementById("shortcutsOverlay");
  overlay.classList.toggle("active");
}

function closeShortcutsOverlay(event) {
  if (event.target.id === "shortcutsOverlay") {
    toggleShortcuts();
  }
}

// ========== PHASE E: UNDO/REDO FUNCTIONALITY ==========
let undoStack = [];
let undoTimeout = null;

function addUndoAction(action, data, message) {
  undoStack.push({ action, data, timestamp: Date.now() });

  // Keep only last 10 actions
  if (undoStack.length > 10) {
    undoStack.shift();
  }

  showUndoToast(message);
}

function showUndoToast(message) {
  const toast = document.getElementById("undoToast");
  const messageEl = document.getElementById("undoMessage");

  messageEl.textContent = message;
  toast.classList.add("active");

  // Clear existing timeout
  if (undoTimeout) {
    clearTimeout(undoTimeout);
  }

  // Hide after 5 seconds
  undoTimeout = setTimeout(() => {
    toast.classList.remove("active");
  }, 5000);
}

function performUndo() {
  if (undoStack.length === 0) return;

  const lastAction = undoStack.pop();
  const toast = document.getElementById("undoToast");
  toast.classList.remove("active");

  switch (lastAction.action) {
    case "delete":
      // Restore deleted todo
      restoreTodo(lastAction.data);
      break;
    case "complete":
      // Uncomplete todo
      toggleTodo(lastAction.data.id, false);
      break;
    case "bulk-delete":
      // Restore multiple todos
      lastAction.data.forEach((todo) => restoreTodo(todo));
      break;
    case "bulk-complete":
      // Uncomplete multiple todos
      lastAction.data.forEach((todoId) => toggleTodo(todoId, false));
      break;
  }
}

async function restoreTodo(todoData) {
  try {
    const createPayload = {
      title: todoData.title,
      description: todoData.description,
      category: todoData.category,
      dueDate: todoData.dueDate,
      priority: todoData.priority,
      notes: todoData.notes,
    };

    const response = await apiCall(`${API_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });

    if (response && response.ok) {
      const newTodo = await response.json();
      let todoToRender = newTodo;

      // Preserve state that is not supported in create payload.
      if (todoData.completed === true || Number.isInteger(todoData.order)) {
        const updateResponse = await apiCall(`${API_URL}/todos/${newTodo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completed: !!todoData.completed,
            ...(Number.isInteger(todoData.order)
              ? { order: todoData.order }
              : {}),
          }),
        });

        if (updateResponse && updateResponse.ok) {
          todoToRender = await updateResponse.json();
        }
      }

      todos.push(todoToRender);
      todos.sort((a, b) => {
        const aOrder = Number.isInteger(a.order)
          ? a.order
          : Number.MAX_SAFE_INTEGER;
        const bOrder = Number.isInteger(b.order)
          ? b.order
          : Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
      renderTodos();
      updateCategoryFilter();
    }
  } catch (error) {
    console.error("Failed to restore todo:", error);
  }
}

document.addEventListener("keydown", function (e) {
  const isCommandK =
    (e.ctrlKey || e.metaKey) &&
    !e.shiftKey &&
    !e.altKey &&
    e.key.toLowerCase() === "k";
  if (isCommandK && !e.isComposing) {
    e.preventDefault();
    toggleCommandPalette();
    return;
  }

  if (isCommandPaletteOpen) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette({ restoreFocus: true });
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveCommandPaletteSelection(1);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveCommandPaletteSelection(-1);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const currentItem = commandPaletteSelectableItems[commandPaletteIndex];
      executeCommandPaletteItem(currentItem);
      return;
    }

    if (e.key === "Tab") {
      const refs = getCommandPaletteElements();
      if (!refs) return;
      const focusable = refs.panel.querySelectorAll(
        'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const focusableItems = Array.from(focusable).filter(
        (el) => el instanceof HTMLElement && !el.hidden,
      );
      if (focusableItems.length === 0) return;

      const first = focusableItems[0];
      const last = focusableItems[focusableItems.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
        return;
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  if (e.key === "Escape" && !isAiWorkspaceCollapsed) {
    const refs = getAiWorkspaceElements();
    const activeElement = document.activeElement;
    const focusInAiBody =
      !!refs &&
      activeElement instanceof HTMLElement &&
      refs.body.contains(activeElement);
    if (focusInAiBody) {
      e.preventDefault();
      setAiWorkspaceCollapsed(true, { restoreFocus: true });
      return;
    }
  }

  if (e.key === "Escape" && isProjectCrudModalOpen) {
    e.preventDefault();
    closeProjectCrudModal();
    return;
  }

  if (e.key === "Escape" && openRailProjectMenuKey) {
    e.preventDefault();
    closeRailProjectMenu({ restoreFocus: true });
    return;
  }

  if (e.key === "Escape" && openTodoKebabId) {
    e.preventDefault();
    closeTodoKebabMenu({ restoreFocus: true });
    return;
  }

  if (e.key === "Escape" && editingTodoId) {
    closeEditTodoModal();
    return;
  }

  if (e.key === "Escape" && isRailSheetOpen) {
    e.preventDefault();
    closeProjectsRailSheet({ restoreFocus: true });
    return;
  }

  if (e.key === "Escape" && isMoreFiltersOpen) {
    const refs = getMoreFiltersElements();
    const activeElement = document.activeElement;
    const focusedInMoreFilters =
      !!refs &&
      (refs.panel.contains(activeElement) || refs.toggle === activeElement);
    if (focusedInMoreFilters) {
      e.preventDefault();
      closeMoreFilters({ restoreFocus: true });
      return;
    }
  }

  if (e.key === "Escape" && isTodoDrawerOpen) {
    e.preventDefault();
    closeTodoDrawer({ restoreFocus: true });
    return;
  }

  // Ignore if typing in input fields
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    // Allow Esc to clear search
    if (e.key === "Escape" && e.target.id === "searchInput") {
      e.target.value = "";
      filterTodos();
      e.target.blur();
    }
    return;
  }

  // Ctrl/Cmd + N: Focus on new todo input
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault();
    document.getElementById("todoInput")?.focus();
  }

  // Ctrl/Cmd + F: Focus on search
  if ((e.ctrlKey || e.metaKey) && e.key === "f") {
    e.preventDefault();
    document.getElementById("searchInput")?.focus();
  }

  // Ctrl/Cmd + A: Select all todos
  if ((e.ctrlKey || e.metaKey) && e.key === "a") {
    e.preventDefault();
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = true;
      toggleSelectAll();
    }
  }

  // ?: Show keyboard shortcuts
  if (e.key === "?") {
    e.preventDefault();
    toggleShortcuts();
  }
});

// Load admin users
async function loadAdminUsers() {
  hideMessage("adminMessage");

  try {
    const response = await apiCall(`${API_URL}/admin/users`);
    if (response && response.ok) {
      users = await response.json();
      renderAdminUsers();
    } else {
      const data = await response.json();
      showMessage(
        "adminMessage",
        data.error || "Failed to load users",
        "error",
      );
    }
  } catch (error) {
    showMessage("adminMessage", "Network error. Please try again.", "error");
    console.error("Load users error:", error);
  }
}

// Render admin users
function renderAdminUsers() {
  const container = document.getElementById("adminContent");

  container.innerHTML = `
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Verified</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users
                          .map(
                            (user) => `
                            <tr>
                                <td>${escapeHtml(user.email)}</td>
                                <td>${escapeHtml(user.name || "-")}</td>
                                <td><span class="role-badge ${user.role}">${user.role}</span></td>
                                <td>${user.isVerified ? "✓" : "✗"}</td>
                                <td>${new Date(user.createdAt).toLocaleDateString()}</td>
                                <td>
                                    ${
                                      user.id !== currentUser.id
                                        ? `
                                        ${
                                          user.role === "user"
                                            ? `
                                            <button class="action-btn promote" data-onclick="changeUserRole('${user.id}', 'admin')">Make Admin</button>
                                        `
                                            : `
                                            <button class="action-btn demote" data-onclick="changeUserRole('${user.id}', 'user')">Remove Admin</button>
                                        `
                                        }
                                        <button class="action-btn delete" data-onclick="deleteUser('${user.id}')">Delete</button>
                                    `
                                        : "<em>You</em>"
                                    }
                                </td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            `;
}

// Change user role
async function changeUserRole(userId, role) {
  hideMessage("adminMessage");

  try {
    const response = await apiCall(`${API_URL}/admin/users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (response && response.ok) {
      showMessage("adminMessage", `User role updated to ${role}`, "success");
      loadAdminUsers();
    } else {
      const data = response ? await parseApiBody(response) : {};
      showMessage(
        "adminMessage",
        data.error || "Failed to update role",
        "error",
      );
    }
  } catch (error) {
    showMessage("adminMessage", "Network error. Please try again.", "error");
    console.error("Change role error:", error);
  }
}

// Delete user
async function deleteUser(userId) {
  if (
    !confirm(
      "Are you sure you want to delete this user? This action cannot be undone.",
    )
  )
    return;

  hideMessage("adminMessage");

  try {
    const response = await apiCall(`${API_URL}/admin/users/${userId}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      showMessage("adminMessage", "User deleted successfully", "success");
      loadAdminUsers();
    } else {
      const data = response ? await parseApiBody(response) : {};
      showMessage(
        "adminMessage",
        data.error || "Failed to delete user",
        "error",
      );
    }
  } catch (error) {
    showMessage("adminMessage", "Network error. Please try again.", "error");
    console.error("Delete user error:", error);
  }
}

function syncSidebarNavState(activeView) {
  const normalizedView = activeView === "profile" ? "settings" : activeView;
  document
    .querySelectorAll(".sidebar-nav-item[data-sidebar-view]")
    .forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const isActive = el.getAttribute("data-sidebar-view") === normalizedView;
      el.classList.toggle("projects-rail-item--active", isActive);
    });
}

// Switch view
function switchView(view, triggerEl = null) {
  const requestedView = view === "profile" ? "settings" : view;
  const isSettingsView = requestedView === "settings";
  const primaryView = isSettingsView ? "todos" : requestedView;

  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document
    .querySelectorAll(".nav-tab")
    .forEach((t) => t.classList.remove("active"));

  const targetView = document.getElementById(primaryView + "View");
  if (!(targetView instanceof HTMLElement)) {
    return;
  }
  targetView.classList.add("active");
  if (triggerEl) {
    triggerEl.classList.add("active");
  }
  if (
    !isSettingsView &&
    (!(triggerEl instanceof HTMLElement) ||
      !triggerEl.classList.contains("nav-tab"))
  ) {
    const matchingTab = document.querySelector(
      `.nav-tab[data-onclick*="switchView('${primaryView}'"]`,
    );
    if (matchingTab instanceof HTMLElement) {
      matchingTab.classList.add("active");
    }
  }
  setTodosViewBodyState(primaryView === "todos");
  setSettingsPaneVisible(isSettingsView);
  syncSidebarNavState(requestedView);

  if (isSettingsView) {
    closeCommandPalette({ restoreFocus: false });
    closeProjectCrudModal({ restoreFocus: false });
    closeMoreFilters();
    closeProjectsRailSheet({ restoreFocus: false });
    closeTodoDrawer({ restoreFocus: false });
    updateUserDisplay();
  } else if (requestedView === "todos") {
    closeCommandPalette({ restoreFocus: false });
    closeProjectCrudModal({ restoreFocus: false });
    closeMoreFilters();
    closeProjectsRailSheet({ restoreFocus: false });
    setAiWorkspaceCollapsed(readStoredAiWorkspaceCollapsedState(), {
      persist: false,
    });
    loadTodos();
    loadAiSuggestions();
    loadAiUsage();
    loadAiInsights();
    loadAiFeedbackSummary();
  } else if (requestedView === "admin") {
    closeCommandPalette({ restoreFocus: false });
    closeProjectCrudModal({ restoreFocus: false });
    closeMoreFilters();
    closeProjectsRailSheet({ restoreFocus: false });
    closeTodoDrawer({ restoreFocus: false });
    loadAdminUsers();
  }
}

function shouldIgnoreTodoDrawerOpen(target) {
  if (!(target instanceof Element)) return true;
  return !!target.closest(
    "input, button, select, textarea, a, label, [data-onclick], [data-onchange], .drag-handle, .todo-inline-actions, .subtasks-section, .todo-kebab, .todo-kebab-menu",
  );
}

function bindTodoDrawerHandlers() {
  if (window.__todoDrawerHandlersBound) {
    return;
  }
  window.__todoDrawerHandlersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (
      openTodoKebabId &&
      !target.closest(".todo-kebab") &&
      !target.closest(".todo-kebab-menu")
    ) {
      closeTodoKebabMenu();
      return;
    }

    const closeBtn = target.closest("#todoDrawerClose");
    if (closeBtn) {
      closeTodoDrawer({ restoreFocus: true });
      return;
    }

    const backdrop = target.closest("#todoDrawerBackdrop");
    if (backdrop) {
      closeTodoDrawer({ restoreFocus: true });
      return;
    }

    const detailsToggle = target.closest("#drawerDetailsToggle");
    if (detailsToggle) {
      toggleDrawerDetailsPanel();
      return;
    }

    const drawerDeleteBtn = target.closest("#drawerDeleteTodoButton");
    if (drawerDeleteBtn) {
      deleteTodoFromDrawer();
      return;
    }

    // Lint chip Fix/Review delegation (task-drawer surface).
    // Scope by checking ancestry inside #todoDetailsDrawer so this doesn't
    // fire for on-create lint chips that use the same data-ai-lint-action attr.
    if (target.closest("#todoDetailsDrawer")) {
      const drawerLintEl = target.closest("[data-ai-lint-action]");
      if (drawerLintEl instanceof HTMLElement) {
        const lintAction = drawerLintEl.getAttribute("data-ai-lint-action");
        taskDrawerAssistState.showFullAssist = true;
        renderTodoDrawerContent();
        if (selectedTodoId) {
          loadTaskDrawerDecisionAssist(selectedTodoId, lintAction === "fix");
        }
        return;
      }
    }

    const drawerAiAction = target.closest("[data-drawer-ai-action]");
    if (drawerAiAction instanceof HTMLElement) {
      const action = drawerAiAction.getAttribute("data-drawer-ai-action");
      const suggestionId =
        drawerAiAction.getAttribute("data-drawer-ai-suggestion-id") || "";
      if (action === "apply") {
        applyTaskDrawerSuggestion(suggestionId, false);
      } else if (action === "confirm-apply") {
        applyTaskDrawerSuggestion(suggestionId, true);
      } else if (action === "cancel-confirm") {
        taskDrawerAssistState.confirmSuggestionId = "";
        renderTodoDrawerContent();
      } else if (action === "dismiss") {
        dismissTaskDrawerSuggestions(suggestionId);
      } else if (action === "undo") {
        undoTaskDrawerSuggestion(suggestionId);
      }
      return;
    }

    const row = target.closest(".todo-item");
    if (!(row instanceof HTMLElement)) return;
    if (shouldIgnoreTodoDrawerOpen(target)) return;

    const todoId = row.dataset.todoId;
    if (!todoId) return;
    openTodoDrawer(todoId, row);
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "drawerTitleInput") {
      onDrawerTitleInput(event);
      return;
    }
    if (target.id === "drawerDescriptionTextarea") {
      onDrawerDescriptionInput(event);
      return;
    }
    if (target.id === "drawerNotesTextarea") {
      onDrawerNotesInput(event);
      return;
    }
    if (target.id === "drawerCategoryInput") {
      onDrawerCategoryInput(event);
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "drawerCompletedToggle") {
      onDrawerCompletedChange(event);
      return;
    }
    if (target.id === "drawerDueDateInput") {
      onDrawerDueDateChange(event);
      return;
    }
    if (target.id === "drawerProjectSelect") {
      onDrawerProjectChange(event);
      return;
    }
    if (target.id === "drawerPrioritySelect") {
      onDrawerPriorityChange(event);
      return;
    }
    if (target.id === "drawerDescriptionTextarea") {
      onDrawerDescriptionBlur();
      return;
    }
  });

  document.addEventListener(
    "blur",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id === "drawerTitleInput") {
        onDrawerTitleBlur();
        return;
      }
      if (target.id === "drawerDescriptionTextarea") {
        onDrawerDescriptionBlur();
        return;
      }
      if (target.id === "drawerNotesTextarea") {
        onDrawerNotesBlur();
        return;
      }
      if (target.id === "drawerCategoryInput") {
        onDrawerCategoryBlur();
      }
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.id === "drawerDescriptionTextarea"
    ) {
      onDrawerDescriptionKeydown(event);
      return;
    }
    if (target instanceof HTMLElement && target.id === "drawerNotesTextarea") {
      onDrawerNotesKeydown(event);
      return;
    }
    if (target instanceof HTMLElement && target.id === "drawerTitleInput") {
      onDrawerTitleKeydown(event);
      return;
    }

    if (event.key === "Escape" && taskDrawerAssistState.confirmSuggestionId) {
      const active = event.target;
      if (active instanceof Element && active.closest("#todoDetailsDrawer")) {
        taskDrawerAssistState.confirmSuggestionId = "";
        renderTodoDrawerContent();
        event.preventDefault();
        return;
      }
    }

    if (event.key !== "Enter") return;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("todo-item")) return;
    if (target.closest("#todoDetailsDrawer")) return;

    const todoId = target.dataset.todoId;
    if (!todoId) return;
    event.preventDefault();
    openTodoDrawer(todoId, target);
  });
}

function bindProjectsRailHandlers() {
  if (window.__projectsRailHandlersBound) {
    return;
  }
  window.__projectsRailHandlersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const menuToggle = target.closest("[data-project-menu-toggle]");
    if (menuToggle instanceof HTMLElement) {
      const projectName =
        menuToggle.getAttribute("data-project-menu-toggle") || "";
      event.preventDefault();
      event.stopPropagation();
      toggleRailProjectMenu(projectName, menuToggle);
      return;
    }

    const menuAction = target.closest("[data-project-menu-action]");
    if (menuAction instanceof HTMLElement) {
      const action = menuAction.getAttribute("data-project-menu-action");
      const projectName = menuAction.getAttribute("data-project-key") || "";
      event.preventDefault();
      event.stopPropagation();
      if (action === "rename") {
        closeRailProjectMenu();
        openProjectCrudModal("rename", menuAction, projectName);
      } else if (action === "delete") {
        closeRailProjectMenu({ restoreFocus: false });
        deleteProjectByName(projectName);
      }
      return;
    }

    if (
      openRailProjectMenuKey &&
      !target.closest(".projects-rail-kebab") &&
      !target.closest(".projects-rail-menu")
    ) {
      closeRailProjectMenu();
    }

    const workspaceViewButton = target.closest(
      ".workspace-view-item[data-workspace-view]",
    );
    if (workspaceViewButton instanceof HTMLElement) {
      const view = workspaceViewButton.getAttribute("data-workspace-view");
      event.preventDefault();
      event.stopPropagation();
      selectWorkspaceView(view, workspaceViewButton);
      return;
    }

    const projectButton = target.closest(
      ".projects-rail-item[data-project-key]",
    );
    if (projectButton instanceof HTMLElement) {
      const projectName = projectButton.getAttribute("data-project-key") || "";
      event.preventDefault();
      event.stopPropagation();
      selectProjectFromRail(projectName, projectButton);
      return;
    }

    const createButton = target.closest("#projectsRailCreateButton");
    if (createButton) {
      event.preventDefault();
      event.stopPropagation();
      openProjectCrudModal("create", createButton);
      return;
    }

    const sheetCreateButton = target.closest("#projectsRailSheetCreateButton");
    if (sheetCreateButton) {
      event.preventDefault();
      event.stopPropagation();
      openProjectCrudModal("create", sheetCreateButton);
      return;
    }

    const backdrop = target.closest("#projectsRailBackdrop");
    if (backdrop && isRailSheetOpen) {
      event.preventDefault();
      closeProjectsRailSheet({ restoreFocus: true });
      return;
    }

    const mobileClose = target.closest("#projectsRailMobileClose");
    if (mobileClose && isRailSheetOpen) {
      event.preventDefault();
      closeProjectsRailSheet({ restoreFocus: true });
      return;
    }

    const modalOverlay = target.closest("#projectCrudModal");
    if (
      modalOverlay &&
      target instanceof HTMLElement &&
      target.id === "projectCrudModal"
    ) {
      event.preventDefault();
      closeProjectCrudModal();
      return;
    }

    const modalCancel = target.closest("#projectCrudCancelButton");
    if (modalCancel && isProjectCrudModalOpen) {
      event.preventDefault();
      closeProjectCrudModal();
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id !== "projectCrudForm") return;
    event.preventDefault();
    submitProjectCrudModal();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const refs = getProjectsRailElements();
    if (!refs) return;

    const inDesktopRail = refs.desktopRail.contains(target);
    const inSheetRail = refs.sheet.contains(target);
    if (!inDesktopRail && !inSheetRail) return;
    if (target.closest(".projects-rail-menu")) return;

    const root = inSheetRail ? refs.sheet : refs.desktopRail;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveRailOptionFocus(root, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveRailOptionFocus(root, -1);
      return;
    }

    if (event.key === "Enter") {
      const focusedWorkspaceView = target.closest(
        ".workspace-view-item[data-workspace-view]",
      );
      if (focusedWorkspaceView instanceof HTMLElement) {
        event.preventDefault();
        const view =
          focusedWorkspaceView.getAttribute("data-workspace-view") || "all";
        selectWorkspaceView(view, focusedWorkspaceView);
        return;
      }

      const focusedOption = target.closest(
        ".projects-rail-item[data-project-key]",
      );
      if (!(focusedOption instanceof HTMLElement)) return;
      event.preventDefault();
      const projectName = focusedOption.getAttribute("data-project-key") || "";
      selectProjectFromRail(projectName, focusedOption);
      return;
    }

    if (event.key === "Escape" && inSheetRail && isRailSheetOpen) {
      event.preventDefault();
      closeProjectsRailSheet({ restoreFocus: true });
      return;
    }

    if (event.key === "Escape" && inDesktopRail) {
      event.preventDefault();
      refs.collapseToggle.focus({ preventScroll: true });
    }
  });
}

function bindCommandPaletteHandlers() {
  if (window.__commandPaletteHandlersBound) {
    return;
  }
  window.__commandPaletteHandlersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const overlay = target.closest("#commandPaletteOverlay");
    if (
      overlay instanceof HTMLElement &&
      target.id === "commandPaletteOverlay"
    ) {
      closeCommandPalette({ restoreFocus: true });
      return;
    }

    if (!isCommandPaletteOpen) return;

    const option = target.closest("[data-command-id]");
    if (!(option instanceof HTMLElement)) return;
    event.preventDefault();
    const itemIndex = Number.parseInt(
      option.getAttribute("data-command-index") || "-1",
      10,
    );
    if (itemIndex < 0) return;
    executeCommandPaletteItem(commandPaletteSelectableItems[itemIndex], option);
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== "commandPaletteInput") return;
    commandPaletteQuery =
      target instanceof HTMLInputElement ? target.value : String(target.value);
    commandPaletteIndex = 0;
    renderCommandPalette();
  });
}

function bindCriticalHandlers() {
  const bindClick = (id, handler) => {
    const element = document.getElementById(id);
    if (!element || element.dataset.bound === "true") {
      return;
    }
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler(element, event);
    });
    element.dataset.bound = "true";
  };

  bindClick("loginTabButton", (element) => {
    switchAuthTab("login", element);
  });

  bindClick("registerTabButton", (element) => {
    switchAuthTab("register", element);
  });

  bindClick("forgotPasswordLink", () => {
    showForgotPassword();
  });

  bindClick("forgotBackToLoginButton", () => {
    showLogin();
  });

  bindClick("moreFiltersToggle", () => {
    toggleMoreFilters();
  });

  bindClick("projectsRailToggle", () => {
    setProjectsRailCollapsed(!isRailCollapsed);
  });

  bindClick("projectsRailMobileOpen", (element) => {
    openProjectsFromTopbar(element);
  });

  bindClick("projectsRailMobileClose", () => {
    closeProjectsRailSheet({ restoreFocus: true });
  });

  bindClick("quickEntryPropertiesToggle", () => {
    setQuickEntryPropertiesOpen(!isQuickEntryPropertiesOpen);
  });

  bindClick("aiWorkspaceToggle", () => {
    toggleAiWorkspace();
  });

  const todoProjectSelect = document.getElementById("todoProjectSelect");
  if (todoProjectSelect && todoProjectSelect.dataset.bound !== "true") {
    todoProjectSelect.addEventListener("change", () => {
      syncQuickEntryProjectActions();
    });
    todoProjectSelect.dataset.bound = "true";
  }

  const resendBtn = document.getElementById("resendVerificationButton");
  if (resendBtn && !resendBtn.dataset.bound) {
    resendBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      resendVerification();
    });
    resendBtn.dataset.bound = "true";
  }
}

// Logout
async function logout() {
  const { refreshToken: storedRefreshToken } = loadStoredSession();
  const tokenToRevoke = refreshToken || storedRefreshToken;

  if (tokenToRevoke) {
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenToRevoke }),
    }).catch((error) => {
      console.error("Logout token revocation failed:", error);
    });
  }

  authToken = null;
  refreshToken = null;
  currentUser = null;
  setAuthState(AUTH_STATE.UNAUTHENTICATED);
  persistSession({ authToken, refreshToken, currentUser });
  todos = [];
  aiSuggestions = [];
  aiUsage = null;
  aiInsights = null;
  aiFeedbackSummary = null;
  customProjects = [];
  projectRecords = [];
  openRailProjectMenuKey = null;
  isProjectCrudModalOpen = false;
  projectCrudTargetProject = "";
  editingTodoId = null;
  latestCritiqueSuggestionId = null;
  latestCritiqueResult = null;
  latestPlanSuggestionId = null;
  latestPlanResult = null;
  currentDateView = "all";
  todosLoadState = "idle";
  todosLoadErrorMessage = "";
  openTodoKebabId = null;
  selectedTodos.clear();
  if (undoTimeout) {
    clearTimeout(undoTimeout);
    undoTimeout = null;
  }
  undoStack = [];
  document.getElementById("undoToast")?.classList.remove("active");
  clearFilters();
  clearPlanDraftState();
  resetOnCreateAssistState();
  resetTodayPlanState();
  renderOnCreateAssistRow();
  renderTodayPlanPanel();
  closeCommandPalette({ restoreFocus: false });
  closeProjectCrudModal({ restoreFocus: false });
  closeProjectsRailSheet({ restoreFocus: false });
  closeTodoDrawer({ restoreFocus: false });
  showAuthView();
}

// Show app view
function showAppView() {
  setTodosViewBodyState(true);
  setSettingsPaneVisible(false);
  document.getElementById("authView").classList.remove("active");
  document.getElementById("todosView").classList.add("active");
  document.getElementById("navTabs").style.display = "flex";
  document.getElementById("userBar").style.display = "flex";
  document.querySelectorAll(".nav-tab")[0].classList.add("active");
  syncSidebarNavState("todos");
  closeCommandPalette({ restoreFocus: false });
  closeProjectCrudModal({ restoreFocus: false });
  openRailProjectMenuKey = null;
  closeMoreFilters();
  closeProjectsRailSheet({ restoreFocus: false });
  setProjectsRailCollapsed(readStoredRailCollapsedState());
  setAiWorkspaceVisible(readStoredAiWorkspaceVisibleState(), {
    persist: false,
  });
  setAiWorkspaceCollapsed(readStoredAiWorkspaceCollapsedState(), {
    persist: false,
  });
  closeTodoDrawer({ restoreFocus: false });
  // Prevent previous account data from flashing while fetching current user's data.
  todos = [];
  todosLoadState = "loading";
  todosLoadErrorMessage = "";
  openTodoKebabId = null;
  critiqueRequestsInFlight = 0;
  updateCritiqueDraftButtonState();
  selectedTodos.clear();
  loadCustomProjects();
  renderTodos();
  updateCategoryFilter();
  loadProjects();
  loadTodos();
  loadAiSuggestions();
  loadAiUsage();
  loadAiInsights();
  loadAiFeedbackSummary();
  resetOnCreateAssistState();
  resetTodayPlanState();
  renderOnCreateAssistRow();
  renderTodayPlanPanel();
  setQuickEntryPropertiesOpen(false);
  syncQuickEntryProjectActions();
}

// Show auth view
function showAuthView() {
  setTodosViewBodyState(false);
  setSettingsPaneVisible(false);
  document.getElementById("authView").classList.add("active");
  document.getElementById("todosView").classList.remove("active");
  document.getElementById("profileView").classList.remove("active");
  document.getElementById("adminView").classList.remove("active");
  document.getElementById("navTabs").style.display = "none";
  document.getElementById("userBar").style.display = "none";
  document.getElementById("adminNavTab").style.display = "none";
  document.body.classList.remove("is-admin-user");
  syncSidebarNavState("");
  adminBootstrapAvailable = false;
  closeCommandPalette({ restoreFocus: false });
  closeProjectCrudModal({ restoreFocus: false });
  openRailProjectMenuKey = null;
  closeMoreFilters();
  closeProjectsRailSheet({ restoreFocus: false });
  closeTodoDrawer({ restoreFocus: false });
  critiqueRequestsInFlight = 0;
  updateCritiqueDraftButtonState();
  resetOnCreateAssistState();
  resetTodayPlanState();
  renderOnCreateAssistRow();
  renderTodayPlanPanel();
  showLogin();
}

// showMessage, hideMessage, escapeHtml — from utils.js
// toggleTheme, initTheme — from theme.js

// ========== PHASE E: SERVICE WORKER REGISTRATION ==========
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const shouldRegister =
      window.location.protocol === "https:" &&
      window.location.hostname !== "localhost";

    if (!shouldRegister) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
      return;
    }

    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log(
          "Service Worker registered successfully:",
          registration.scope,
        );
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  });
}

function invokeBoundExpression(expression, event, element) {
  const source = expression.trim().replace(/;$/, "");
  if (!source) return;

  const eventMethodMatch = source.match(/^event\.([A-Za-z_$][\w$]*)\(\)$/);
  if (eventMethodMatch) {
    const methodName = eventMethodMatch[1];
    const method = event?.[methodName];
    if (typeof method === "function") {
      method.call(event);
    }
    return;
  }

  const callMatch = source.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
  if (!callMatch) return;

  const functionName = callMatch[1];
  const rawArgs = callMatch[2].trim();
  const target = window[functionName];
  if (typeof target !== "function") return;

  const tokens =
    rawArgs === "" ? [] : rawArgs.match(/'[^']*'|\"[^\"]*\"|[^,]+/g) || [];
  const args = tokens.map((token) => {
    const arg = token.trim();
    if (arg === "event") return event;
    if (arg === "this") return element;
    if (/^'.*'$/.test(arg) || /^\".*\"$/.test(arg)) return arg.slice(1, -1);
    if (arg === "true") return true;
    if (arg === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(arg)) return Number(arg);
    return arg;
  });

  target(...args);
}

function bindDeclarativeHandlers() {
  if (window.__declarativeHandlersBound) {
    return;
  }
  window.__declarativeHandlersBound = true;

  const events = [
    "click",
    "submit",
    "input",
    "change",
    "keypress",
    "dragstart",
    "dragover",
    "drop",
    "dragend",
  ];

  for (const eventType of events) {
    const attribute = `on${eventType}`;
    document.addEventListener(eventType, (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const element = target.closest(`[data-${attribute}]`);
      if (!element) return;
      const expression = element.dataset[attribute];
      if (!expression) return;
      invokeBoundExpression(expression, event, element);
    });
  }
}

// ---------------------------------------------------------------------------
// Window bridge — functions consumed from modules that must remain on window
// because they are referenced via data-onclick / data-onsubmit in HTML.
// ---------------------------------------------------------------------------
window.toggleTheme = toggleTheme;

// Initialize theme immediately
initTheme();

// Initialize on load
bindDeclarativeHandlers();
init();
