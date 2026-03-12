// =============================================================================
// homeAiService.js — Home dashboard AI suggestion lifecycle.
// Reuses the existing AI suggestion endpoints instead of a custom Home path.
// =============================================================================

import { state, hooks } from "./store.js";
import { runAsyncLifecycle } from "./asyncLifecycle.js";
import { applyAsyncAction } from "./stateActions.js";

const HOME_FOCUS_SURFACE = "home_focus";

function rerenderHomeSurface(reason) {
  hooks.applyFiltersAndRender?.({ reason });
}

function clampConfidence(value) {
  const numeric = Number(value) || 0;
  return Math.max(0, Math.min(1, numeric));
}

function parseSource(value) {
  return value === "ai" || value === "hybrid" ? value : "deterministic";
}

function normalizeHomeFocusSuggestion(rawSuggestion, index) {
  if (!rawSuggestion || typeof rawSuggestion !== "object") return null;

  const payload =
    rawSuggestion.payload && typeof rawSuggestion.payload === "object"
      ? rawSuggestion.payload
      : {};
  const type = String(rawSuggestion.type || "");
  if (type !== "focus_task") return null;

  const suggestionId = String(rawSuggestion.suggestionId || "").trim();
  const todoId = String(
    rawSuggestion.todoId ||
      payload.todoId ||
      rawSuggestion.taskId ||
      payload.taskId ||
      "",
  ).trim();
  const title = String(rawSuggestion.title || payload.title || "").trim();
  const summary = String(rawSuggestion.summary || payload.summary || "").trim();

  if (!suggestionId || !todoId || !title || !summary) {
    return null;
  }

  return {
    type,
    suggestionId,
    todoId,
    taskId: String(rawSuggestion.taskId || payload.taskId || todoId).trim(),
    projectId: String(
      rawSuggestion.projectId || payload.projectId || "",
    ).trim(),
    title,
    summary: hooks.truncateRationale(summary, 140),
    source: parseSource(rawSuggestion.source || payload.source),
    confidence: clampConfidence(rawSuggestion.confidence),
    payload,
    order: Number.isFinite(index) ? index : 0,
  };
}

function normalizeHomeFocusEnvelope(rawEnvelope) {
  const suggestions = (
    Array.isArray(rawEnvelope?.suggestions) ? rawEnvelope.suggestions : []
  )
    .map((suggestion, index) => normalizeHomeFocusSuggestion(suggestion, index))
    .filter(Boolean);

  const sortedSuggestions =
    typeof hooks.sortSuggestions === "function"
      ? hooks.sortSuggestions(HOME_FOCUS_SURFACE, suggestions)
      : suggestions;

  return {
    contractVersion: Number(rawEnvelope?.contractVersion) || 1,
    generatedAt: String(rawEnvelope?.generatedAt || new Date().toISOString()),
    requestId: String(rawEnvelope?.requestId || "home-focus"),
    surface: HOME_FOCUS_SURFACE,
    must_abstain: !!rawEnvelope?.must_abstain,
    suggestions: Array.isArray(sortedSuggestions)
      ? sortedSuggestions.slice(0, 3)
      : [],
  };
}

async function fetchHomeFocusLatestSuggestion() {
  return hooks.apiCall(
    `${hooks.API_URL}/ai/suggestions/latest?surface=${HOME_FOCUS_SURFACE}`,
  );
}

async function generateHomeFocusSuggestions(candidates) {
  return hooks.apiCall(`${hooks.API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      surface: HOME_FOCUS_SURFACE,
      topN: 3,
      candidates,
    }),
  });
}

function shouldReuseHomeFocusState(requestKey, force) {
  if (!requestKey) return true;
  if (state.homeAi.requestKey !== requestKey) return false;
  if (state.homeAi.status === "loading") return true;
  if (!force && state.homeAi.lastLoadedAt) return true;
  return false;
}

export async function loadHomeFocusSuggestions({
  candidates = [],
  requestKey = "",
  force = false,
} = {}) {
  const normalizedRequestKey = String(requestKey || "");
  if (
    !normalizedRequestKey ||
    !Array.isArray(candidates) ||
    !candidates.length
  ) {
    if (
      state.homeAi.status !== "idle" ||
      state.homeAi.suggestions.length > 0 ||
      state.homeAi.requestKey
    ) {
      applyAsyncAction("homeAi/reset");
      rerenderHomeSurface("home-focus-reset");
    }
    return;
  }

  if (shouldReuseHomeFocusState(normalizedRequestKey, force)) {
    return;
  }

  await runAsyncLifecycle({
    start: () => {
      applyAsyncAction("homeAi/start", { requestKey: normalizedRequestKey });
      rerenderHomeSurface("home-focus-loading");
    },
    run: async () => {
      let latestResponse = await fetchHomeFocusLatestSuggestion();
      if (latestResponse.status === 403 || latestResponse.status === 404) {
        return { outcome: "unavailable" };
      }

      if (latestResponse.status === 204) {
        const generated = await generateHomeFocusSuggestions(candidates);
        if (generated.status === 403 || generated.status === 404) {
          return { outcome: "unavailable" };
        }
        if (!generated.ok) {
          return { outcome: "failure" };
        }
        latestResponse = await fetchHomeFocusLatestSuggestion();
      }

      if (latestResponse.status === 204) {
        return {
          outcome: "empty",
          envelope: normalizeHomeFocusEnvelope({
            surface: HOME_FOCUS_SURFACE,
            must_abstain: true,
            suggestions: [],
          }),
        };
      }

      if (!latestResponse.ok) {
        return { outcome: "failure" };
      }

      const payload = await hooks.parseApiBody(latestResponse);
      const envelope = normalizeHomeFocusEnvelope(
        payload?.outputEnvelope || {},
      );
      if (envelope.must_abstain || envelope.suggestions.length === 0) {
        return { outcome: "empty", envelope };
      }

      return {
        outcome: "success",
        payload: {
          aiSuggestionId: String(payload?.aiSuggestionId || ""),
          suggestions: envelope.suggestions,
        },
      };
    },
    success: (result) => {
      if (state.homeAi.requestKey !== normalizedRequestKey) {
        return;
      }

      if (result?.outcome === "unavailable") {
        applyAsyncAction("homeAi/unavailable");
      } else if (result?.outcome === "empty") {
        applyAsyncAction("homeAi/empty");
      } else if (result?.outcome === "failure") {
        applyAsyncAction("homeAi/failure", {
          error: "Could not load AI focus right now.",
        });
      } else if (result?.outcome === "success") {
        applyAsyncAction("homeAi/success", result.payload);
      }
      rerenderHomeSurface("home-focus-loaded");
    },
    failure: (error) => {
      if (state.homeAi.requestKey !== normalizedRequestKey) {
        return;
      }
      console.error("Home focus AI load failed:", error);
      applyAsyncAction("homeAi/failure", {
        error: "Could not load AI focus right now.",
      });
      rerenderHomeSurface("home-focus-failed");
    },
  });
}

export async function refreshHomeFocusSuggestions() {
  const nextRequestKey = String(state.homeAi.requestKey || "");
  applyAsyncAction("homeAi/reset", { requestKey: nextRequestKey });
  rerenderHomeSurface("home-focus-refresh");
}

export async function applyHomeFocusSuggestion(suggestionId) {
  const normalizedSuggestionId = String(suggestionId || "").trim();
  if (!normalizedSuggestionId || !state.homeAi.aiSuggestionId) return;

  applyAsyncAction("homeAi/apply:start", {
    suggestionId: normalizedSuggestionId,
  });
  rerenderHomeSurface("home-focus-apply-start");

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/ai/suggestions/${encodeURIComponent(state.homeAi.aiSuggestionId)}/apply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: normalizedSuggestionId }),
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};
    if (!response || !response.ok) {
      throw new Error(String(data?.error || "home-focus-apply-failed"));
    }

    applyAsyncAction("homeAi/apply:complete");
    applyAsyncAction("homeAi/reset");
    rerenderHomeSurface("home-focus-applied");

    if (data?.todo?.id) {
      hooks.openTodoDrawer?.(
        String(data.todo.id),
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      );
    }
  } catch (error) {
    console.error("Home focus apply failed:", error);
    applyAsyncAction("homeAi/apply:complete");
    applyAsyncAction("homeAi/error:set", {
      error: "Could not apply focus suggestion.",
    });
    rerenderHomeSurface("home-focus-apply-failed");
  }
}

export async function dismissHomeFocusSuggestion(suggestionId) {
  const normalizedSuggestionId = String(suggestionId || "").trim();
  if (!state.homeAi.aiSuggestionId) return;

  applyAsyncAction("homeAi/dismiss:start", {
    suggestionId: normalizedSuggestionId,
  });
  rerenderHomeSurface("home-focus-dismiss-start");

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/ai/suggestions/${encodeURIComponent(state.homeAi.aiSuggestionId)}/dismiss`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: normalizedSuggestionId || undefined,
        }),
      },
    );
    if (!response || !response.ok) {
      const data = response ? await hooks.parseApiBody(response) : {};
      throw new Error(String(data?.error || "home-focus-dismiss-failed"));
    }

    applyAsyncAction("homeAi/dismiss:complete");
    applyAsyncAction("homeAi/reset");
    rerenderHomeSurface("home-focus-dismissed");
  } catch (error) {
    console.error("Home focus dismiss failed:", error);
    applyAsyncAction("homeAi/dismiss:complete");
    applyAsyncAction("homeAi/error:set", {
      error: "Could not dismiss focus suggestion.",
    });
    rerenderHomeSurface("home-focus-dismiss-failed");
  }
}
