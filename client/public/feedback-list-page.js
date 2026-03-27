// feedback-list-page.js — Standalone feedback list controller (IIFE, no ES modules)
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

  // Auth gate — read token directly to avoid loadStoredSession user-object coupling
  var token = localStorage.getItem("authToken");
  if (!token) {
    window.location.replace("/auth");
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
      window.location.replace("/auth");
    },
    onAuthTokens: function (nextToken, nextRefreshToken) {
      localStorage.setItem("authToken", nextToken);
      localStorage.setItem("refreshToken", nextRefreshToken);
    },
  });

  var STATUS_LABELS = {
    new: "Submitted",
    triaged: "Under review",
    promoted: "Tracked",
    rejected: "Closed",
  };

  function formatDate(isoString) {
    try {
      var d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch (_) {
      return "";
    }
  }

  function createTextEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    return el;
  }

  function renderList(items) {
    var container = document.getElementById("feedbackListContainer");
    if (!container) return;
    container.textContent = "";

    if (!items || items.length === 0) {
      var empty = createTextEl(
        "p",
        "feedback-list__empty",
        "No feedback submitted yet.",
      );
      container.appendChild(empty);
      return;
    }

    var ul = document.createElement("ul");
    ul.className = "feedback-list";

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var li = document.createElement("li");
      li.className = "feedback-list__item";

      var typeClass =
        item.type === "feature"
          ? "feedback-list__type--feature"
          : "feedback-list__type--bug";
      li.appendChild(
        createTextEl("span", "feedback-list__type " + typeClass, item.type),
      );

      li.appendChild(createTextEl("span", "feedback-list__title", item.title));

      var statusClass = "feedback-list__status--" + (item.status || "new");
      var statusLabel = STATUS_LABELS[item.status] || item.status;
      li.appendChild(
        createTextEl(
          "span",
          "feedback-list__status " + statusClass,
          statusLabel,
        ),
      );

      if (item.status === "promoted" && item.githubIssueUrl) {
        var link = document.createElement("a");
        link.className = "feedback-list__link";
        link.href = item.githubIssueUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "View issue";
        li.appendChild(link);
      }

      li.appendChild(
        createTextEl("span", "feedback-list__date", formatDate(item.createdAt)),
      );

      ul.appendChild(li);
    }

    container.appendChild(ul);
  }

  async function loadFeedback() {
    try {
      var response = await apiClient.apiCall(API_URL + "/api/feedback");
      if (!response || !response.ok) {
        Utils.showMessage(
          "feedbackMessage",
          "Could not load feedback.",
          "error",
        );
        return;
      }
      var items = await response.json();
      renderList(items);
    } catch (error) {
      console.error("Failed to load feedback:", error);
      Utils.showMessage(
        "feedbackMessage",
        "Something went wrong loading your feedback.",
        "error",
      );
    }
  }

  if (window.StandaloneTransitions) {
    StandaloneTransitions.fadeInOnLoad();
    StandaloneTransitions.bindNavigateLinks();
  }

  loadFeedback();
})();
