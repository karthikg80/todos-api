// =============================================================================
// todayPlan.js — Today Plan AI panel: generate, render, apply, undo.
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { createInitialTodayPlanState } from "./store.js";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resetTodayPlanState() {
  state.todayPlanState = createInitialTodayPlanState();
}

function getTodayPlanPanelElement() {
  const panel = document.getElementById("todayPlanPanel");
  if (!(panel instanceof HTMLElement)) return null;
  return panel;
}

function getTodayPlanImpactRank(type) {
  return hooks.impactRankForSurface(hooks.TODAY_PLAN_SURFACE, type);
}

function getTodayPlanConfidenceBadge(confidence) {
  return hooks.confidenceLabel(confidence);
}

function isTodayPlanViewActive() {
  return state.currentDateView === "today";
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
    rationale: hooks.truncateRationale(rationale, 120),
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
      surface: hooks.TODAY_PLAN_SURFACE,
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
    surface: hooks.TODAY_PLAN_SURFACE,
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
      hooks.shouldRenderTypeForSurface(
        hooks.TODAY_PLAN_SURFACE,
        suggestion?.type,
      ),
    )
    .map((suggestion) => ({
      type: String(suggestion.type),
      suggestionId: String(suggestion.suggestionId || ""),
      confidence: Math.max(0, Math.min(1, Number(suggestion.confidence) || 0)),
      rationale: hooks.truncateRationale(suggestion.rationale, 120),
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
      rationale: hooks.truncateRationale(item?.rationale, 120),
    }))
    .filter((item) => item.todoId && item.rank > 0);

  return {
    contractVersion: Number(rawEnvelope?.contractVersion) || 1,
    generatedAt: String(rawEnvelope?.generatedAt || new Date().toISOString()),
    requestId: String(rawEnvelope?.requestId || "today-plan"),
    surface: hooks.TODAY_PLAN_SURFACE,
    must_abstain: !!rawEnvelope?.must_abstain,
    planPreview: {
      topN: Number(rawEnvelope?.planPreview?.topN) || previewItems.length,
      items: previewItems,
    },
    suggestions: normalizedSuggestions,
  };
}

async function fetchTodayPlanLatestSuggestion() {
  return hooks.apiCall(
    `${hooks.API_URL}/ai/suggestions/latest?surface=${hooks.TODAY_PLAN_SURFACE}`,
  );
}

function buildTodayPlanCandidates() {
  return hooks.getVisibleTodos().map((todo) => ({
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
  return hooks.apiCall(`${hooks.API_URL}/ai/decision-assist/stub`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ai-explicit-request": "1",
    },
    body: JSON.stringify({
      surface: hooks.TODAY_PLAN_SURFACE,
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
  if (!hooks.FEATURE_TASK_DRAWER_DECISION_ASSIST) {
    state.todayPlanState.loading = false;
    state.todayPlanState.generating = false;
    state.todayPlanState.unavailable = true;
    state.todayPlanState.hasLoaded = true;
    renderTodayPlanPanel();
    return;
  }

  state.todayPlanState.loading = true;
  state.todayPlanState.error = "";
  state.todayPlanState.unavailable = false;
  renderTodayPlanPanel();

  try {
    let latestResponse = await fetchTodayPlanLatestSuggestion();
    if (latestResponse.status === 403 || latestResponse.status === 404) {
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.unavailable = true;
      state.todayPlanState.hasLoaded = true;
      renderTodayPlanPanel();
      return;
    }

    if (latestResponse.status === 204 && allowGenerate) {
      const generated = await generateTodayPlanSuggestion(
        state.todayPlanState.goalText,
      );
      if (generated.status === 403 || generated.status === 404) {
        state.todayPlanState.loading = false;
        state.todayPlanState.generating = false;
        state.todayPlanState.unavailable = true;
        state.todayPlanState.hasLoaded = true;
        renderTodayPlanPanel();
        return;
      }
      latestResponse = await fetchTodayPlanLatestSuggestion();
    }

    if (latestResponse.status === 204) {
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.hasLoaded = true;
      state.todayPlanState.aiSuggestionId = "";
      state.todayPlanState.envelope = normalizeTodayPlanEnvelope({
        surface: hooks.TODAY_PLAN_SURFACE,
        must_abstain: false,
        planPreview: { topN: 3, items: [] },
        suggestions: [],
      });
      state.todayPlanState.selectedTodoIds = new Set();
      state.todayPlanState.dismissedSuggestionIds = new Set();
      renderTodayPlanPanel();
      return;
    }

    if (!latestResponse.ok) {
      state.todayPlanState.loading = false;
      state.todayPlanState.generating = false;
      state.todayPlanState.error = "Could not load suggestions.";
      state.todayPlanState.hasLoaded = true;
      renderTodayPlanPanel();
      return;
    }

    const payload = await latestResponse.json();
    const envelope = normalizeTodayPlanEnvelope(payload?.outputEnvelope || {});
    state.todayPlanState.loading = false;
    state.todayPlanState.generating = false;
    state.todayPlanState.hasLoaded = true;
    state.todayPlanState.aiSuggestionId = String(payload?.aiSuggestionId || "");
    state.todayPlanState.envelope = envelope;
    state.todayPlanState.dismissedSuggestionIds = new Set();
    state.todayPlanState.selectedTodoIds = new Set(
      envelope.planPreview.items
        .map((item) => String(item.todoId))
        .filter(Boolean),
    );
    renderTodayPlanPanel();
  } catch (error) {
    console.error("Today plan AI load failed:", error);
    state.todayPlanState.loading = false;
    state.todayPlanState.generating = false;
    state.todayPlanState.error = "Could not load suggestions.";
    state.todayPlanState.hasLoaded = true;
    renderTodayPlanPanel();
  }
}

function getTodayPlanSelectedSuggestionCards() {
  if (!state.todayPlanState.envelope) return [];
  const selectedIds = state.todayPlanState.selectedTodoIds;
  const filtered = state.todayPlanState.envelope.suggestions
    .filter((suggestion) => {
      const todoId = String(suggestion.payload?.todoId || "");
      return todoId && selectedIds.has(todoId);
    })
    .filter(
      (suggestion) =>
        !state.todayPlanState.dismissedSuggestionIds.has(
          suggestion.suggestionId,
        ),
    )
    .filter((suggestion) =>
      hooks.shouldRenderTypeForSurface(
        hooks.TODAY_PLAN_SURFACE,
        suggestion.type,
      ),
    );
  return hooks.capSuggestions(
    hooks.sortSuggestions(hooks.TODAY_PLAN_SURFACE, filtered),
    6,
  );
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
  const goalText = state.todayPlanState.goalText || "";
  const envelope = state.todayPlanState.envelope;
  const previewItems = Array.isArray(envelope?.planPreview?.items)
    ? envelope.planPreview.items
    : [];
  const suggestionCards = getTodayPlanSelectedSuggestionCards();
  const emptyMessage = envelope?.must_abstain
    ? "No safe plan right now."
    : envelope &&
        !state.todayPlanState.generating &&
        suggestionCards.length === 0
      ? "No suggestions right now."
      : "";

  panel.setAttribute("data-testid", "today-plan-panel");
  panel.innerHTML = `
    <div class="today-plan-panel__header">
      <div class="today-plan-panel__title">Plan my day</div>
      ${
        state.todayPlanState.lastApplyBatch
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
        value="${hooks.escapeHtml(goalText)}"
        aria-label="Goal (optional)"
      />
      <button
        id="todayPlanGenerateButton"
        data-testid="today-plan-generate"
        type="button"
        class="mini-btn"
        aria-label="Generate plan"
        data-today-plan-action="generate"
        ${state.todayPlanState.loading || state.todayPlanState.generating ? "disabled" : ""}
      >
        ${state.todayPlanState.loading || state.todayPlanState.generating ? "Generating..." : "Generate plan"}
      </button>
    </div>
    ${hooks.renderAiDebugMeta(envelope || {})}
    ${
      state.todayPlanState.loading || state.todayPlanState.generating
        ? '<div class="today-plan-panel__loading ai-empty" role="status">Generating plan preview...</div>'
        : ""
    }
    ${
      state.todayPlanState.unavailable
        ? '<div class="today-plan-panel__empty ai-empty" role="status">AI Suggestions unavailable.</div>'
        : ""
    }
    ${
      state.todayPlanState.error
        ? `<div class="today-plan-panel__empty ai-empty" role="status">${hooks.escapeHtml(state.todayPlanState.error)}</div>`
        : ""
    }
    ${
      previewItems.length > 0
        ? `
        <div class="today-plan-preview" data-testid="today-plan-preview">
          ${previewItems
            .map((item) => {
              const todo = state.todos.find(
                (entry) => String(entry.id) === String(item.todoId),
              );
              const checked = state.todayPlanState.selectedTodoIds.has(
                item.todoId,
              );
              return `
                <div class="today-plan-preview__item" data-testid="today-plan-item-${hooks.escapeHtml(item.todoId)}">
                  <input
                    type="checkbox"
                    data-testid="today-plan-item-checkbox-${hooks.escapeHtml(item.todoId)}"
                    data-today-plan-action="toggle-item"
                    data-today-plan-todo-id="${hooks.escapeHtml(item.todoId)}"
                    aria-label="Select plan item ${hooks.escapeHtml(String(todo?.title || item.todoId))}"
                    ${checked ? "checked" : ""}
                  />
                  <div class="today-plan-preview__rank">${item.rank}</div>
                  <div class="today-plan-preview__body">
                    <div class="today-plan-preview__title">${hooks.escapeHtml(String(todo?.title || "Task"))}</div>
                    <div class="today-plan-preview__meta">${item.timeEstimateMin} min • ${hooks.escapeHtml(item.rationale)}</div>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      `
        : ""
    }
    ${emptyMessage ? `<div class="today-plan-panel__empty ai-empty" role="status">${hooks.escapeHtml(emptyMessage)}</div>` : ""}
    ${
      suggestionCards.length > 0
        ? `
        <div class="today-plan-suggestions">
          ${suggestionCards
            .map((suggestion) => {
              const todoId = String(suggestion.payload?.todoId || "");
              const todo = state.todos.find(
                (entry) => String(entry.id) === todoId,
              );
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
                  data-testid="today-plan-suggestion-${hooks.escapeHtml(suggestion.suggestionId)}"
                  data-today-plan-todo-id="${hooks.escapeHtml(todoId)}"
                >
                  <div class="today-plan-suggestion__title">${hooks.escapeHtml(hooks.labelForType(suggestion.type))}</div>
                  <div class="today-plan-suggestion__summary">${hooks.escapeHtml(summary)}</div>
                  <div
                    class="today-plan-suggestion__rationale ai-tooltip"
                    id="today-plan-rationale-${hooks.escapeHtml(suggestion.suggestionId)}"
                  >
                    ${hooks.escapeHtml(suggestion.rationale)}
                  </div>
                  ${hooks.renderAiDebugSuggestionId(suggestion.suggestionId)}
                  <div class="today-plan-suggestion__footer ai-actions">
                    <span class="today-plan-suggestion__confidence ai-badge ai-badge--${hooks.escapeHtml(hooks.confidenceBand(suggestion.confidence))}" aria-label="Confidence ${hooks.escapeHtml(getTodayPlanConfidenceBadge(suggestion.confidence))}">
                      ${hooks.escapeHtml(getTodayPlanConfidenceBadge(suggestion.confidence))}
                    </span>
                    <button
                      type="button"
                      class="today-plan-suggestion__dismiss ai-action-btn"
                      data-testid="today-plan-suggestion-dismiss-${hooks.escapeHtml(suggestion.suggestionId)}"
                      aria-label="Dismiss suggestion ${hooks.escapeHtml(suggestion.suggestionId)}"
                      aria-describedby="today-plan-rationale-${hooks.escapeHtml(suggestion.suggestionId)}"
                      data-today-plan-action="dismiss-suggestion"
                      data-today-plan-suggestion-id="${hooks.escapeHtml(suggestion.suggestionId)}"
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
  state.todayPlanState.goalText = goalText;
  state.todayPlanState.generating = true;
  state.todayPlanState.loading = true;
  state.todayPlanState.error = "";
  state.todayPlanState.unavailable = false;
  state.todayPlanState.loadingMessage = "Generating plan preview...";
  renderTodayPlanPanel();

  const generationId = ++state.todayPlanGenerationSeq;
  await loadTodayPlanDecisionAssist(true);
  if (generationId !== state.todayPlanGenerationSeq) return;
  state.todayPlanState.loadingMessage = "";
  state.todayPlanState.lastApplyBatch = null;
  renderTodayPlanPanel();
}

function handleTodayPlanToggleItem(todoId, checked) {
  if (checked) {
    state.todayPlanState.selectedTodoIds.add(todoId);
  } else {
    state.todayPlanState.selectedTodoIds.delete(todoId);
  }
  renderTodayPlanPanel();
}

async function handleTodayPlanDismissSuggestion(suggestionId) {
  if (
    state.todayPlanState.mode === "live" &&
    state.todayPlanState.aiSuggestionId
  ) {
    try {
      await hooks.apiCall(
        `${hooks.API_URL}/ai/suggestions/${encodeURIComponent(state.todayPlanState.aiSuggestionId)}/dismiss`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId, dismissAll: true }),
        },
      );
    } catch (error) {
      console.error("Today plan dismiss failed:", error);
    }
    state.todayPlanState.aiSuggestionId = "";
    state.todayPlanState.envelope = normalizeTodayPlanEnvelope({
      surface: hooks.TODAY_PLAN_SURFACE,
      must_abstain: false,
      planPreview: { topN: 3, items: [] },
      suggestions: [],
    });
    state.todayPlanState.selectedTodoIds = new Set();
    state.todayPlanState.dismissedSuggestionIds = new Set();
    renderTodayPlanPanel();
    return;
  }
  state.todayPlanState.dismissedSuggestionIds.add(suggestionId);
  renderTodayPlanPanel();
}

async function handleTodayPlanApplySelected() {
  if (!state.todayPlanState.envelope) return;
  const suggestionsToApply = getTodayPlanSelectedSuggestionCards();
  if (!suggestionsToApply.length) return;

  const affectedTodoIds = new Set(
    suggestionsToApply
      .map((suggestion) => String(suggestion.payload?.todoId || ""))
      .filter(Boolean),
  );
  const todoSnapshots = {};
  for (const todoId of affectedTodoIds) {
    const todo = state.todos.find((entry) => String(entry.id) === todoId);
    if (!todo) continue;
    todoSnapshots[todoId] = deepClone(todo);
  }
  const notesDraftSnapshot = deepClone(state.todayPlanState.notesDraftByTodoId);
  if (
    state.todayPlanState.mode === "live" &&
    state.todayPlanState.aiSuggestionId
  ) {
    try {
      const response = await hooks.apiCall(
        `${hooks.API_URL}/ai/suggestions/${encodeURIComponent(state.todayPlanState.aiSuggestionId)}/apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedTodoIds: Array.from(state.todayPlanState.selectedTodoIds),
            confirmed: true,
          }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        state.todayPlanState.error =
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
        const index = state.todos.findIndex(
          (item) => String(item.id) === String(updatedTodo.id),
        );
        if (index >= 0) {
          state.todos[index] = updatedTodo;
        }
      }
      await loadTodayPlanDecisionAssist(false);
    } catch (error) {
      console.error("Today plan apply failed:", error);
      state.todayPlanState.error = "Could not apply selected suggestions.";
      renderTodayPlanPanel();
      return;
    }
  } else {
    for (const suggestion of suggestionsToApply) {
      const todoId = String(suggestion.payload?.todoId || "");
      const todo = state.todos.find((entry) => String(entry.id) === todoId);
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
        state.todayPlanState.notesDraftByTodoId[todoId] = String(
          suggestion.payload?.text || "",
        ).slice(0, 500);
      }
    }
  }

  state.todayPlanState.lastApplyBatch = {
    todoSnapshots,
    notesDraftSnapshot,
  };
  hooks.renderTodos();
}

function handleTodayPlanUndoBatch() {
  const batch = state.todayPlanState.lastApplyBatch;
  if (!batch) return;
  Object.entries(batch.todoSnapshots || {}).forEach(([todoId, snapshot]) => {
    const index = state.todos.findIndex((entry) => String(entry.id) === todoId);
    if (index === -1) return;
    state.todos[index] = snapshot;
  });
  state.todayPlanState.notesDraftByTodoId = deepClone(
    batch.notesDraftSnapshot || {},
  );
  state.todayPlanState.lastApplyBatch = null;
  hooks.emitAiSuggestionUndoTelemetry({
    surface: hooks.TODAY_PLAN_SURFACE,
    aiSuggestionDbId: state.todayPlanState.aiSuggestionId,
    suggestionId: state.todayPlanState.envelope?.requestId || "",
    selectedTodoIdsCount: Object.keys(batch.todoSnapshots || {}).length,
  });
  hooks.renderTodos();
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
    state.todayPlanState.goalText = target.value;
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

export {
  deepClone,
  resetTodayPlanState,
  getTodayPlanPanelElement,
  getTodayPlanImpactRank,
  getTodayPlanConfidenceBadge,
  isTodayPlanViewActive,
  toEpoch,
  normalizePriorityValue,
  priorityWeight,
  estimateTodoMinutes,
  rankTodayTodos,
  buildTodayPlanSuggestion,
  mockPlanFromGoal,
  normalizeTodayPlanEnvelope,
  fetchTodayPlanLatestSuggestion,
  buildTodayPlanCandidates,
  generateTodayPlanSuggestion,
  loadTodayPlanDecisionAssist,
  getTodayPlanSelectedSuggestionCards,
  renderTodayPlanPanel,
  handleTodayPlanGenerate,
  handleTodayPlanToggleItem,
  handleTodayPlanDismissSuggestion,
  handleTodayPlanApplySelected,
  handleTodayPlanUndoBatch,
  bindTodayPlanHandlers,
};
