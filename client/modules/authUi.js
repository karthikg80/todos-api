// =============================================================================
// authUi.js — Authentication UI flows: login, register, logout, profile.
// Depends on: store.js, featureFlags.js, window.AppState, window.Utils,
//             hooks (wired by app.js for cross-module calls).
// =============================================================================
import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";
import { clearHomeListDrilldown, clearFilters } from "./filterLogic.js";
import {
  closeProjectCrudModal,
  closeProjectEditDrawer,
  closeProjectDeleteDialog,
  loadCustomProjects,
  loadProjects,
  updateCategoryFilter,
} from "./projectsState.js";
import { loadTodos } from "./todosService.js";
import { closeTodoDrawer } from "./drawerUi.js";

const { showMessage, hideMessage } = window.Utils || {};

// =============================================================================
// Auth bootstrap helpers (used by app.js for apiClient setup)
// =============================================================================

export function setAuthState(nextState) {
  state.authState = nextState;
}

export function handleAuthFailure() {
  logout();
}

export function handleAuthTokens(nextToken, nextRefreshToken) {
  const { persistSession } = window.AppState || {};
  state.authToken = nextToken;
  state.refreshToken = nextRefreshToken;
  if (persistSession) {
    persistSession({
      authToken: state.authToken,
      refreshToken: state.refreshToken,
      currentUser: state.currentUser,
    });
  }
}

// =============================================================================
// Auth tab / form navigation
// =============================================================================

export function switchAuthTab(tab, triggerEl) {
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

export function showForgotPassword() {
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));
  document.getElementById("forgotPasswordForm").style.display = "block";
  document
    .querySelectorAll(".auth-tab")
    .forEach((t) => t.classList.remove("active"));
  hideMessage("authMessage");
}

export function showLogin() {
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));
  document.getElementById("loginForm").style.display = "block";
  document.querySelectorAll(".auth-tab")[0].classList.add("active");
  hideMessage("authMessage");
}

export function showResetPassword(token) {
  document.getElementById("resetPasswordForm").dataset.token = token;
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));
  document.getElementById("resetPasswordForm").style.display = "block";
}

// =============================================================================
// Verification URL handling
// =============================================================================

export function handleVerificationStatusFromUrl() {
  const { persistSession } = window.AppState || {};
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

  if (state.currentUser) {
    if (isSuccess) {
      state.currentUser = { ...state.currentUser, isVerified: true };
      if (persistSession) {
        persistSession({
          authToken: state.authToken,
          refreshToken: state.refreshToken,
          currentUser: state.currentUser,
        });
      }
      updateUserDisplay();
    }
    const profileTab = document.querySelectorAll(".nav-tab")[1];
    hooks.switchView?.("profile", profileTab || null);
    showMessage("profileMessage", message, type);
  } else {
    showLogin();
    showMessage("authMessage", message, type);
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

// =============================================================================
// Login / Register / Forgot Password / Reset Password
// =============================================================================

export async function handleLogin(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const { AUTH_STATE, persistSession } = window.AppState || {};
  const API_URL = hooks.API_URL;

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
      state.authToken = data.token;
      state.refreshToken = data.refreshToken;
      state.currentUser = data.user;
      setAuthState(AUTH_STATE.AUTHENTICATED);
      if (persistSession) {
        persistSession({
          authToken: state.authToken,
          refreshToken: state.refreshToken,
          currentUser: state.currentUser,
        });
      }
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

export async function handleRegister(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const { AUTH_STATE, persistSession } = window.AppState || {};
  const API_URL = hooks.API_URL;

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
      state.authToken = data.token;
      state.refreshToken = data.refreshToken;
      state.currentUser = data.user;
      setAuthState(AUTH_STATE.AUTHENTICATED);
      if (persistSession) {
        persistSession({
          authToken: state.authToken,
          refreshToken: state.refreshToken,
          currentUser: state.currentUser,
        });
      }
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

export async function handleForgotPassword(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const { EMAIL_ACTION_TIMEOUT_MS } = window.AppState || {};
  const API_URL = hooks.API_URL;
  const fetchWithTimeout = hooks.fetchWithTimeout;
  const parseApiBody = hooks.parseApiBody;
  const isAbortError = hooks.isAbortError;

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

export async function handleResetPassword(event) {
  event.preventDefault();
  hideMessage("authMessage");

  const API_URL = hooks.API_URL;

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

// =============================================================================
// User profile
// =============================================================================

export async function loadUserProfile() {
  const { persistSession } = window.AppState || {};
  const apiCall = hooks.apiCall;
  const API_URL = hooks.API_URL;

  try {
    const response = await apiCall(`${API_URL}/users/me`);
    if (response && response.ok) {
      const user = await response.json();
      state.currentUser = { ...state.currentUser, ...user };
      if (persistSession) {
        persistSession({
          authToken: state.authToken,
          refreshToken: state.refreshToken,
          currentUser: state.currentUser,
        });
      }
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

export function updateUserDisplay() {
  document.getElementById("userEmail").textContent = state.currentUser.email;

  const verifiedBadge = document.getElementById("verifiedBadge");
  if (state.currentUser.isVerified) {
    verifiedBadge.className = "verified-badge";
    verifiedBadge.textContent = "✓ Verified";
    verifiedBadge.style.display = "inline-flex";
  } else {
    verifiedBadge.className = "unverified-badge";
    verifiedBadge.textContent = "";
    verifiedBadge.style.display = "none";
  }

  const adminBadge = document.getElementById("adminBadge");
  const isAdmin = state.currentUser.role === "admin";
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
  document.getElementById("profileEmail").textContent = state.currentUser.email;
  document.getElementById("profileName").textContent =
    state.currentUser.name || "Not set";
  document.getElementById("profileStatus").textContent = state.currentUser
    .isVerified
    ? "Verified ✓"
    : "Not Verified";
  document.getElementById("profileCreated").textContent = new Date(
    state.currentUser.createdAt,
  ).toLocaleDateString();
  document.getElementById("updateName").value = state.currentUser.name || "";
  document.getElementById("updateEmail").value = state.currentUser.email;

  // Show/hide verification banner — only show when explicitly not verified.
  // Using === false guards against isVerified being undefined (e.g. when the
  // login response omits the field before loadUserProfile() resolves).
  const verificationBanner = document.getElementById("verificationBanner");
  if (verificationBanner) {
    verificationBanner.style.display =
      state.currentUser.isVerified === false ? "block" : "none";
  }

  const adminBootstrapSection = document.getElementById(
    "adminBootstrapSection",
  );
  if (adminBootstrapSection) {
    const shouldShow =
      state.adminBootstrapAvailable && state.currentUser.role !== "admin";
    adminBootstrapSection.style.display = shouldShow ? "block" : "none";
  }
}

export async function loadAdminBootstrapStatus() {
  const apiCall = hooks.apiCall;
  const API_URL = hooks.API_URL;

  state.adminBootstrapAvailable = false;

  if (!state.currentUser || state.currentUser.role === "admin") {
    updateUserDisplay();
    return;
  }

  try {
    const response = await apiCall(`${API_URL}/auth/bootstrap-admin/status`);
    if (response && response.ok) {
      const status = await response.json();
      state.adminBootstrapAvailable = !!status.enabled;
    }
  } catch (error) {
    console.error("Load bootstrap status error:", error);
  } finally {
    updateUserDisplay();
  }
}

export async function handleAdminBootstrap(event) {
  event.preventDefault();
  hideMessage("profileMessage");

  const { persistSession } = window.AppState || {};
  const apiCall = hooks.apiCall;
  const API_URL = hooks.API_URL;

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
      state.currentUser = { ...state.currentUser, ...data.user };
      if (persistSession) {
        persistSession({
          authToken: state.authToken,
          refreshToken: state.refreshToken,
          currentUser: state.currentUser,
        });
      }
      state.adminBootstrapAvailable = false;
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
      state.adminBootstrapAvailable = false;
      updateUserDisplay();
    }
  } catch (error) {
    showMessage("profileMessage", "Network error. Please try again.", "error");
    console.error("Bootstrap admin error:", error);
  }
}

export async function resendVerification() {
  hideMessage("profileMessage");

  const { EMAIL_ACTION_TIMEOUT_MS } = window.AppState || {};
  const API_URL = hooks.API_URL;
  const apiCallWithTimeout = hooks.apiCallWithTimeout;
  const parseApiBody = hooks.parseApiBody;
  const isAbortError = hooks.isAbortError;

  if (!state.currentUser || !state.currentUser.email) {
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
        body: JSON.stringify({ email: state.currentUser.email }),
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

export async function handleUpdateProfile(event) {
  event.preventDefault();
  hideMessage("profileMessage");

  const { persistSession } = window.AppState || {};
  const apiCall = hooks.apiCall;
  const parseApiBody = hooks.parseApiBody;
  const API_URL = hooks.API_URL;

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
      state.currentUser = { ...state.currentUser, ...updatedUser };
      if (persistSession) {
        persistSession({
          authToken: state.authToken,
          refreshToken: state.refreshToken,
          currentUser: state.currentUser,
        });
      }
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

// =============================================================================
// Logout
// =============================================================================

export async function logout() {
  const { AUTH_STATE, loadStoredSession, persistSession } =
    window.AppState || {};
  const API_URL = hooks.API_URL;

  const { refreshToken: storedRefreshToken } = loadStoredSession
    ? loadStoredSession()
    : {};
  const tokenToRevoke = state.refreshToken || storedRefreshToken;

  if (tokenToRevoke) {
    fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenToRevoke }),
    }).catch((error) => {
      console.error("Logout token revocation failed:", error);
    });
  }

  state.authToken = null;
  state.refreshToken = null;
  state.currentUser = null;
  setAuthState(AUTH_STATE.UNAUTHENTICATED);
  if (persistSession) {
    persistSession({
      authToken: state.authToken,
      refreshToken: state.refreshToken,
      currentUser: state.currentUser,
    });
  }
  state.todos = [];
  state.aiSuggestions = [];
  state.aiUsage = null;
  state.aiInsights = null;
  state.aiFeedbackSummary = null;
  state.customProjects = [];
  state.projectRecords = [];
  state.projectHeadingsByProjectId = new Map();
  state.openRailProjectMenuKey = null;
  state.isProjectCrudModalOpen = false;
  state.projectCrudTargetProject = "";
  state.isProjectEditDrawerOpen = false;
  state.projectEditTargetProject = "";
  state.projectDeleteDialogState = null;
  state.editingTodoId = null;
  state.latestCritiqueSuggestionId = null;
  state.latestCritiqueResult = null;
  state.latestPlanSuggestionId = null;
  state.latestPlanResult = null;
  state.currentDateView = "all";
  state.currentWorkspaceView = "home";
  clearHomeListDrilldown();
  state.todosLoadState = "idle";
  state.todosLoadErrorMessage = "";
  state.openTodoKebabId = null;
  state.selectedTodos.clear();
  if (state.undoTimeout) {
    clearTimeout(state.undoTimeout);
    state.undoTimeout = null;
  }
  state.undoStack = [];
  document.getElementById("undoToast")?.classList.remove("active");
  clearFilters();
  hooks.clearPlanDraftState?.();
  hooks.resetOnCreateAssistState?.();
  hooks.resetTodayPlanState?.();
  hooks.renderOnCreateAssistRow?.();
  hooks.renderTodayPlanPanel?.();
  hooks.closeCommandPalette?.({ restoreFocus: false });
  closeProjectCrudModal({ restoreFocus: false });
  closeProjectEditDrawer({ restoreFocus: false });
  closeProjectDeleteDialog();
  hooks.closeProjectsRailSheet?.({ restoreFocus: false });
  hooks.closeTaskComposer?.({ restoreFocus: false, force: true, reset: true });
  closeTodoDrawer({ restoreFocus: false });
  showAuthView();
}

// =============================================================================
// App view / auth view transitions
// =============================================================================

export function showAppView() {
  hooks.setTodosViewBodyState?.(true);
  hooks.setSettingsPaneVisible?.(false);
  document.getElementById("authView").classList.remove("active");
  document.getElementById("todosView").classList.add("active");
  document.getElementById("navTabs").style.display = "flex";
  document.getElementById("userBar").style.display = "flex";
  document.querySelectorAll(".nav-tab")[0].classList.add("active");
  hooks.syncSidebarNavState?.("todos");
  hooks.closeCommandPalette?.({ restoreFocus: false });
  closeProjectCrudModal({ restoreFocus: false });
  closeProjectEditDrawer({ restoreFocus: false });
  closeProjectDeleteDialog();
  state.openRailProjectMenuKey = null;
  hooks.closeMoreFilters?.();
  hooks.closeProjectsRailSheet?.({ restoreFocus: false });
  hooks.closeTaskComposer?.({ restoreFocus: false, force: true, reset: true });
  hooks.setProjectsRailCollapsed?.(hooks.readStoredRailCollapsedState?.());
  hooks.setAiWorkspaceVisible?.(hooks.readStoredAiWorkspaceVisibleState?.(), {
    persist: false,
  });
  hooks.setAiWorkspaceCollapsed?.(
    hooks.readStoredAiWorkspaceCollapsedState?.(),
    {
      persist: false,
    },
  );
  closeTodoDrawer({ restoreFocus: false });
  // Prevent previous account data from flashing while fetching current user's data.
  state.todos = [];
  state.todosLoadState = "loading";
  state.todosLoadErrorMessage = "";
  state.openTodoKebabId = null;
  state.critiqueRequestsInFlight = 0;
  hooks.updateCritiqueDraftButtonState?.();
  state.selectedTodos.clear();
  loadCustomProjects();
  state.currentWorkspaceView = "home";
  clearHomeListDrilldown();
  EventBus.dispatch("todos:changed", { reason: "state-changed" });
  updateCategoryFilter();
  loadProjects();
  loadTodos();
  hooks.loadAiSuggestions?.();
  hooks.loadAiUsage?.();
  hooks.loadAiInsights?.();
  hooks.loadAiFeedbackSummary?.();
  hooks.resetOnCreateAssistState?.();
  hooks.resetTodayPlanState?.();
  hooks.renderOnCreateAssistRow?.();
  hooks.renderTodayPlanPanel?.();
  hooks.setQuickEntryPropertiesOpen?.(
    hooks.readStoredQuickEntryPropertiesOpenState?.(),
    {
      persist: false,
    },
  );
  if (!state.isQuickEntryPropertiesOpen) {
    hooks.setQuickEntryPropertiesOpen?.(true, { persist: false });
  }
  hooks.syncQuickEntryProjectActions?.();
}

export function showAuthView() {
  hooks.setTodosViewBodyState?.(false);
  hooks.setSettingsPaneVisible?.(false);
  document.getElementById("authView").classList.add("active");
  document.getElementById("todosView").classList.remove("active");
  document.getElementById("profileView").classList.remove("active");
  document.getElementById("adminView").classList.remove("active");
  document.getElementById("navTabs").style.display = "none";
  document.getElementById("userBar").style.display = "none";
  document.getElementById("adminNavTab").style.display = "none";
  document.body.classList.remove("is-admin-user");
  hooks.syncSidebarNavState?.("");
  state.adminBootstrapAvailable = false;
  hooks.closeCommandPalette?.({ restoreFocus: false });
  closeProjectCrudModal({ restoreFocus: false });
  closeProjectEditDrawer({ restoreFocus: false });
  closeProjectDeleteDialog();
  state.openRailProjectMenuKey = null;
  hooks.closeMoreFilters?.();
  hooks.closeProjectsRailSheet?.({ restoreFocus: false });
  closeTodoDrawer({ restoreFocus: false });
  state.critiqueRequestsInFlight = 0;
  hooks.updateCritiqueDraftButtonState?.();
  hooks.resetOnCreateAssistState?.();
  hooks.resetTodayPlanState?.();
  hooks.renderOnCreateAssistRow?.();
  hooks.renderTodayPlanPanel?.();
  showLogin();
}
