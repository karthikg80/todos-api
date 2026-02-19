(function initAiSuggestionUtils(globalScope) {
  var escapeHtml = globalScope.Utils
    ? globalScope.Utils.escapeHtml
    : function (t) {
        var d = document.createElement("div");
        d.textContent = t;
        return d.innerHTML;
      };

  var AI_DEBUG_ENABLED =
    new URLSearchParams(globalScope.location.search).get("ai_debug") === "1";

  var ON_CREATE_SURFACE = "on_create";
  var TODAY_PLAN_SURFACE = "today_plan";

  var AI_SURFACE_TYPES = Object.freeze({
    [ON_CREATE_SURFACE]: new Set([
      "set_due_date",
      "set_priority",
      "set_project",
      "set_category",
      "rewrite_title",
      "ask_clarification",
    ]),
    [TODAY_PLAN_SURFACE]: new Set([
      "set_due_date",
      "set_priority",
      "split_subtasks",
      "propose_next_action",
    ]),
    task_drawer: new Set([
      "rewrite_title",
      "split_subtasks",
      "propose_next_action",
      "set_due_date",
      "set_priority",
      "set_project",
      "set_category",
      "ask_clarification",
      "propose_create_project",
    ]),
  });

  var AI_SURFACE_IMPACT = Object.freeze({
    [ON_CREATE_SURFACE]: Object.freeze({
      set_due_date: 0,
      set_priority: 1,
      set_project: 2,
      set_category: 2,
      rewrite_title: 3,
      ask_clarification: 4,
    }),
    [TODAY_PLAN_SURFACE]: Object.freeze({
      set_due_date: 0,
      set_priority: 1,
      split_subtasks: 2,
      propose_next_action: 3,
    }),
    task_drawer: Object.freeze({
      propose_next_action: 0,
      set_due_date: 1,
      set_priority: 2,
      rewrite_title: 3,
      split_subtasks: 4,
      set_project: 5,
      set_category: 5,
      propose_create_project: 6,
      ask_clarification: 7,
    }),
  });

  function isKnownSuggestionType(type) {
    var suggestionType = String(type || "");
    return Object.values(AI_SURFACE_TYPES).some(function (set) {
      return set.has(suggestionType);
    });
  }

  function impactRankForSurface(surface, type) {
    var surfaceMap = AI_SURFACE_IMPACT[String(surface || "")] || null;
    if (!surfaceMap) return Number.MAX_SAFE_INTEGER;
    var rank = surfaceMap[String(type || "")];
    return Number.isInteger(rank) ? rank : Number.MAX_SAFE_INTEGER;
  }

  function sortSuggestions(surface, suggestions) {
    var list = Array.isArray(suggestions) ? suggestions : [];
    return list.slice().sort(function (a, b) {
      var impactDelta =
        impactRankForSurface(surface, a && a.type) -
        impactRankForSurface(surface, b && b.type);
      if (impactDelta !== 0) return impactDelta;
      var confidenceA = Number((a && a.confidence) || 0) || 0;
      var confidenceB = Number((b && b.confidence) || 0) || 0;
      if (confidenceA !== confidenceB) return confidenceB - confidenceA;
      return String((a && a.suggestionId) || "").localeCompare(
        String((b && b.suggestionId) || ""),
      );
    });
  }

  function capSuggestions(suggestions, max) {
    var list = Array.isArray(suggestions) ? suggestions : [];
    return list.slice(0, Math.max(0, max || 6));
  }

  function confidenceBand(confidence) {
    var value = Number(confidence) || 0;
    if (value >= 0.75) return "high";
    if (value >= 0.45) return "med";
    return "low";
  }

  function confidenceLabel(confidence) {
    var band = confidenceBand(confidence);
    return band === "high" ? "High" : band === "med" ? "Med" : "Low";
  }

  function labelForType(type) {
    var labels = {
      set_due_date: "Set due date",
      set_priority: "Set priority",
      set_project: "Set project",
      set_category: "Set category",
      rewrite_title: "Rewrite title",
      ask_clarification: "Clarify once",
      split_subtasks: "Split subtasks",
      propose_next_action: "Propose next action",
      propose_create_project: "Propose create project",
    };
    return labels[String(type || "")] || "Suggestion";
  }

  function truncateRationale(text, maxLen) {
    var max = maxLen || 120;
    return String(text || "")
      .replace(/[`*_#[\]()>-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, Math.max(0, max));
  }

  function needsConfirmation(suggestion) {
    return !!(suggestion && suggestion.requiresConfirmation);
  }

  function shouldRenderTypeForSurface(surface, type) {
    var set = AI_SURFACE_TYPES[String(surface || "")];
    if (!set) return false;
    return set.has(String(type || ""));
  }

  function renderAiDebugMeta(meta) {
    if (!AI_DEBUG_ENABLED) return "";
    var m = meta || {};
    var rows = [
      m.contractVersion ? "v" + escapeHtml(String(m.contractVersion)) : "",
      m.requestId ? "req:" + escapeHtml(String(m.requestId)) : "",
      m.generatedAt ? escapeHtml(String(m.generatedAt)) : "",
    ].filter(Boolean);
    if (!rows.length) return "";
    return (
      '<div class="ai-debug-meta" data-testid="ai-debug-meta">' +
      rows.join(" · ") +
      "</div>"
    );
  }

  function renderAiDebugSuggestionId(suggestionId) {
    if (!AI_DEBUG_ENABLED) return "";
    var id = escapeHtml(String(suggestionId || ""));
    return (
      '<div class="ai-debug-suggestion-id" data-testid="ai-debug-suggestion-id-' +
      id +
      '">' +
      id +
      "</div>"
    );
  }

  globalScope.AiSuggestionUtils = {
    AI_DEBUG_ENABLED: AI_DEBUG_ENABLED,
    ON_CREATE_SURFACE: ON_CREATE_SURFACE,
    TODAY_PLAN_SURFACE: TODAY_PLAN_SURFACE,
    AI_SURFACE_TYPES: AI_SURFACE_TYPES,
    AI_SURFACE_IMPACT: AI_SURFACE_IMPACT,
    isKnownSuggestionType: isKnownSuggestionType,
    impactRankForSurface: impactRankForSurface,
    sortSuggestions: sortSuggestions,
    capSuggestions: capSuggestions,
    confidenceBand: confidenceBand,
    confidenceLabel: confidenceLabel,
    labelForType: labelForType,
    truncateRationale: truncateRationale,
    needsConfirmation: needsConfirmation,
    shouldRenderTypeForSurface: shouldRenderTypeForSurface,
    renderAiDebugMeta: renderAiDebugMeta,
    renderAiDebugSuggestionId: renderAiDebugSuggestionId,
  };
})(window);
