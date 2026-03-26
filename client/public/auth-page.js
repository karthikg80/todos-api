// auth-page.js — Standalone auth page controller.
// ---------------------------------------------------------------------------
// Required globals (loaded via <script> tags in auth.html):
//   window.AppState  — from /utils/authSession.js  (token persistence)
//   window.ApiClient — from /utils/apiClient.js    (fetch + token refresh)
//   window.Utils     — from /utils/utils.js        (showMessage / hideMessage)
// Load order matters: authSession → apiClient → utils → this file.
// If any global is missing the page shows a clear error instead of breaking
// silently deep in a callback.
// ---------------------------------------------------------------------------
(function () {
  "use strict";

  var AppState = window.AppState;
  var ApiClient = window.ApiClient;
  var Utils = window.Utils;

  // -- dependency guard -----------------------------------------------------
  var missing = [];
  if (!AppState) missing.push("AppState (authSession.js)");
  if (!ApiClient) missing.push("ApiClient (apiClient.js)");
  if (!Utils) missing.push("Utils (utils.js)");
  if (missing.length) {
    document.addEventListener("DOMContentLoaded", function () {
      var el = document.getElementById("authMessage");
      if (el) {
        el.textContent =
          "Auth page failed to load: missing " + missing.join(", ");
        el.className = "message show error";
      }
    });
    return; // abort — nothing else will work
  }
  // -------------------------------------------------------------------------

  var showMessage = Utils.showMessage;
  var hideMessage = Utils.hideMessage;

  // ---------------------------------------------------------------------------
  // API URL — same logic as app.js
  // ---------------------------------------------------------------------------
  var API_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:3000"
      : window.location.origin;

  // ---------------------------------------------------------------------------
  // Lightweight state (no store.js import needed)
  // ---------------------------------------------------------------------------
  var authState = AppState.AUTH_STATE.UNAUTHENTICATED;
  var authToken = null;
  var refreshToken = null;

  function setAuthState(next) {
    authState = next;
  }

  function onAuthFailure() {
    authState = AppState.AUTH_STATE.UNAUTHENTICATED;
    AppState.clearSession();
    switchAuthTab("login");
  }

  function onAuthTokens(nextToken, nextRefreshToken) {
    authToken = nextToken;
    refreshToken = nextRefreshToken;
    AppState.persistSession({
      authToken: authToken,
      refreshToken: refreshToken,
      currentUser: null,
    });
  }

  var api = ApiClient.createApiClient({
    apiUrl: API_URL,
    getAuthToken: function () {
      return authToken;
    },
    getRefreshToken: function () {
      return refreshToken;
    },
    getAuthState: function () {
      return authState;
    },
    setAuthState: setAuthState,
    onAuthFailure: onAuthFailure,
    onAuthTokens: onAuthTokens,
  });

  // ---------------------------------------------------------------------------
  // Tab / form navigation
  // ---------------------------------------------------------------------------
  function switchAuthTab(tab, triggerEl) {
    var validTabs = [
      "login",
      "register",
      "phoneLogin",
      "forgotPassword",
      "resetPassword",
    ];
    if (validTabs.indexOf(tab) === -1) return;

    var tabs = document.querySelectorAll(".auth-tab");
    tabs.forEach(function (t) {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });

    document.querySelectorAll(".auth-form").forEach(function (f) {
      f.style.display = "none";
    });

    if (triggerEl) {
      triggerEl.classList.add("active");
      triggerEl.setAttribute("aria-selected", "true");
    } else {
      var tabBtn = document.getElementById(tab + "TabButton");
      if (tabBtn) {
        tabBtn.classList.add("active");
        tabBtn.setAttribute("aria-selected", "true");
      }
    }

    var targetForm = document.getElementById(tab + "Form");
    if (targetForm) {
      targetForm.style.display = "block";
      var firstInput = targetForm.querySelector("input");
      if (firstInput) firstInput.focus();
    }
    hideMessage("authMessage");
  }

  function showForgotPassword() {
    document.querySelectorAll(".auth-form").forEach(function (f) {
      f.style.display = "none";
    });
    document.getElementById("forgotPasswordForm").style.display = "block";
    document.querySelectorAll(".auth-tab").forEach(function (t) {
      t.classList.remove("active");
    });
    hideMessage("authMessage");
  }

  function showLogin() {
    document.querySelectorAll(".auth-form").forEach(function (f) {
      f.style.display = "none";
    });
    document.getElementById("loginForm").style.display = "block";
    var firstTab = document.querySelectorAll(".auth-tab")[0];
    if (firstTab) firstTab.classList.add("active");
    hideMessage("authMessage");
  }

  function showResetPassword(token) {
    document.getElementById("resetPasswordForm").dataset.token = token;
    document.querySelectorAll(".auth-form").forEach(function (f) {
      f.style.display = "none";
    });
    document.getElementById("resetPasswordForm").style.display = "block";
  }

  function showPhoneLogin() {
    document.querySelectorAll(".auth-form").forEach(function (f) {
      f.style.display = "none";
    });
    document.getElementById("phoneLoginForm").style.display = "block";
    document.querySelectorAll(".auth-tab").forEach(function (t) {
      t.classList.remove("active");
    });
    hideMessage("authMessage");
  }

  // ---------------------------------------------------------------------------
  // Post-auth redirect — go to main app
  // ---------------------------------------------------------------------------
  function redirectToApp() {
    window.location.href = "/";
  }

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------
  function handleLogin(event) {
    event.preventDefault();
    hideMessage("authMessage");

    var email = document.getElementById("loginEmail").value;
    var password = document.getElementById("loginPassword").value;
    var submitBtn = document.querySelector("#loginForm button[type='submit']");
    var origText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in\u2026";
    }

    fetch(API_URL + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (response.ok) {
            authToken = data.token;
            refreshToken = data.refreshToken;
            setAuthState(AppState.AUTH_STATE.AUTHENTICATED);
            AppState.persistSession({
              authToken: data.token,
              refreshToken: data.refreshToken,
              currentUser: data.user,
            });
            redirectToApp();
          } else {
            showMessage("authMessage", data.error || "Login failed", "error");
          }
        });
      })
      .catch(function () {
        showMessage("authMessage", "Network error. Please try again.", "error");
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origText || "Sign In";
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  function handleRegister(event) {
    event.preventDefault();
    hideMessage("authMessage");

    var name = document.getElementById("registerName").value;
    var email = document.getElementById("registerEmail").value;
    var password = document.getElementById("registerPassword").value;
    var payload = { email: email, password: password };
    if (name) payload.name = name;

    var regBtn = document.querySelector("#registerForm button[type='submit']");
    var origText = regBtn ? regBtn.textContent : "";
    if (regBtn) {
      regBtn.disabled = true;
      regBtn.textContent = "Creating account\u2026";
    }

    fetch(API_URL + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (response.ok) {
            authToken = data.token;
            refreshToken = data.refreshToken;
            setAuthState(AppState.AUTH_STATE.AUTHENTICATED);
            AppState.persistSession({
              authToken: data.token,
              refreshToken: data.refreshToken,
              currentUser: data.user,
            });
            showMessage(
              "authMessage",
              "Account created successfully!",
              "success",
            );
            setTimeout(redirectToApp, 1000);
          } else {
            var errorMsg = data.errors
              ? data.errors
                  .map(function (e) {
                    return e.message;
                  })
                  .join(", ")
              : data.error || "Registration failed";
            showMessage("authMessage", errorMsg, "error");
          }
        });
      })
      .catch(function () {
        showMessage("authMessage", "Network error. Please try again.", "error");
      })
      .finally(function () {
        if (regBtn) {
          regBtn.disabled = false;
          regBtn.textContent = origText || "Create Account";
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Forgot Password
  // ---------------------------------------------------------------------------
  function handleForgotPassword(event) {
    event.preventDefault();
    hideMessage("authMessage");

    var email = document.getElementById("forgotEmail").value;
    var submitBtn = document.querySelector(
      "#forgotPasswordForm button[type='submit']",
    );
    var origLabel = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";
    }

    api
      .fetchWithTimeout(
        API_URL + "/auth/forgot-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email }),
        },
        AppState.EMAIL_ACTION_TIMEOUT_MS,
      )
      .then(function (response) {
        return api.parseApiBody(response).then(function (data) {
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
        });
      })
      .catch(function (error) {
        if (api.isAbortError(error)) {
          showMessage(
            "authMessage",
            "Request timed out. Please try again in a moment.",
            "error",
          );
        } else {
          showMessage(
            "authMessage",
            "Network error. Please try again.",
            "error",
          );
        }
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = origLabel || "Send Reset Link";
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Reset Password
  // ---------------------------------------------------------------------------
  function handleResetPassword(event) {
    event.preventDefault();
    hideMessage("authMessage");

    var token = document.getElementById("resetPasswordForm").dataset.token;
    var password = document.getElementById("newPassword").value;
    var confirm = document.getElementById("confirmPassword").value;

    if (password !== confirm) {
      showMessage("authMessage", "Passwords do not match", "error");
      return;
    }

    fetch(API_URL + "/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token, password: password }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (response.ok) {
            showMessage(
              "authMessage",
              "Password reset successfully! Redirecting to login...",
              "success",
            );
            setTimeout(showLogin, 2000);
          } else {
            showMessage(
              "authMessage",
              data.error || "Failed to reset password",
              "error",
            );
          }
        });
      })
      .catch(function () {
        showMessage("authMessage", "Network error. Please try again.", "error");
      });
  }

  // ---------------------------------------------------------------------------
  // Social login
  // ---------------------------------------------------------------------------
  function handleGoogleLogin() {
    window.location.href = "/auth/google/start";
  }

  function handleAppleLogin() {
    window.location.href = "/auth/apple/start";
  }

  function initSocialLogin() {
    fetch("/auth/providers")
      .then(function (resp) {
        if (!resp.ok) return;
        return resp.json();
      })
      .then(function (providers) {
        if (!providers) return;

        var hasAny = providers.google || providers.apple || providers.phone;

        var loginSection = document.getElementById("loginSocialSection");
        if (loginSection)
          loginSection.style.display = hasAny ? "block" : "none";

        var registerSection = document.getElementById("registerSocialSection");
        if (registerSection)
          registerSection.style.display = hasAny ? "block" : "none";

        var ids = [
          ["loginGoogleBtn", providers.google],
          ["loginAppleBtn", providers.apple],
          ["loginPhoneBtn", providers.phone],
          ["registerGoogleBtn", providers.google],
          ["registerAppleBtn", providers.apple],
          ["registerPhoneBtn", providers.phone],
        ];
        ids.forEach(function (pair) {
          var el = document.getElementById(pair[0]);
          if (el) el.style.display = pair[1] ? "flex" : "none";
        });
      })
      .catch(function () {
        // silently fail — social buttons stay hidden
      });
  }

  function handleSocialCallback() {
    var params = new URLSearchParams(window.location.search);
    var auth = params.get("auth");
    if (!auth) return; // not a callback — nothing to do

    // Always clean the URL first so callback params don't linger on reload
    window.history.replaceState({}, document.title, window.location.pathname);

    if (auth === "success") {
      var token = params.get("token");
      var rt = params.get("refreshToken");

      if (!token || !rt) {
        // Server sent auth=success but omitted credentials — treat as error
        showMessage(
          "authMessage",
          "Login succeeded but credentials were missing. Please try again.",
          "error",
        );
        return;
      }

      authToken = token;
      refreshToken = rt;
      setAuthState(AppState.AUTH_STATE.AUTHENTICATED);
      AppState.persistSession({
        authToken: token,
        refreshToken: rt,
        currentUser: null,
      });
      redirectToApp();
    } else if (auth === "error") {
      showMessage(
        "authMessage",
        params.get("message") || "Login failed",
        "error",
      );
    } else {
      // Unknown auth value — surface it rather than silently ignoring
      showMessage(
        "authMessage",
        "Unexpected login response. Please try again.",
        "error",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Phone OTP
  // ---------------------------------------------------------------------------
  var _resendTimerId = null;

  function maskPhone(phone) {
    if (!phone || phone.length < 6) return phone;
    return phone.slice(0, 3) + " *** " + phone.slice(-4);
  }

  function startResendTimer() {
    var timerEl = document.getElementById("resendTimer");
    var btn = document.getElementById("resendOtpBtn");
    if (!timerEl || !btn) return;

    var remaining = 60;
    btn.disabled = true;
    timerEl.textContent = remaining;

    if (_resendTimerId) clearInterval(_resendTimerId);
    _resendTimerId = setInterval(function () {
      remaining -= 1;
      timerEl.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(_resendTimerId);
        _resendTimerId = null;
        btn.disabled = false;
      }
    }, 1000);
  }

  function handleSendOtp() {
    var phoneInput = document.getElementById("phoneNumber");
    var phone = phoneInput ? phoneInput.value.trim() : "";
    if (!phone) {
      showMessage("authMessage", "Please enter a phone number", "error");
      return;
    }

    var sendBtn = document.getElementById("sendOtpBtn");
    var origText = sendBtn ? sendBtn.textContent : "";
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending\u2026";
    }

    fetch("/auth/phone/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone }),
    })
      .then(function (resp) {
        return resp.json().then(function (data) {
          if (!resp.ok) {
            var msg =
              data.error ||
              (data.errors && data.errors[0] && data.errors[0].message) ||
              "Failed to send code";
            showMessage("authMessage", msg, "error");
            return;
          }
          var otpSection = document.getElementById("otpSection");
          if (otpSection) otpSection.style.display = "block";
          var maskedEl = document.getElementById("otpPhoneMasked");
          if (maskedEl) maskedEl.textContent = maskPhone(phone);
          startResendTimer();
          showMessage("authMessage", "Verification code sent", "success");
        });
      })
      .catch(function () {
        showMessage("authMessage", "Failed to send code", "error");
      })
      .finally(function () {
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent = origText || "Send Code";
        }
      });
  }

  function handleResendOtp() {
    handleSendOtp();
  }

  function handleVerifyOtp() {
    var phoneInput = document.getElementById("phoneNumber");
    var codeInput = document.getElementById("otpCode");
    var phone = phoneInput ? phoneInput.value.trim() : "";
    var code = codeInput ? codeInput.value.trim() : "";

    if (!phone || !code) {
      showMessage("authMessage", "Please enter phone and code", "error");
      return;
    }

    var verifyBtn = document.getElementById("verifyOtpBtn");
    var origText = verifyBtn ? verifyBtn.textContent : "";
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = "Verifying\u2026";
    }

    fetch("/auth/phone/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone, code: code }),
    })
      .then(function (resp) {
        return resp.json().then(function (data) {
          if (!resp.ok) {
            showMessage(
              "authMessage",
              data.error || "Invalid or expired code",
              "error",
            );
            return;
          }
          authToken = data.token;
          refreshToken = data.refreshToken;
          setAuthState(AppState.AUTH_STATE.AUTHENTICATED);
          AppState.persistSession({
            authToken: data.token,
            refreshToken: data.refreshToken,
            currentUser: data.user,
          });
          redirectToApp();
        });
      })
      .catch(function () {
        showMessage("authMessage", "Verification failed", "error");
      })
      .finally(function () {
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = origText || "Verify";
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Verification URL handling (?verified=1|0)
  // ---------------------------------------------------------------------------
  function handleVerificationStatusFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var verified = params.get("verified");
    if (!verified) return;

    var isSuccess = verified === "1";
    var message = isSuccess
      ? "Email verified successfully. You can now log in."
      : "Email verification failed or expired. Request a new verification email.";
    var type = isSuccess ? "success" : "error";

    showLogin();
    showMessage("authMessage", message, type);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // ---------------------------------------------------------------------------
  // URL-driven reset-password token (?token=...)
  // Matches the link format sent by emailService.ts: /?token=TOKEN
  // Skips when ?auth= is present (social callback also uses ?token=).
  // ---------------------------------------------------------------------------
  function handleResetTokenFromUrl() {
    var params = new URLSearchParams(window.location.search);
    if (params.has("auth")) return; // social callback owns ?token= in this case
    var token = params.get("token");
    if (token) {
      showResetPassword(token);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // ---------------------------------------------------------------------------
  // Dark-mode persistence (mirrors app.js theme toggle)
  // ---------------------------------------------------------------------------
  function initTheme() {
    var stored = localStorage.getItem("darkMode");
    if (stored === "true") {
      document.body.classList.add("dark-mode");
    }
  }

  // ---------------------------------------------------------------------------
  // Event delegation (mirrors app.js data-onclick / data-onsubmit pattern)
  // ---------------------------------------------------------------------------
  var handlers = {
    switchAuthTab: switchAuthTab,
    showForgotPassword: showForgotPassword,
    showLogin: showLogin,
    showPhoneLogin: showPhoneLogin,
    handleGoogleLogin: handleGoogleLogin,
    handleAppleLogin: handleAppleLogin,
    handleSendOtp: handleSendOtp,
    handleResendOtp: handleResendOtp,
    handleVerifyOtp: handleVerifyOtp,
  };

  var submitHandlers = {
    handleLogin: handleLogin,
    handleRegister: handleRegister,
    handleForgotPassword: handleForgotPassword,
    handleResetPassword: handleResetPassword,
  };

  document.addEventListener("click", function (e) {
    var target = e.target.closest("[data-onclick]");
    if (!target) return;

    var expr = target.getAttribute("data-onclick");
    // Parse "fnName(args)" — support 'this' as first arg for switchAuthTab
    var match = expr.match(/^(\w+)\(([^)]*)\)$/);
    if (!match) return;

    var fnName = match[1];
    var fn = handlers[fnName];
    if (!fn) return;

    // Parse args — support 'string' literals and `this`
    var rawArgs = match[2].trim();
    var args = [];
    if (rawArgs) {
      args = rawArgs.split(",").map(function (a) {
        a = a.trim();
        if (a === "this") return target;
        // Strip surrounding quotes
        if (
          (a.charAt(0) === "'" && a.charAt(a.length - 1) === "'") ||
          (a.charAt(0) === '"' && a.charAt(a.length - 1) === '"')
        ) {
          return a.slice(1, -1);
        }
        return a;
      });
    }
    fn.apply(null, args);
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-onsubmit]");
    if (!form) return;

    var expr = form.getAttribute("data-onsubmit");
    var match = expr.match(/^(\w+)\(([^)]*)\)$/);
    if (!match) return;

    var fnName = match[1];
    var fn = submitHandlers[fnName];
    if (fn) fn(e);
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function boot() {
    initTheme();

    // If already authenticated, redirect to app
    var session = AppState.loadStoredSession();
    if (session.token && session.user) {
      redirectToApp();
      return;
    }

    // Handle URL-driven flows
    handleSocialCallback();
    handleVerificationStatusFromUrl();
    handleResetTokenFromUrl();

    // Probe for social providers
    initSocialLogin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
