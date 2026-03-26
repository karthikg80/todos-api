// auth-page.js — Standalone initializer for public/auth.html.
// Provides auth form handlers without depending on app.js or its module graph.
// Depends on: /utils/theme.js, /utils/authSession.js, /utils/apiClient.js.
//
// SECURITY NOTE: The data-onclick/data-onsubmit event delegation uses
// new Function() intentionally. The values come from static HTML attributes
// authored by developers, not from user input. This is an existing codebase
// convention used across all pages.

(function () {
  "use strict";

  var API_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:" + (window.location.port || "3000")
      : window.location.origin;

  // ---------------------------------------------------------------------------
  // Message helpers (self-contained — does not depend on utils.js)
  // ---------------------------------------------------------------------------

  function showMessage(id, message, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.className = "message " + (type || "error") + " show";
  }

  function hideMessage(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = "";
    el.className = "message";
  }

  // ---------------------------------------------------------------------------
  // Tab / form switching
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

    document.querySelectorAll(".auth-tab").forEach(function (t) {
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
    var form = document.getElementById("resetPasswordForm");
    if (form) {
      form.dataset.token = token;
      document.querySelectorAll(".auth-form").forEach(function (f) {
        f.style.display = "none";
      });
      form.style.display = "block";
    }
  }

  // ---------------------------------------------------------------------------
  // Auth API handlers
  // ---------------------------------------------------------------------------

  function persistAndRedirect(data) {
    if (window.AppState && window.AppState.persistSession) {
      window.AppState.persistSession({
        authToken: data.token,
        refreshToken: data.refreshToken,
        currentUser: data.user,
      });
    }
    localStorage.setItem("token", data.token);
    if (data.refreshToken) {
      localStorage.setItem("refreshToken", data.refreshToken);
    }
    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    window.location.href = "/app";
  }

  async function handleLogin(event) {
    event.preventDefault();
    hideMessage("authMessage");

    var email = document.getElementById("loginEmail").value;
    var password = document.getElementById("loginPassword").value;

    var btn = document.querySelector("#loginForm button[type='submit']");
    if (btn) {
      btn.disabled = true;
      btn._origText = btn.textContent;
      btn.textContent = "Signing in\u2026";
    }

    try {
      var response = await fetch(API_URL + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password }),
      });
      var data = await response.json();

      if (response.ok) {
        persistAndRedirect(data);
      } else {
        showMessage("authMessage", data.error || "Login failed", "error");
      }
    } catch (err) {
      showMessage("authMessage", "Network error. Please try again.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn._origText || "Login";
      }
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    hideMessage("authMessage");

    var name = document.getElementById("registerName").value;
    var email = document.getElementById("registerEmail").value;
    var password = document.getElementById("registerPassword").value;

    var payload = { email: email, password: password };
    if (name) payload.name = name;

    var btn = document.querySelector("#registerForm button[type='submit']");
    if (btn) {
      btn.disabled = true;
      btn._origText = btn.textContent;
      btn.textContent = "Creating account\u2026";
    }

    try {
      var response = await fetch(API_URL + "/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      var data = await response.json();

      if (response.ok) {
        persistAndRedirect(data);
      } else {
        var msg =
          data.errors && data.errors.length
            ? data.errors
                .map(function (e) {
                  return e.message;
                })
                .join(", ")
            : data.error || "Registration failed";
        showMessage("authMessage", msg, "error");
      }
    } catch (err) {
      showMessage("authMessage", "Network error. Please try again.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn._origText || "Create Account";
      }
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    hideMessage("authMessage");

    var email = document.getElementById("forgotEmail").value;

    try {
      var response = await fetch(API_URL + "/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email }),
      });
      var data = await response.json();

      if (response.ok) {
        showMessage(
          "authMessage",
          data.message || "Reset link sent",
          "success",
        );
      } else {
        showMessage("authMessage", data.error || "Request failed", "error");
      }
    } catch (err) {
      showMessage("authMessage", "Network error. Please try again.", "error");
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    hideMessage("authMessage");

    var form = document.getElementById("resetPasswordForm");
    var token = form ? form.dataset.token : "";
    var password = document.getElementById("newPassword").value;
    var confirm = document.getElementById("confirmPassword").value;

    if (password !== confirm) {
      showMessage("authMessage", "Passwords do not match", "error");
      return;
    }

    try {
      var response = await fetch(API_URL + "/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, password: password }),
      });
      var data = await response.json();

      if (response.ok) {
        showMessage(
          "authMessage",
          "Password reset! You can now log in.",
          "success",
        );
        setTimeout(function () {
          showLogin();
        }, 1500);
      } else {
        showMessage("authMessage", data.error || "Reset failed", "error");
      }
    } catch (err) {
      showMessage("authMessage", "Network error. Please try again.", "error");
    }
  }

  // ---------------------------------------------------------------------------
  // Social / phone auth (redirect-based, no complex state needed)
  // ---------------------------------------------------------------------------

  function handleGoogleLogin() {
    window.location.href = "/auth/google/start";
  }

  function handleAppleLogin() {
    window.location.href = "/auth/apple/start";
  }

  function showPhoneLogin() {
    switchAuthTab("phoneLogin");
  }

  async function handleSendOtp() {
    hideMessage("authMessage");
    var phone = document.getElementById("phoneNumber").value;
    var btn = document.getElementById("sendOtpBtn");
    if (btn) btn.disabled = true;

    try {
      var response = await fetch(API_URL + "/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone }),
      });
      var data = await response.json();

      if (response.ok) {
        document.getElementById("otpSection").style.display = "block";
        var masked = phone.replace(/(\+\d{1,3})\d+(\d{4})/, "$1 *** *** $2");
        var span = document.getElementById("otpPhoneMasked");
        if (span) span.textContent = masked;
        startResendTimer();
      } else {
        showMessage(
          "authMessage",
          data.error || "Failed to send code",
          "error",
        );
      }
    } catch (err) {
      showMessage("authMessage", "Network error. Please try again.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleVerifyOtp() {
    hideMessage("authMessage");
    var phone = document.getElementById("phoneNumber").value;
    var code = document.getElementById("otpCode").value;

    try {
      var response = await fetch(API_URL + "/auth/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone, code: code }),
      });
      var data = await response.json();

      if (response.ok) {
        persistAndRedirect(data);
      } else {
        showMessage(
          "authMessage",
          data.error || "Verification failed",
          "error",
        );
      }
    } catch (err) {
      showMessage("authMessage", "Network error. Please try again.", "error");
    }
  }

  var resendInterval = null;
  function startResendTimer() {
    var btn = document.getElementById("resendOtpBtn");
    var timerSpan = document.getElementById("resendTimer");
    if (!btn || !timerSpan) return;
    btn.disabled = true;
    var seconds = 60;
    timerSpan.textContent = seconds;
    if (resendInterval) clearInterval(resendInterval);
    resendInterval = setInterval(function () {
      seconds--;
      timerSpan.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(resendInterval);
        btn.disabled = false;
      }
    }, 1000);
  }

  function handleResendOtp() {
    handleSendOtp();
  }

  async function initSocialLogin() {
    try {
      var response = await fetch(API_URL + "/auth/providers");
      if (!response.ok) return;
      var data = await response.json();

      ["loginSocialSection", "registerSocialSection"].forEach(function (id) {
        var sec = document.getElementById(id);
        if (!sec) return;
        var hasAny = data.google || data.apple || data.phone;
        sec.style.display = hasAny ? "block" : "none";

        var prefix = id.startsWith("login") ? "login" : "register";
        var gBtn = document.getElementById(prefix + "GoogleBtn");
        var aBtn = document.getElementById(prefix + "AppleBtn");
        var pBtn = document.getElementById(prefix + "PhoneBtn");
        if (gBtn) gBtn.style.display = data.google ? "flex" : "none";
        if (aBtn) aBtn.style.display = data.apple ? "flex" : "none";
        if (pBtn) pBtn.style.display = data.phone ? "flex" : "none";
      });
    } catch (err) {
      // Social login discovery failed — buttons stay hidden
    }
  }

  // ---------------------------------------------------------------------------
  // Event delegation (data-onclick / data-onsubmit)
  // ---------------------------------------------------------------------------

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-onclick]");
    if (el) {
      new Function(el.dataset.onclick).call(el); // eslint-disable-line no-new-func
    }
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-onsubmit]");
    if (form) {
      e.preventDefault();
      new Function("event", form.dataset.onsubmit).call(form, e); // eslint-disable-line no-new-func
    }
  });

  // ---------------------------------------------------------------------------
  // URL parameter handling on DOMContentLoaded
  // ---------------------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", function () {
    var params = new URLSearchParams(window.location.search);

    // OAuth callback: /auth?auth=success&token=...&refreshToken=...
    var auth = params.get("auth");
    if (auth === "success") {
      var token = params.get("token");
      var refreshToken = params.get("refreshToken");
      if (token && refreshToken) {
        persistAndRedirect({
          token: token,
          refreshToken: refreshToken,
          user: null,
        });
        return;
      }
    } else if (auth === "error") {
      showMessage(
        "authMessage",
        params.get("message") || "Login failed",
        "error",
      );
      window.history.replaceState({}, document.title, "/auth");
      return;
    }

    // Email verification: /auth?verified=1 or /auth?verified=0
    var verified = params.get("verified");
    if (verified !== null) {
      if (verified === "1") {
        showMessage(
          "authMessage",
          "Email verified successfully! You can now log in.",
          "success",
        );
      } else {
        showMessage(
          "authMessage",
          "Email verification failed or link expired.",
          "error",
        );
      }
      window.history.replaceState({}, document.title, "/auth");
      return;
    }

    // Tab switching: /auth?tab=register
    var tab = params.get("tab");
    if (tab === "register") {
      switchAuthTab("register", document.getElementById("registerTabButton"));
    }

    // Password reset: /auth?resetToken=...
    var resetToken = params.get("resetToken");
    if (resetToken) {
      showResetPassword(resetToken);
    }

    // Discover social login providers
    initSocialLogin();
  });

  // ---------------------------------------------------------------------------
  // Expose to global scope for data-onclick/data-onsubmit attributes
  // ---------------------------------------------------------------------------

  window.switchAuthTab = switchAuthTab;
  window.showForgotPassword = showForgotPassword;
  window.showLogin = showLogin;
  window.showResetPassword = showResetPassword;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
  window.handleForgotPassword = handleForgotPassword;
  window.handleResetPassword = handleResetPassword;
  window.handleGoogleLogin = handleGoogleLogin;
  window.handleAppleLogin = handleAppleLogin;
  window.showPhoneLogin = showPhoneLogin;
  window.handleSendOtp = handleSendOtp;
  window.handleVerifyOtp = handleVerifyOtp;
  window.handleResendOtp = handleResendOtp;
})();
