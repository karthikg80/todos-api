// Configuration
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : window.location.origin;

const hasValidAppState =
  !!window.AppState &&
  typeof window.AppState.loadStoredSession === "function" &&
  typeof window.AppState.persistSession === "function" &&
  window.AppState.AUTH_STATE;

const AppStateModule = hasValidAppState
  ? window.AppState
  : {
      AUTH_STATE: Object.freeze({
        AUTHENTICATED: "authenticated",
        REFRESHING: "refreshing",
        UNAUTHENTICATED: "unauthenticated",
      }),
      EMAIL_ACTION_TIMEOUT_MS: 15000,
      loadStoredSession(storage = window.localStorage) {
        const token = storage.getItem("authToken");
        const refreshToken = storage.getItem("refreshToken");
        const userRaw = storage.getItem("user");

        if (!token || !userRaw) {
          return {
            token: null,
            refreshToken,
            user: null,
            invalidUserData: false,
          };
        }

        try {
          return {
            token,
            refreshToken,
            user: JSON.parse(userRaw),
            invalidUserData: false,
          };
        } catch (error) {
          return {
            token: null,
            refreshToken: null,
            user: null,
            invalidUserData: true,
            error,
          };
        }
      },
      persistSession({ authToken, refreshToken, currentUser }) {
        if (authToken) {
          localStorage.setItem("authToken", authToken);
        } else {
          localStorage.removeItem("authToken");
        }

        if (refreshToken) {
          localStorage.setItem("refreshToken", refreshToken);
        } else {
          localStorage.removeItem("refreshToken");
        }

        if (currentUser) {
          localStorage.setItem("user", JSON.stringify(currentUser));
        } else {
          localStorage.removeItem("user");
        }
      },
    };
window.AppState = AppStateModule;

const hasValidApiClient =
  !!window.ApiClient && typeof window.ApiClient.createApiClient === "function";

const ApiClientModule = hasValidApiClient
  ? window.ApiClient
  : {
      createApiClient({
        apiUrl,
        getAuthToken,
        getRefreshToken,
        getAuthState,
        setAuthState,
        onAuthFailure,
        onAuthTokens,
      }) {
        let refreshInFlight = null;

        async function parseApiBody(response) {
          const text = await response.text();
          if (!text) return {};
          try {
            return JSON.parse(text);
          } catch {
            return { error: text };
          }
        }

        function isAbortError(error) {
          return error instanceof Error && error.name === "AbortError";
        }

        async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            return await fetch(url, { ...options, signal: controller.signal });
          } finally {
            clearTimeout(timeoutId);
          }
        }

        async function refreshAccessToken() {
          const refreshToken = getRefreshToken();
          if (!refreshToken) {
            setAuthState("unauthenticated");
            return false;
          }

          if (refreshInFlight) {
            return refreshInFlight;
          }

          setAuthState("refreshing");

          refreshInFlight = (async () => {
            try {
              const response = await fetch(`${apiUrl}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
              });

              if (!response.ok) {
                setAuthState("unauthenticated");
                return false;
              }

              const data = await response.json();
              onAuthTokens(data.token, data.refreshToken);
              setAuthState("authenticated");
              return true;
            } catch (error) {
              console.error("Token refresh failed:", error);
              setAuthState("unauthenticated");
              return false;
            }
          })();

          const refreshed = await refreshInFlight;
          refreshInFlight = null;
          return refreshed;
        }

        async function apiCall(url, options = {}) {
          const requestOptions = {
            ...options,
            headers: {
              ...(options.headers || {}),
            },
          };

          const authToken = getAuthToken();
          if (authToken && !requestOptions.skipAuth) {
            requestOptions.headers.Authorization = `Bearer ${authToken}`;
          }

          let response = await fetch(url, requestOptions);

          if (
            response.status === 401 &&
            getRefreshToken() &&
            !requestOptions.skipRefresh
          ) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              requestOptions.headers.Authorization = `Bearer ${getAuthToken()}`;
              response = await fetch(url, requestOptions);
            } else {
              onAuthFailure();
              return response;
            }
          }

          if (
            response.status === 401 &&
            !getRefreshToken() &&
            !requestOptions.skipAuth
          ) {
            if (getAuthState() !== "unauthenticated") {
              setAuthState("unauthenticated");
            }
            onAuthFailure();
          }

          return response;
        }

        async function apiCallWithTimeout(
          url,
          options = {},
          timeoutMs = 15000,
        ) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            return await apiCall(url, {
              ...options,
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }
        }

        return {
          apiCall,
          fetchWithTimeout,
          apiCallWithTimeout,
          parseApiBody,
          isAbortError,
        };
      },
    };
window.ApiClient = ApiClientModule;

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
let latestPlanSuggestionId = null;
let latestPlanResult = null;
let adminBootstrapAvailable = false;
const {
  AUTH_STATE,
  EMAIL_ACTION_TIMEOUT_MS,
  loadStoredSession,
  persistSession,
} = AppStateModule;
let authState = AUTH_STATE.UNAUTHENTICATED;

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

// Initialize app
function init() {
  bindCriticalHandlers();

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
  if (currentUser.role === "admin") {
    adminBadge.className = "admin-badge";
    adminBadge.textContent = "⭐ Admin";
    adminBadge.style.display = "inline-block";
  } else {
    adminBadge.style.display = "none";
  }

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
      const data = await response.json();
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

// Load todos
async function loadTodos() {
  try {
    const response = await apiCall(`${API_URL}/todos`);
    if (response && response.ok) {
      todos = await response.json();

      // DEBUG: Log what API returned
      console.log("📥 Loaded todos from API:", todos.length);
      todos.forEach((todo, i) => {
        console.log(`Todo ${i}:`, {
          id: todo.id,
          title: todo.title,
          priority: todo.priority,
          notes: todo.notes,
          notesLength: todo.notes ? todo.notes.length : 0,
        });
      });

      renderTodos();
      updateCategoryFilter();
    } else {
      todos = [];
      selectedTodos.clear();
      renderTodos();
      updateCategoryFilter();
      showMessage("todosMessage", "Failed to load todos", "error");
    }
  } catch (error) {
    todos = [];
    selectedTodos.clear();
    renderTodos();
    updateCategoryFilter();
    console.error("Load todos error:", error);
  }
}

async function loadAiSuggestions() {
  try {
    const response = await apiCall(`${API_URL}/ai/suggestions?limit=8`);
    if (!response || !response.ok) {
      aiSuggestions = [];
      renderAiSuggestionHistory();
      return;
    }

    aiSuggestions = await response.json();
    renderAiSuggestionHistory();
  } catch (error) {
    console.error("Load AI suggestions error:", error);
    aiSuggestions = [];
    renderAiSuggestionHistory();
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
    await apiCall(`${API_URL}/ai/suggestions/${suggestionId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason }),
    });
    await loadAiSuggestions();
    await loadAiUsage();
    await loadAiInsights();
    await loadAiFeedbackSummary();
  } catch (error) {
    console.error("Update suggestion status error:", error);
  }
}

function renderCritiquePanel() {
  const panel = document.getElementById("aiCritiquePanel");
  if (!panel) return;

  if (!latestCritiqueResult) {
    panel.style.display = "none";
    panel.innerHTML = "";
    return;
  }

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
      <div style="display: flex; gap: 8px;">
        <button class="add-btn" data-onclick="applyCritiqueSuggestion()">Apply Suggestion</button>
        <button class="add-btn" style="background: #64748b" data-onclick="dismissCritiqueSuggestion()">Dismiss</button>
      </div>
    </div>
  `;
}

function renderPlanPanel() {
  const panel = document.getElementById("aiPlanPanel");
  if (!panel) return;

  if (!latestPlanResult) {
    panel.style.display = "none";
    panel.innerHTML = "";
    return;
  }

  panel.style.display = "block";
  panel.innerHTML = `
    <div style="
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px;
      background: var(--input-bg);
    ">
      <div style="font-weight: 600; margin-bottom: 6px;">${escapeHtml(latestPlanResult.summary)}</div>
      <ol style="margin: 8px 0 10px 18px;">
        ${latestPlanResult.tasks
          .map(
            (task) => `
          <li style="margin-bottom: 6px;">
            <strong>${escapeHtml(task.title)}</strong><br />
            <span style="font-size: 0.9rem;">${escapeHtml(task.description)}</span>
          </li>
        `,
          )
          .join("")}
      </ol>
      <div style="display: flex; gap: 8px;">
        <button class="add-btn" data-onclick="addPlanTasksToTodos()">Add Plan Tasks</button>
        <button class="add-btn" style="background: #64748b" data-onclick="dismissPlanSuggestion()">Dismiss</button>
      </div>
    </div>
  `;
}

async function critiqueDraftWithAi() {
  const input = document.getElementById("todoInput");
  const categoryInput = document.getElementById("todoCategoryInput");
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

  try {
    const response = await apiCall(`${API_URL}/ai/task-critic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description:
          notesInput.value.trim() || categoryInput.value.trim() || undefined,
        dueDate: dueDateInput.value
          ? new Date(dueDateInput.value).toISOString()
          : undefined,
        priority: currentPriority,
      }),
    });

    const data = response ? await parseApiBody(response) : {};
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
    console.error("Critique draft error:", error);
    showMessage("todosMessage", "Failed to run AI critique", "error");
  }
}

async function applyCritiqueSuggestion() {
  if (!latestCritiqueResult) return;

  const input = document.getElementById("todoInput");
  const notesInput = document.getElementById("todoNotesInput");
  const notesIcon = document.getElementById("notesExpandIcon");
  input.value = latestCritiqueResult.improvedTitle || input.value;

  if (latestCritiqueResult.improvedDescription && !notesInput.value.trim()) {
    notesInput.value = latestCritiqueResult.improvedDescription;
    notesInput.style.display = "block";
    notesIcon.classList.add("expanded");
  }

  await updateSuggestionStatus(
    latestCritiqueSuggestionId,
    "accepted",
    "Applied to draft",
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
    "Not useful for current context",
  );
  latestCritiqueSuggestionId = null;
  latestCritiqueResult = null;
  renderCritiquePanel();
}

async function generatePlanWithAi() {
  const goalInput = document.getElementById("goalInput");
  const targetDateInput = document.getElementById("goalTargetDateInput");

  const goal = goalInput.value.trim();
  if (!goal) {
    showMessage("todosMessage", "Enter a goal to generate a plan", "error");
    return;
  }

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
      latestPlanSuggestionId = data.suggestionId;
      latestPlanResult = data;
      renderPlanPanel();
      showMessage(
        "todosMessage",
        "AI plan generated. Review and add tasks.",
        "success",
      );
      await loadAiSuggestions();
      await loadAiUsage();
      await loadAiInsights();
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
  }
}

async function addPlanTasksToTodos() {
  if (!latestPlanSuggestionId) {
    return;
  }

  try {
    const response = await apiCall(
      `${API_URL}/ai/suggestions/${latestPlanSuggestionId}/apply`,
      {
        method: "POST",
      },
    );

    const data = response ? await parseApiBody(response) : {};
    if (response && response.ok) {
      const created = Number.isInteger(data.createdCount)
        ? data.createdCount
        : 0;
      latestPlanSuggestionId = null;
      latestPlanResult = null;
      renderPlanPanel();
      await loadAiSuggestions();
      await loadAiUsage();
      await loadAiInsights();
      await loadAiFeedbackSummary();
      await loadTodos();
      showMessage(
        "todosMessage",
        `Added ${created} AI-planned tasks`,
        "success",
      );
      return;
    }

    showMessage(
      "todosMessage",
      data.error || "Failed to apply AI suggestion",
      "error",
    );
  } catch (error) {
    console.error("Apply planned tasks error:", error);
    showMessage("todosMessage", "Failed to apply AI suggestion", "error");
  }
}

async function dismissPlanSuggestion() {
  await updateSuggestionStatus(
    latestPlanSuggestionId,
    "rejected",
    "Plan did not match intended approach",
  );
  latestPlanSuggestionId = null;
  latestPlanResult = null;
  renderPlanPanel();
}

// Add todo
async function addTodo() {
  const input = document.getElementById("todoInput");
  const categoryInput = document.getElementById("todoCategoryInput");
  const dueDateInput = document.getElementById("todoDueDateInput");
  const notesInput = document.getElementById("todoNotesInput");

  const title = input.value.trim();
  if (!title) return;

  const payload = {
    title,
    priority: currentPriority,
  };

  if (categoryInput.value.trim()) {
    payload.category = categoryInput.value.trim();
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

      // Clear form
      input.value = "";
      categoryInput.value = "";
      dueDateInput.value = "";
      notesInput.value = "";

      // Reset priority to medium
      setPriority("medium");

      // Hide notes input
      notesInput.style.display = "none";
      document.getElementById("notesExpandIcon").classList.remove("expanded");
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
  if (!todo) return;

  if (!confirm("Delete this todo?")) return;

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
      return;
    }

    const errorData = response ? await response.json().catch(() => ({})) : {};
    showMessage(
      "todosMessage",
      errorData.error || "Failed to delete todo",
      "error",
    );
  } catch (error) {
    showMessage("todosMessage", "Network error while deleting todo", "error");
    console.error("Delete todo error:", error);
  }
}

// Update category filter dropdown
function updateCategoryFilter() {
  const categories = [...new Set(todos.map((t) => t.category).filter(Boolean))];
  const filterSelect = document.getElementById("categoryFilter");
  const currentValue = filterSelect.value;

  filterSelect.innerHTML =
    '<option value="">All Categories</option>' +
    categories
      .map(
        (cat) =>
          `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`,
      )
      .join("");

  if (categories.includes(currentValue)) {
    filterSelect.value = currentValue;
  }
}

// Filter todos by category and search
function filterTodosList(todosList) {
  let filtered = todosList;

  // Category filter
  const categoryFilter = document.getElementById("categoryFilter").value;
  if (categoryFilter) {
    filtered = filtered.filter((todo) => todo.category === categoryFilter);
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

  return filtered;
}

// Called when filter changes
function filterTodos() {
  renderTodos();
}

// Clear all filters
function clearFilters() {
  document.getElementById("categoryFilter").value = "";
  document.getElementById("searchInput").value = "";
  renderTodos();
}

// Render todos
function renderTodos() {
  const container = document.getElementById("todosContent");

  // Debug: Log todos with notes
  const todosWithNotes = todos.filter((t) => t.notes);
  if (todosWithNotes.length > 0) {
    console.log(
      "Todos with notes:",
      todosWithNotes.map((t) => ({ id: t.id, title: t.title, notes: t.notes })),
    );
  }

  if (todos.length === 0) {
    container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">✨</div>
                        <p>No todos yet. Add one above!</p>
                    </div>
                `;
    updateBulkActionsVisibility();
    return;
  }

  const filteredTodos = filterTodosList(todos);

  container.innerHTML = `
                <ul class="todos-list">
                    ${filteredTodos
                      .map((todo, index) => {
                        const isOverdue =
                          todo.dueDate &&
                          !todo.completed &&
                          new Date(todo.dueDate) < new Date();
                        const dueDateStr = todo.dueDate
                          ? new Date(todo.dueDate).toLocaleString()
                          : "";
                        const isSelected = selectedTodos.has(todo.id);

                        return `
                        <li class="todo-item ${todo.completed ? "completed" : ""}"
                            draggable="true"
                            data-todo-id="${todo.id}"
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
                            <div class="todo-content" style="flex: 1;">
                                <div class="todo-title">${escapeHtml(todo.title)}</div>
                                ${todo.description ? `<div class="todo-description">${escapeHtml(todo.description)}</div>` : ""}
                                <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; align-items: center;">
                                    ${getPriorityIcon(todo.priority)} <span class="priority-badge ${todo.priority}">${todo.priority.toUpperCase()}</span>
                                    ${todo.category ? `<span style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">🏷️ ${escapeHtml(todo.category)}</span>` : ""}
                                    ${todo.dueDate ? `<span style="background: ${isOverdue ? "#ff4757" : "#48dbfb"}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">${isOverdue ? "⚠️" : "📅"} ${dueDateStr}</span>` : ""}
                                </div>
                                ${todo.subtasks && todo.subtasks.length > 0 ? renderSubtasks(todo) : ""}
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
                            <button class="delete-btn" data-onclick="deleteTodo('${todo.id}')">Delete</button>
                        </li>
                    `;
                      })
                      .join("")}
                </ul>
            `;

  updateBulkActionsVisibility();
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
      const data = await response.json();
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
      const data = await response.json();
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

// Switch view
function switchView(view, triggerEl = null) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document
    .querySelectorAll(".nav-tab")
    .forEach((t) => t.classList.remove("active"));

  document.getElementById(view + "View").classList.add("active");
  if (triggerEl) {
    triggerEl.classList.add("active");
  }

  if (view === "todos") {
    loadTodos();
    loadAiSuggestions();
    loadAiUsage();
    loadAiInsights();
    loadAiFeedbackSummary();
  } else if (view === "profile") {
    updateUserDisplay();
  } else if (view === "admin") {
    loadAdminUsers();
  }
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

// Handle todo keypress
function handleTodoKeyPress(event) {
  if (event.key === "Enter") {
    addTodo();
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
  latestCritiqueSuggestionId = null;
  latestCritiqueResult = null;
  latestPlanSuggestionId = null;
  latestPlanResult = null;
  showAuthView();
}

// Show app view
function showAppView() {
  document.getElementById("authView").classList.remove("active");
  document.getElementById("todosView").classList.add("active");
  document.getElementById("navTabs").style.display = "flex";
  document.getElementById("userBar").style.display = "flex";
  document.querySelectorAll(".nav-tab")[0].classList.add("active");
  // Prevent previous account data from flashing while fetching current user's data.
  todos = [];
  selectedTodos.clear();
  renderTodos();
  updateCategoryFilter();
  loadTodos();
  loadAiSuggestions();
  loadAiUsage();
  loadAiInsights();
  loadAiFeedbackSummary();
}

// Show auth view
function showAuthView() {
  document.getElementById("authView").classList.add("active");
  document.getElementById("todosView").classList.remove("active");
  document.getElementById("profileView").classList.remove("active");
  document.getElementById("adminView").classList.remove("active");
  document.getElementById("navTabs").style.display = "none";
  document.getElementById("userBar").style.display = "none";
  document.getElementById("adminNavTab").style.display = "none";
  adminBootstrapAvailable = false;
  showLogin();
}

// Show/hide messages
function showMessage(id, message, type) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `message ${type} show`;
}

function hideMessage(id) {
  const el = document.getElementById(id);
  el.classList.remove("show");
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Dark mode toggle
function toggleTheme() {
  const body = document.body;
  const isDark = body.classList.toggle("dark-mode");
  localStorage.setItem("theme", isDark ? "dark" : "light");

  // Update toggle button icon
  const toggleBtn = document.querySelector(".theme-toggle");
  toggleBtn.textContent = isDark ? "☀️" : "🌙";
}

// Initialize theme
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark);

  if (shouldBeDark) {
    document.body.classList.add("dark-mode");
    const toggleBtn = document.querySelector(".theme-toggle");
    if (toggleBtn) toggleBtn.textContent = "☀️";
  }
}

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

// Initialize theme immediately
initTheme();

// Initialize on load
bindDeclarativeHandlers();
init();
