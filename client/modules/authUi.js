// =============================================================================
// authUi.js — Authentication UI flows: login, register, logout, profile.
// Depends on: store.js, featureFlags.js, window.AppState, window.Utils,
//             hooks (wired by app.js for cross-module calls).
// =============================================================================
import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";
import { TODOS_CHANGED } from "../platform/events/eventTypes.js";
import { STATE_CHANGED } from "../platform/events/eventReasons.js";
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
import { transitionViews } from "../utils/viewTransitions.js";
import { initOnboarding } from "./onboardingFlow.js";
import {
  SOUL_PROFILE_DEFAULTS,
  normalizeSoulProfile,
  SOUL_COPY,
} from "./soulConfig.js";

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
  const validTabs = [
    "login",
    "register",
    "phoneLogin",
    "forgotPassword",
    "resetPassword",
  ];
  if (!validTabs.includes(tab)) return;

  document.querySelectorAll(".auth-tab").forEach((t) => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));

  if (triggerEl) {
    triggerEl.classList.add("active");
    triggerEl.setAttribute("aria-selected", "true");
  } else {
    // Activate the matching tab button when called without a trigger (e.g., from landing page)
    const tabBtn = document.getElementById(tab + "TabButton");
    if (tabBtn) {
      tabBtn.classList.add("active");
      tabBtn.setAttribute("aria-selected", "true");
    }
  }
  const targetForm = document.getElementById(tab + "Form");
  if (targetForm) {
    targetForm.style.display = "block";
    const firstInput = targetForm.querySelector("input");
    if (firstInput) firstInput.focus();
  }
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

  const submitBtn = document.querySelector("#loginForm button[type='submit']");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn._origText = submitBtn.textContent;
    submitBtn.textContent = "Signing in…";
  }

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
      loadUserProfile().then(() => {
        initOnboarding();
      });
    } else {
      showMessage("authMessage", data.error || "Login failed", "error");
    }
  } catch (error) {
    const msg =
      error instanceof TypeError
        ? "Network error — check your connection and try again."
        : "Something went wrong. Please try again.";
    showMessage("authMessage", msg, "error");
    console.error("Login error:", error);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn._origText || "Sign In";
    }
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

  const regBtn = document.querySelector("#registerForm button[type='submit']");
  if (regBtn) {
    regBtn.disabled = true;
    regBtn._origText = regBtn.textContent;
    regBtn.textContent = "Creating account…";
  }

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
        loadUserProfile().then(() => {
          initOnboarding();
        });
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
    const msg =
      error instanceof TypeError
        ? "Network error — check your connection and try again."
        : "Something went wrong. Please try again.";
    showMessage("authMessage", msg, "error");
    console.error("Registration error:", error);
  } finally {
    if (regBtn) {
      regBtn.disabled = false;
      regBtn.textContent = regBtn._origText || "Create Account";
    }
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
      const msg =
        error instanceof TypeError
          ? "Network error — check your connection and try again."
          : "Something went wrong. Please try again.";
      showMessage("authMessage", msg, "error");
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
    const msg =
      error instanceof TypeError
        ? "Network error — check your connection and try again."
        : "Something went wrong. Please try again.";
    showMessage("authMessage", msg, "error");
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
      await loadUserPlanningPreferences();
      await loadAdminBootstrapStatus();

      // Check if admin and show admin tab
      if (user.role === "admin") {
        document.getElementById("adminNavTab").style.display = "block";
      }

      loadLinkedProviders();
    }
  } catch (error) {
    console.error("Load profile error:", error);
  }
}

export function populateSoulPreferencesForm() {
  const prefs = normalizeSoulProfile(
    state.userPlanningPreferences?.soulProfile,
  );

  const toggleCheckboxGroup = (name, selectedValues = []) => {
    document
      .querySelectorAll(`input[name="${name}"]`)
      .forEach((inputElement) => {
        if (!(inputElement instanceof HTMLInputElement)) return;
        inputElement.checked = selectedValues.includes(inputElement.value);
      });
  };

  toggleCheckboxGroup("soulLifeAreas", prefs.lifeAreas);
  toggleCheckboxGroup("soulFailureModes", prefs.failureModes);
  toggleCheckboxGroup("soulGoodDayThemes", prefs.goodDayThemes);

  const planningStyle = document.getElementById("soulPlanningStyle");
  if (planningStyle instanceof HTMLSelectElement) {
    planningStyle.value = prefs.planningStyle;
  }

  const energyPattern = document.getElementById("soulEnergyPattern");
  if (energyPattern instanceof HTMLSelectElement) {
    energyPattern.value = prefs.energyPattern;
  }

  const tone = document.getElementById("soulTone");
  if (tone instanceof HTMLSelectElement) {
    tone.value = prefs.tone;
  }

  const dailyRitual = document.getElementById("soulDailyRitual");
  if (dailyRitual instanceof HTMLSelectElement) {
    dailyRitual.value = prefs.dailyRitual;
  }

  const preview = document.getElementById("soulSupportPreview");
  if (preview instanceof HTMLElement) {
    preview.textContent =
      prefs.tone === "direct"
        ? "You’ll get short, clear prompts and lighter review copy."
        : prefs.tone === "encouraging"
          ? "You’ll get warmer copy when plans drift and when work moves."
          : prefs.tone === "focused"
            ? "You’ll get steadier prompts aimed at clearer next actions."
            : "You’ll get calmer copy and gentler recovery language.";
  }
}

export async function loadUserPlanningPreferences() {
  const apiCall = hooks.apiCall;
  const API_URL = hooks.API_URL;

  try {
    const response = await apiCall(`${API_URL}/preferences`);
    if (!response || !response.ok) return;
    const preferences = await response.json();
    state.userPlanningPreferences = {
      ...(preferences || {}),
      soulProfile: normalizeSoulProfile(preferences?.soulProfile),
    };
    populateSoulPreferencesForm();
  } catch (error) {
    console.error("Load planning preferences error:", error);
    state.userPlanningPreferences = {
      soulProfile: { ...SOUL_PROFILE_DEFAULTS },
    };
    populateSoulPreferencesForm();
  }
}

function readSoulCheckboxValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
    .map((inputElement) =>
      inputElement instanceof HTMLInputElement ? inputElement.value : "",
    )
    .filter(Boolean);
}

function buildSoulProfilePayloadFromForm() {
  const planningStyle = document.getElementById("soulPlanningStyle");
  const energyPattern = document.getElementById("soulEnergyPattern");
  const tone = document.getElementById("soulTone");
  const dailyRitual = document.getElementById("soulDailyRitual");

  return normalizeSoulProfile({
    lifeAreas: readSoulCheckboxValues("soulLifeAreas"),
    failureModes: readSoulCheckboxValues("soulFailureModes"),
    goodDayThemes: readSoulCheckboxValues("soulGoodDayThemes"),
    planningStyle:
      planningStyle instanceof HTMLSelectElement
        ? planningStyle.value
        : SOUL_PROFILE_DEFAULTS.planningStyle,
    energyPattern:
      energyPattern instanceof HTMLSelectElement
        ? energyPattern.value
        : SOUL_PROFILE_DEFAULTS.energyPattern,
    tone:
      tone instanceof HTMLSelectElement
        ? tone.value
        : SOUL_PROFILE_DEFAULTS.tone,
    dailyRitual:
      dailyRitual instanceof HTMLSelectElement
        ? dailyRitual.value
        : SOUL_PROFILE_DEFAULTS.dailyRitual,
  });
}

export async function handleSaveSoulPreferences(event) {
  event.preventDefault();
  hideMessage("profileMessage");
  const apiCall = hooks.apiCall;
  const parseApiBody = hooks.parseApiBody;
  const API_URL = hooks.API_URL;

  const payload = {
    soulProfile: buildSoulProfilePayloadFromForm(),
  };

  try {
    const response = await apiCall(`${API_URL}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response && response.ok) {
      const updated = await response.json();
      state.userPlanningPreferences = {
        ...(updated || {}),
        soulProfile: normalizeSoulProfile(updated?.soulProfile),
      };
      populateSoulPreferencesForm();
      showMessage("profileMessage", SOUL_COPY.saved, "success");
      return;
    }

    const data = response ? await parseApiBody(response) : {};
    showMessage(
      "profileMessage",
      data.error || "Could not save support preferences.",
      "error",
    );
  } catch (error) {
    console.error("Save planning preferences error:", error);
    showMessage("profileMessage", "Network error. Please try again.", "error");
  }
}

export function updateUserDisplay() {
  if (!state.currentUser) return;

  const userEmail = document.getElementById("userEmail");
  if (userEmail) userEmail.textContent = state.currentUser.email || "";

  const verifiedBadge = document.getElementById("verifiedBadge");
  if (verifiedBadge) {
    if (state.currentUser.isVerified) {
      verifiedBadge.className = "verified-badge";
      verifiedBadge.textContent = "✓ Verified";
      verifiedBadge.style.display = "inline-flex";
    } else {
      verifiedBadge.className = "unverified-badge";
      verifiedBadge.textContent = "";
      verifiedBadge.style.display = "none";
    }
  }

  const adminBadge = document.getElementById("adminBadge");
  const isAdmin = state.currentUser.role === "admin";
  if (adminBadge) {
    if (isAdmin) {
      adminBadge.className = "admin-badge";
      adminBadge.textContent = "⭐ Admin";
      adminBadge.style.display = "inline-block";
    } else {
      adminBadge.style.display = "none";
    }
  }
  const adminNavTab = document.getElementById("adminNavTab");
  if (adminNavTab instanceof HTMLElement) {
    adminNavTab.style.display = isAdmin ? "block" : "none";
  }
  document.body.classList.toggle("is-admin-user", isAdmin);

  // Update profile view
  const profileEmail = document.getElementById("profileEmail");
  if (profileEmail) profileEmail.textContent = state.currentUser.email || "";
  const profileName = document.getElementById("profileName");
  if (profileName)
    profileName.textContent = state.currentUser.name || "Not set";
  const profileStatus = document.getElementById("profileStatus");
  if (profileStatus)
    profileStatus.textContent = state.currentUser.isVerified
      ? "Verified ✓"
      : "Not Verified";
  const profileCreated = document.getElementById("profileCreated");
  if (profileCreated)
    profileCreated.textContent = new Date(
      state.currentUser.createdAt,
    ).toLocaleDateString();
  const updateNameInput = document.getElementById("updateName");
  if (updateNameInput) updateNameInput.value = state.currentUser.name || "";
  const updateEmailInput = document.getElementById("updateEmail");
  if (updateEmailInput) updateEmailInput.value = state.currentUser.email || "";

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
      showMessage("profileMessage", SOUL_COPY.saved, "success");
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
  state.userPlanningPreferences = null;
  state.currentDayContext = {
    mode: "normal",
    energy: "",
    notes: "",
    contextDate: "",
  };
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
  hooks.renderOnCreateAssistRow?.();
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
  const authView = document.getElementById("authView");
  const todosView = document.getElementById("todosView");
  const profileView = document.getElementById("profileView");

  // Body layout must exist before todosView is revealed (grid columns, sidebar)
  hooks.setTodosViewBodyState?.(true);
  hooks.setSettingsPaneVisible?.(false);
  hooks.setFeedbackPaneVisible?.(false);
  hooks.setAdminPaneVisible?.(false);

  // Show nav immediately — sits above the transition
  document.getElementById("navTabs").style.display = "flex";
  document.getElementById("userBar").style.display = "flex";

  // Determine which view is currently active
  const fromView = authView?.classList.contains("active")
    ? authView
    : profileView?.classList.contains("active")
      ? profileView
      : null;

  // Animated view swap — fire-and-forget so callers stay synchronous.
  // The .active swap is synchronous in the reduced-motion fast path, and
  // the animation is cosmetic in the normal path (state init below does
  // not depend on the animation completing).
  transitionViews(fromView, todosView, {
    beforeEnter() {
      // Deactivate whichever view was not the exit source
      if (profileView && profileView !== fromView)
        profileView.classList.remove("active");
      if (authView && authView !== fromView)
        authView.classList.remove("active");
    },
  });

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
  EventBus.dispatch(TODOS_CHANGED, { reason: STATE_CHANGED });
  updateCategoryFilter();
  loadProjects();
  loadTodos();
  hooks.loadAiSuggestions?.();
  hooks.loadAiUsage?.();
  hooks.loadAiInsights?.();
  hooks.loadAiFeedbackSummary?.();
  hooks.resetOnCreateAssistState?.();
  hooks.renderOnCreateAssistRow?.();
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
  const todosView = document.getElementById("todosView");
  const authView = document.getElementById("authView");
  const profileView = document.getElementById("profileView");

  // Hide nav elements and panes immediately — they sit above the transition
  document.getElementById("navTabs").style.display = "none";
  document.getElementById("userBar").style.display = "none";
  document.getElementById("adminNavTab").style.display = "none";
  document.body.classList.remove("is-admin-user");
  hooks.setSettingsPaneVisible?.(false);
  hooks.setFeedbackPaneVisible?.(false);
  hooks.setAdminPaneVisible?.(false);

  // Determine which view is currently active
  const fromView = todosView?.classList.contains("active")
    ? todosView
    : profileView?.classList.contains("active")
      ? profileView
      : null;

  // Animated view swap — fire-and-forget so callers stay synchronous.
  transitionViews(fromView, authView, {
    beforeEnter() {
      // Set body state BETWEEN exit and enter — avoids layout snap during fade
      hooks.setTodosViewBodyState?.(false);
      hooks.setSettingsPaneVisible?.(false);
      hooks.setFeedbackPaneVisible?.(false);
      hooks.setAdminPaneVisible?.(false);
      // Deactivate whichever view was not the exit source
      if (profileView && profileView !== fromView)
        profileView.classList.remove("active");
      if (todosView && todosView !== fromView)
        todosView.classList.remove("active");
    },
  });

  // Post-transition cleanup
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
  hooks.renderOnCreateAssistRow?.();
  // Reset to landing page (not auth form)
  var landing = document.getElementById("landingPage");
  var authForm = document.getElementById("authFormSection");
  if (landing) landing.classList.add("auth-landing-active");
  if (authForm) authForm.classList.remove("auth-page--active");
  showLogin();
}

// =============================================================================
// Social / Phone login
// =============================================================================

let _resendTimerId = null;

export async function initSocialLogin() {
  try {
    const resp = await fetch("/auth/providers");
    if (!resp.ok) return;
    const providers = await resp.json();

    const hasAny = providers.google || providers.apple || providers.phone;

    // Login form social section
    const loginSection = document.getElementById("loginSocialSection");
    if (loginSection) loginSection.style.display = hasAny ? "block" : "none";

    // Register form social section
    const registerSection = document.getElementById("registerSocialSection");
    if (registerSection)
      registerSection.style.display = hasAny ? "block" : "none";

    // Individual buttons (login)
    const loginGoogle = document.getElementById("loginGoogleBtn");
    if (loginGoogle)
      loginGoogle.style.display = providers.google ? "flex" : "none";
    const loginApple = document.getElementById("loginAppleBtn");
    if (loginApple)
      loginApple.style.display = providers.apple ? "flex" : "none";
    const loginPhone = document.getElementById("loginPhoneBtn");
    if (loginPhone)
      loginPhone.style.display = providers.phone ? "flex" : "none";

    // Individual buttons (register)
    const registerGoogle = document.getElementById("registerGoogleBtn");
    if (registerGoogle)
      registerGoogle.style.display = providers.google ? "flex" : "none";
    const registerApple = document.getElementById("registerAppleBtn");
    if (registerApple)
      registerApple.style.display = providers.apple ? "flex" : "none";
    const registerPhone = document.getElementById("registerPhoneBtn");
    if (registerPhone)
      registerPhone.style.display = providers.phone ? "flex" : "none";
  } catch {
    // Silently fail — social buttons stay hidden
  }
}

export function handleGoogleLogin() {
  window.location.href = "/auth/google/start";
}

export function handleAppleLogin() {
  window.location.href = "/auth/apple/start";
}

export function handleSocialCallback() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");

  if (auth === "success") {
    const token = params.get("token");
    const refreshToken = params.get("refreshToken");

    if (token && refreshToken) {
      const { AUTH_STATE, persistSession } = window.AppState || {};
      state.authToken = token;
      state.refreshToken = refreshToken;
      setAuthState(AUTH_STATE.AUTHENTICATED);

      if (persistSession) {
        persistSession({
          authToken: token,
          refreshToken: refreshToken,
          currentUser: state.currentUser,
        });
      }

      // Clean URL
      window.history.replaceState({}, document.title, "/");

      // Show app immediately, then load profile in background
      showAppView();
      loadUserProfile().then(() => {
        initOnboarding();
      });
    }
  } else if (auth === "error") {
    const message = params.get("message") || "Login failed";
    window.history.replaceState({}, document.title, "/");
    showMessage("authMessage", message, "error");
  }
}

export function showPhoneLogin() {
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => (f.style.display = "none"));
  document.getElementById("phoneLoginForm").style.display = "block";
  document
    .querySelectorAll(".auth-tab")
    .forEach((t) => t.classList.remove("active"));
  hideMessage("authMessage");
}

function maskPhone(phone) {
  if (!phone || phone.length < 6) return phone;
  return phone.slice(0, 3) + " *** " + phone.slice(-4);
}

function startResendTimer() {
  const timerEl = document.getElementById("resendTimer");
  const btn = document.getElementById("resendOtpBtn");
  if (!timerEl || !btn) return;

  let remaining = 60;
  btn.disabled = true;
  timerEl.textContent = remaining;

  if (_resendTimerId) clearInterval(_resendTimerId);
  _resendTimerId = setInterval(() => {
    remaining -= 1;
    timerEl.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(_resendTimerId);
      _resendTimerId = null;
      btn.disabled = false;
    }
  }, 1000);
}

export async function handleSendOtp() {
  const phoneInput = document.getElementById("phoneNumber");
  const phone = phoneInput?.value?.trim();
  if (!phone) {
    showMessage("authMessage", "Please enter a phone number", "error");
    return;
  }

  const sendBtn = document.getElementById("sendOtpBtn");
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn._origText = sendBtn._origText || sendBtn.textContent;
    sendBtn.textContent = "Sending…";
  }

  try {
    const resp = await fetch("/auth/phone/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg =
        data.error || data.errors?.[0]?.message || "Failed to send code";
      showMessage("authMessage", msg, "error");
      return;
    }

    // Show OTP section
    const otpSection = document.getElementById("otpSection");
    if (otpSection) otpSection.style.display = "block";

    const maskedEl = document.getElementById("otpPhoneMasked");
    if (maskedEl) maskedEl.textContent = maskPhone(phone);

    startResendTimer();
    showMessage("authMessage", "Verification code sent", "success");
  } catch {
    showMessage("authMessage", "Failed to send code", "error");
  } finally {
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = sendBtn._origText || "Send Code";
    }
  }
}

export async function handleResendOtp() {
  await handleSendOtp();
}

// =============================================================================
// Account management — linked providers, unlink, set password
// =============================================================================

export async function loadLinkedProviders() {
  const apiCall = hooks.apiCall;
  const API_URL = hooks.API_URL;
  const section = document.getElementById("linkedProvidersSection");
  if (!section) return;

  try {
    const resp = await apiCall(`${API_URL}/auth/linked-providers`);
    if (!resp || !resp.ok) {
      section.style.display = "none";
      return;
    }

    const data = await resp.json();
    section.style.display = "block";

    const list = document.getElementById("linkedProvidersList");
    if (!list) return;

    const methods = [];

    if (data.hasPassword) {
      methods.push(
        '<div class="linked-provider-row">' +
          '<span class="linked-provider-name">Email + Password</span>' +
          "</div>",
      );
    }

    if (data.phoneE164) {
      methods.push(
        '<div class="linked-provider-row">' +
          '<span class="linked-provider-name">Phone: ' +
          escapeHtml(maskPhone(data.phoneE164)) +
          "</span>" +
          "</div>",
      );
    }

    for (const p of data.providers) {
      const label = p.provider.charAt(0).toUpperCase() + p.provider.slice(1);
      const email = p.emailAtProvider
        ? " (" + escapeHtml(p.emailAtProvider) + ")"
        : "";
      methods.push(
        '<div class="linked-provider-row">' +
          '<span class="linked-provider-name">' +
          escapeHtml(label) +
          email +
          "</span>" +
          '<button type="button" class="link-btn linked-provider-unlink" ' +
          "data-onclick=\"handleUnlinkProvider('" +
          escapeHtmlAttr(p.provider) +
          "', '" +
          escapeHtmlAttr(p.providerSubject) +
          "')\">Unlink</button>" +
          "</div>",
      );
    }

    if (methods.length === 0) {
      list.innerHTML =
        '<p style="color: var(--text-secondary)">No linked sign-in methods.</p>';
    } else {
      list.innerHTML = methods.join("");
    }

    // Show set-password form if user doesn't have a password
    const setPwSection = document.getElementById("setPasswordSection");
    if (setPwSection) {
      setPwSection.style.display = data.hasPassword ? "none" : "block";
    }
  } catch {
    section.style.display = "none";
  }
}

// Use escapeHtml from window.Utils (imported at top). This wrapper also escapes
// single quotes for safe use inside data-onclick='...' attribute values.
function escapeHtmlAttr(str) {
  const { escapeHtml: escape } = window.Utils || {};
  const base = escape ? escape(str) : str;
  return base.replace(/'/g, "&#39;");
}

export async function handleUnlinkProvider(provider, providerSubject) {
  const apiCall = hooks.apiCall;
  const API_URL = hooks.API_URL;

  try {
    const resp = await apiCall(`${API_URL}/auth/unlink-provider`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, providerSubject }),
    });

    const data = resp ? await resp.json() : {};
    if (resp && resp.ok) {
      showMessage("profileMessage", "Provider unlinked", "success");
      loadLinkedProviders();
    } else {
      showMessage(
        "profileMessage",
        data.error || "Failed to unlink provider",
        "error",
      );
    }
  } catch {
    showMessage("profileMessage", "Network error. Please try again.", "error");
  }
}

export async function handleSetPassword(event) {
  event.preventDefault();
  hideMessage("profileMessage");

  const apiCall = hooks.apiCall;
  const API_URL = hooks.API_URL;

  const input = document.getElementById("setPasswordInput");
  const password = input?.value;
  if (!password || password.length < 8) {
    showMessage(
      "profileMessage",
      "Password must be at least 8 characters",
      "error",
    );
    return;
  }

  try {
    const resp = await apiCall(`${API_URL}/auth/set-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = resp ? await resp.json() : {};
    if (resp && resp.ok) {
      showMessage("profileMessage", "Password set successfully!", "success");
      if (input) input.value = "";
      loadLinkedProviders();
    } else {
      showMessage(
        "profileMessage",
        data.error || "Failed to set password",
        "error",
      );
    }
  } catch {
    showMessage("profileMessage", "Network error. Please try again.", "error");
  }
}

export async function handleVerifyOtp() {
  const phoneInput = document.getElementById("phoneNumber");
  const codeInput = document.getElementById("otpCode");
  const phone = phoneInput?.value?.trim();
  const code = codeInput?.value?.trim();

  if (!phone || !code) {
    showMessage("authMessage", "Please enter phone and code", "error");
    return;
  }

  const verifyBtn = document.getElementById("verifyOtpBtn");
  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn._origText = verifyBtn._origText || verifyBtn.textContent;
    verifyBtn.textContent = "Verifying…";
  }

  try {
    const resp = await fetch("/auth/phone/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      const msg = data.error || "Invalid or expired code";
      showMessage("authMessage", msg, "error");
      return;
    }

    // Store tokens and show app
    const { AUTH_STATE, persistSession } = window.AppState || {};
    state.authToken = data.token;
    state.refreshToken = data.refreshToken;
    state.currentUser = data.user;
    setAuthState(AUTH_STATE.AUTHENTICATED);

    if (persistSession) {
      persistSession({
        authToken: data.token,
        refreshToken: data.refreshToken,
        currentUser: data.user,
      });
    }

    showAppView();
    loadUserProfile().then(() => {
      initOnboarding();
    });
  } catch {
    showMessage("authMessage", "Verification failed", "error");
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = verifyBtn._origText || "Verify";
    }
  }
}
