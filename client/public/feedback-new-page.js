// feedback-new-page.js — Standalone feedback submit controller (IIFE, no ES modules)
(function () {
  "use strict";

  var AppState = window.AppState;
  var ApiClient = window.ApiClient;
  var Utils = window.Utils;

  if (!AppState || !ApiClient || !Utils) {
    document.addEventListener("DOMContentLoaded", function () {
      document.body.textContent =
        "Feedback page failed to load: missing dependencies.";
    });
    return;
  }

  function buildAuthUrl() {
    var next =
      window.location.pathname + window.location.search + window.location.hash;
    return "/auth?next=" + encodeURIComponent(next);
  }

  // Auth gate — read token directly to avoid loadStoredSession user-object coupling
  var token = localStorage.getItem("authToken");
  if (!token) {
    window.location.replace(buildAuthUrl());
    return;
  }

  var API_URL =
    window.location.hostname === "localhost" ? "http://localhost:3000" : "";

  var apiClient = ApiClient.createApiClient({
    apiUrl: API_URL,
    getAuthToken: function () {
      return localStorage.getItem("authToken");
    },
    getRefreshToken: function () {
      return localStorage.getItem("refreshToken");
    },
    getAuthState: function () {
      return "authenticated";
    },
    setAuthState: function () {},
    onAuthFailure: function () {
      AppState.clearSession();
      window.location.replace(buildAuthUrl());
    },
    onAuthTokens: function (nextToken, nextRefreshToken) {
      localStorage.setItem("authToken", nextToken);
      localStorage.setItem("refreshToken", nextRefreshToken);
    },
  });

  // ---------------------------------------------------------------------------
  // Question copy per type
  // ---------------------------------------------------------------------------
  var BUG_QUESTIONS = {
    firstLabel: "What happened?",
    secondLabel: "What did you expect?",
    thirdLabel: "What were you doing right before it happened?",
    successTitle: "Bug report sent",
    successBody:
      "Thanks for the report. We saved the context with it so we can review it with context.",
  };

  var FEATURE_QUESTIONS = {
    firstLabel: "What are you trying to do?",
    secondLabel: "What is hard today?",
    thirdLabel: "What would make this better?",
    successTitle: "Feature request sent",
    successBody:
      "Thanks for the idea. We saved it with your app context so it is ready for review.",
  };

  function getQuestionCopy() {
    var typeEl = document.getElementById("feedbackType");
    var type = typeEl && typeEl.value === "feature" ? "feature" : "bug";
    return type === "feature" ? FEATURE_QUESTIONS : BUG_QUESTIONS;
  }

  function readAppVersion() {
    var meta = document.querySelector('meta[name="app-version"]');
    return (meta && meta.getAttribute("content")) || "unknown";
  }

  // ---------------------------------------------------------------------------
  // Type change — update labels
  // ---------------------------------------------------------------------------
  function syncLabels() {
    var copy = getQuestionCopy();
    var l1 = document.getElementById("feedbackQuestionOneLabel");
    var l2 = document.getElementById("feedbackQuestionTwoLabel");
    var l3 = document.getElementById("feedbackQuestionThreeLabel");
    if (l1) l1.textContent = copy.firstLabel;
    if (l2) l2.textContent = copy.secondLabel;
    if (l3) l3.textContent = copy.thirdLabel;
  }

  // ---------------------------------------------------------------------------
  // Context preview
  // ---------------------------------------------------------------------------
  function syncContext() {
    var pageEl = document.getElementById("feedbackContextPage");
    var verEl = document.getElementById("feedbackContextVersion");
    var userEl = document.getElementById("feedbackContextUser");
    if (pageEl) pageEl.textContent = window.location.href;
    if (verEl) verEl.textContent = readAppVersion();
    if (userEl) userEl.textContent = "Signed in";
  }

  // ---------------------------------------------------------------------------
  // Build body from 3 fields
  // ---------------------------------------------------------------------------
  function buildBody() {
    var copy = getQuestionCopy();
    var f1 = document.getElementById("feedbackQuestionOne");
    var f2 = document.getElementById("feedbackQuestionTwo");
    var f3 = document.getElementById("feedbackQuestionThree");
    var first = f1 ? f1.value : "";
    var second = f2 ? f2.value : "";
    var third = f3 ? f3.value : "";

    return [
      [copy.firstLabel, first],
      [copy.secondLabel, second],
      [copy.thirdLabel, third],
    ]
      .map(function (pair) {
        return pair[0] + "\n" + (pair[1] || "").trim();
      })
      .join("\n\n")
      .trim();
  }

  // ---------------------------------------------------------------------------
  // Show confirmation
  // ---------------------------------------------------------------------------
  function showConfirmation(requestId) {
    var copy = getQuestionCopy();
    var form = document.getElementById("feedbackForm");
    var conf = document.getElementById("feedbackConfirmation");
    var titleEl = document.getElementById("feedbackConfirmationTitle");
    var bodyEl = document.getElementById("feedbackConfirmationBody");
    var metaEl = document.getElementById("feedbackConfirmationMeta");

    if (form) form.hidden = true;
    if (conf) conf.hidden = false;
    if (titleEl) titleEl.textContent = copy.successTitle;
    if (bodyEl) bodyEl.textContent = copy.successBody;
    if (metaEl)
      metaEl.textContent = requestId
        ? "Reference ID: " + requestId
        : "Your feedback has been saved.";
  }

  function resetForm() {
    var form = document.getElementById("feedbackForm");
    var conf = document.getElementById("feedbackConfirmation");
    if (form instanceof HTMLFormElement) {
      form.reset();
      form.hidden = false;
    }
    if (conf) conf.hidden = true;
    var typeEl = document.getElementById("feedbackType");
    if (typeEl) typeEl.value = "bug";
    Utils.hideMessage("feedbackMessage");
    syncLabels();
    syncContext();
  }

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  async function handleSubmit(event) {
    event.preventDefault();

    var titleEl = document.getElementById("feedbackTitle");
    var titleValue = titleEl ? titleEl.value.trim() : "";
    if (!titleValue) {
      Utils.showMessage(
        "feedbackMessage",
        "Please add a short title.",
        "error",
      );
      return;
    }

    var f1 = document.getElementById("feedbackQuestionOne");
    var firstAnswer = f1 ? f1.value.trim() : "";
    if (!firstAnswer) {
      Utils.showMessage(
        "feedbackMessage",
        "Please answer the first question before sending.",
        "error",
      );
      return;
    }

    var typeEl = document.getElementById("feedbackType");
    var type = typeEl && typeEl.value === "feature" ? "feature" : "bug";
    var screenshotUrlEl = document.getElementById("feedbackScreenshotUrl");
    var screenshotUrl = screenshotUrlEl ? screenshotUrlEl.value.trim() : "";

    var payload = {
      type: type,
      title: titleValue,
      body: buildBody(),
      screenshotUrl: screenshotUrl || null,
      attachmentMetadata: null,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      appVersion: readAppVersion(),
    };

    Utils.hideMessage("feedbackMessage");

    try {
      var response = await apiClient.apiCall(API_URL + "/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response || !response.ok) {
        var errData = {};
        try {
          errData = await response.json();
        } catch (_) {
          /* ignore parse error */
        }
        Utils.showMessage(
          "feedbackMessage",
          errData.error || "Failed to send feedback.",
          "error",
        );
        return;
      }

      var data = await response.json();
      showConfirmation(data.id);
    } catch (error) {
      console.error("Feedback submit error:", error);
      Utils.showMessage(
        "feedbackMessage",
        "Something went wrong. Please try again.",
        "error",
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  if (window.StandaloneTransitions) {
    StandaloneTransitions.fadeInOnLoad();
    StandaloneTransitions.bindNavigateLinks();
  }

  document.addEventListener("DOMContentLoaded", function () {
    syncLabels();
    syncContext();

    var typeEl = document.getElementById("feedbackType");
    if (typeEl) {
      typeEl.addEventListener("change", syncLabels);
    }

    var form = document.getElementById("feedbackForm");
    if (form) {
      form.addEventListener("submit", handleSubmit);
    }

    var sendAnotherBtn = document.getElementById("sendAnotherBtn");
    if (sendAnotherBtn) {
      sendAnotherBtn.addEventListener("click", resetForm);
    }
  });
})();
