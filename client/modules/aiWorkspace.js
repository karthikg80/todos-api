// =============================================================================
// aiWorkspace.js — AI workspace panel, plan/critique draft, AI loaders
// =============================================================================
import { state, hooks } from "./store.js";
import { loadTodos } from "./todosService.js";
import { getAllProjects } from "./projectsState.js";
import { applyUiAction } from "./stateActions.js";
import {
  persistAiWorkspaceCollapsedState,
  persistAiWorkspaceVisibleState,
} from "./railUi.js";

const { escapeHtml, showMessage } = window.Utils || {};
const { normalizeProjectPath, renderProjectOptionEntry } =
  window.ProjectPathUtils || {};

// ---------------------------------------------------------------------------
// Workspace element helpers
// ---------------------------------------------------------------------------

export function getAiWorkspaceElements() {
  const workspace = document.getElementById("aiWorkspace");
  const toggle = document.getElementById("aiWorkspaceToggle");
  const body = document.getElementById("aiWorkspaceBody");
  const chevron = document.getElementById("aiWorkspaceToggleChevron");
  const status = document.getElementById("aiWorkspaceStatus");
  if (
    !(workspace instanceof HTMLElement) ||
    !(toggle instanceof HTMLElement) ||
    !(body instanceof HTMLElement)
  ) {
    return null;
  }
  return { workspace, toggle, body, chevron, status };
}

export function getAiWorkspaceStatusLabel() {
  if (state.isPlanGenerateInFlight) {
    return "Working";
  }
  if (state.latestPlanResult || state.latestCritiqueResult) {
    return "Draft open";
  }
  return "Ready";
}

export function updateAiWorkspaceStatusChip() {
  const refs = getAiWorkspaceElements();
  if (!refs || !(refs.status instanceof HTMLElement)) {
    return;
  }
  refs.status.textContent = getAiWorkspaceStatusLabel();
}

export function syncAiWorkspaceVisibility(visible) {
  const refs = getAiWorkspaceElements();
  if (refs) {
    refs.workspace.hidden = !visible;
  }
  const critiqueButton = document.getElementById("critiqueDraftButton");
  if (critiqueButton instanceof HTMLElement) {
    critiqueButton.hidden = !visible;
  }
}

export function setAiWorkspaceVisible(visible, { persist = true } = {}) {
  const AI_DEBUG_ENABLED = hooks.AI_DEBUG_ENABLED;
  applyUiAction("aiWorkspace/visible:set", {
    visible,
    debugEnabled: AI_DEBUG_ENABLED,
  });
  syncAiWorkspaceVisibility(state.isAiWorkspaceVisible);
  if (persist && !AI_DEBUG_ENABLED) {
    persistAiWorkspaceVisibleState(state.isAiWorkspaceVisible);
  }
}

export function setAiWorkspaceCollapsed(
  collapsed,
  { persist = true, restoreFocus = false } = {},
) {
  applyUiAction("aiWorkspace/collapsed:set", { collapsed });
  const refs = getAiWorkspaceElements();
  if (refs) {
    refs.workspace.classList.toggle(
      "ai-workspace--collapsed",
      state.isAiWorkspaceCollapsed,
    );
    refs.toggle.setAttribute(
      "aria-expanded",
      state.isAiWorkspaceCollapsed ? "false" : "true",
    );
    refs.body.hidden = state.isAiWorkspaceCollapsed;
    if (refs.chevron instanceof HTMLElement) {
      refs.chevron.textContent = state.isAiWorkspaceCollapsed
        ? "\u25b8"
        : "\u25be";
    }
  }
  if (persist) {
    persistAiWorkspaceCollapsedState(state.isAiWorkspaceCollapsed);
  }
  updateAiWorkspaceStatusChip();
  if (restoreFocus && refs) {
    refs.toggle.focus({ preventScroll: true });
  }
}

export function toggleAiWorkspace() {
  setAiWorkspaceCollapsed(!state.isAiWorkspaceCollapsed);
}

export function focusAiWorkspaceTarget(targetId) {
  const target = document.getElementById(targetId);
  if (target instanceof HTMLElement) {
    target.focus({ preventScroll: true });
  }
}

export function openAiWorkspaceForBrainDump() {
  setAiWorkspaceVisible(true);
  setAiWorkspaceCollapsed(false);
  focusAiWorkspaceTarget("brainDumpInput");
}

export function openAiWorkspaceForGoalPlan() {
  setAiWorkspaceVisible(true);
  setAiWorkspaceCollapsed(false);
  focusAiWorkspaceTarget("goalInput");
}

// ---------------------------------------------------------------------------
// AI data loaders
// ---------------------------------------------------------------------------

export async function loadAiSuggestions() {
  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/ai/suggestions?limit=8`,
    );
    if (!response || !response.ok) {
      state.aiSuggestions = [];
      renderAiSuggestionHistory();
      updateAiWorkspaceStatusChip();
      return;
    }

    state.aiSuggestions = await response.json();
    renderAiSuggestionHistory();
    updateAiWorkspaceStatusChip();
  } catch (error) {
    console.error("Load AI suggestions error:", error);
    state.aiSuggestions = [];
    renderAiSuggestionHistory();
    updateAiWorkspaceStatusChip();
  }
}

export async function loadAiUsage() {
  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/ai/usage`);
    if (!response || !response.ok) {
      state.aiUsage = null;
      renderAiUsageSummary();
      return;
    }

    state.aiUsage = await response.json();
    renderAiUsageSummary();
  } catch (error) {
    console.error("Load AI usage error:", error);
    state.aiUsage = null;
    renderAiUsageSummary();
  }
}

export async function loadAiFeedbackSummary() {
  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/ai/feedback-summary?days=30&reasonLimit=3`,
    );
    if (!response || !response.ok) {
      state.aiFeedbackSummary = null;
      renderAiFeedbackInsights();
      return;
    }

    state.aiFeedbackSummary = await response.json();
    renderAiFeedbackInsights();
  } catch (error) {
    console.error("Load AI feedback summary error:", error);
    state.aiFeedbackSummary = null;
    renderAiFeedbackInsights();
  }
}

export async function loadAiInsights() {
  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/ai/insights?days=7`);
    if (!response || !response.ok) {
      state.aiInsights = null;
      renderAiPerformanceInsights();
      return;
    }

    state.aiInsights = await response.json();
    renderAiPerformanceInsights();
  } catch (error) {
    console.error("Load AI insights error:", error);
    state.aiInsights = null;
    renderAiPerformanceInsights();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderAiUsageSummary() {
  const container = document.getElementById("aiUsageSummary");
  if (!container) return;

  if (!state.aiUsage) {
    container.innerHTML = "";
    return;
  }

  const resetTime = state.aiUsage.resetAt
    ? new Date(state.aiUsage.resetAt).toLocaleString()
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
      AI plan: <strong>${escapeHtml(String(state.aiUsage.plan || "free").toUpperCase())}</strong>.
      Usage today: <strong>${state.aiUsage.used}/${state.aiUsage.limit}</strong> used
      (${state.aiUsage.remaining} remaining). Resets: ${escapeHtml(resetTime)}
    </div>
  `;
}

export function renderAiPerformanceInsights() {
  const container = document.getElementById("aiPerformanceInsights");
  if (!container) return;

  if (!state.aiInsights) {
    container.innerHTML = "";
    return;
  }

  const acceptanceRate = state.aiInsights.acceptanceRate;
  const recommendation =
    typeof state.aiInsights.recommendation === "string"
      ? state.aiInsights.recommendation
      : "";

  const rateDisplay =
    typeof acceptanceRate === "number" ? `${acceptanceRate}%` : "N/A";

  container.innerHTML = `
    <div style="
      font-size: 0.85rem;
      color: var(--text-secondary);
      padding: 8px 10px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--input-bg);
    ">
      <strong>Acceptance rate (7d):</strong> ${escapeHtml(rateDisplay)}
      ${recommendation ? `<div style="margin-top: 4px;">${escapeHtml(recommendation)}</div>` : ""}
    </div>
  `;
}

export function renderAiFeedbackInsights() {
  const container = document.getElementById("aiFeedbackInsights");
  if (!container) return;

  if (!state.aiFeedbackSummary || state.aiFeedbackSummary.totalRated < 1) {
    container.innerHTML = "";
    return;
  }

  const totalRated = Number(state.aiFeedbackSummary.totalRated) || 0;
  const acceptedCount = Number(state.aiFeedbackSummary.acceptedCount) || 0;
  const rejectedCount = Number(state.aiFeedbackSummary.rejectedCount) || 0;
  const acceptedRate =
    totalRated > 0 ? Math.round((acceptedCount / totalRated) * 100) : 0;
  const topAcceptedReason =
    state.aiFeedbackSummary.acceptedReasons &&
    state.aiFeedbackSummary.acceptedReasons.length > 0
      ? state.aiFeedbackSummary.acceptedReasons[0]
      : null;
  const topRejectedReason =
    state.aiFeedbackSummary.rejectedReasons &&
    state.aiFeedbackSummary.rejectedReasons.length > 0
      ? state.aiFeedbackSummary.rejectedReasons[0]
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

export function renderAiSuggestionHistory() {
  const container = document.getElementById("aiSuggestionHistory");
  if (!container) return;

  if (!Array.isArray(state.aiSuggestions) || state.aiSuggestions.length === 0) {
    container.innerHTML =
      '<div style="color: var(--text-secondary); font-size: 0.85rem;">All clear. No suggestions right now.</div>';
    return;
  }

  container.innerHTML = state.aiSuggestions
    .map((suggestion) => {
      const type = String(suggestion?.type || "unknown");
      const status = String(suggestion?.status || "pending");
      const createdAt = suggestion?.createdAt
        ? new Date(suggestion.createdAt).toLocaleDateString()
        : "Unknown";
      return `
        <div style="
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 6px;
          background: var(--input-bg);
          font-size: 0.8rem;
          color: var(--text-secondary);
        ">
          <div><strong>${escapeHtml(type)}</strong> &mdash; ${escapeHtml(status)}</div>
          <div>${escapeHtml(createdAt)}</div>
        </div>
      `;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Plan draft state management
// ---------------------------------------------------------------------------

export async function updateSuggestionStatus(
  suggestionId,
  status,
  reason = null,
) {
  if (!suggestionId) return;
  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/ai/suggestions/${suggestionId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      },
    );
    if (!response || !response.ok) {
      return false;
    }
    await loadAiSuggestions();
    await loadAiUsage();
    await loadAiInsights();
    await loadAiFeedbackSummary();
    return true;
  } catch (error) {
    console.error("Update suggestion status error:", error);
    return false;
  }
}

export function getFeedbackReason(inputId, fallbackReason) {
  const input = document.getElementById(inputId);
  if (!input) return fallbackReason;
  const raw = String(input.value || "").trim();
  return raw || fallbackReason;
}

export function toPlanDateInputValue(value) {
  if (!value || typeof value !== "string") return "";
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toISOString().slice(0, 10);
  }
  const parsed = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : "";
}

export function normalizePlanDraftPriority(priority) {
  if (priority === "low" || priority === "medium" || priority === "high") {
    return priority;
  }
  return "medium";
}

export function clonePlanDraftTask(task, index = 0) {
  const fallbackTempId = `task-${index + 1}`;
  const rawTempId = String(task?.tempId || "").trim();
  const tempId = rawTempId || fallbackTempId;
  const title = String(task?.title || "").trim();
  const description = task?.description ? String(task.description) : "";
  const projectName =
    task?.projectName ||
    task?.category ||
    task?.project ||
    task?.projectPath ||
    "";
  const subtasks = Array.isArray(task?.subtasks)
    ? task.subtasks
        .map((subtask, subtaskIndex) => {
          const subtaskTitle = String(subtask?.title || "").trim();
          if (!subtaskTitle) return null;
          return {
            tempId:
              String(subtask?.tempId || "").trim() ||
              `subtask-${index + 1}-${subtaskIndex + 1}`,
            title: subtaskTitle,
          };
        })
        .filter((item) => !!item)
    : [];

  return {
    tempId,
    title,
    description,
    projectName: String(projectName).trim(),
    dueDate: toPlanDateInputValue(task?.dueDate),
    priority: normalizePlanDraftPriority(task?.priority),
    subtasks,
  };
}

export function initPlanDraftState(planResult) {
  const rawTasks = Array.isArray(planResult?.tasks) ? planResult.tasks : [];
  const seenTempIds = new Set();
  const tasks = rawTasks
    .map((task, index) => clonePlanDraftTask(task, index))
    .map((task, index) => {
      let nextTempId = task.tempId;
      if (seenTempIds.has(nextTempId)) {
        nextTempId = `${task.tempId}-${index + 1}`;
      }
      seenTempIds.add(nextTempId);
      return { ...task, tempId: nextTempId };
    })
    .filter((task) => task.title.length > 0);

  if (!tasks.length) {
    state.planDraftState = null;
    return;
  }

  const originalTasks = tasks.map((task, index) =>
    clonePlanDraftTask(task, index),
  );
  state.planDraftState = {
    summary: String(planResult?.summary || "Suggested plan"),
    originalTasks,
    workingTasks: originalTasks.map((task, index) =>
      clonePlanDraftTask(task, index),
    ),
    selectedTaskTempIds: new Set(originalTasks.map((task) => task.tempId)),
    statusSyncFailed: false,
  };
}

export function clearPlanDraftState() {
  state.planDraftState = null;
}

export function removeAppliedPlanDraftTasks(appliedTempIds) {
  if (!state.planDraftState || !appliedTempIds.size) return;
  state.planDraftState.workingTasks = state.planDraftState.workingTasks.filter(
    (task) => !appliedTempIds.has(task.tempId),
  );
  state.planDraftState.originalTasks =
    state.planDraftState.originalTasks.filter(
      (task) => !appliedTempIds.has(task.tempId),
    );
  state.planDraftState.selectedTaskTempIds = new Set(
    state.planDraftState.workingTasks
      .map((task) => task.tempId)
      .filter((tempId) => !appliedTempIds.has(tempId)),
  );
}

export function isPlanActionBusy() {
  return (
    state.isPlanGenerateInFlight ||
    state.isPlanApplyInFlight ||
    state.isPlanDismissInFlight
  );
}

export function updatePlanGenerateButtonState() {
  const generateButton = document.getElementById("generatePlanButton");
  const brainDumpButton = document.getElementById("brainDumpPlanButton");
  const controlsDisabled = isPlanActionBusy();

  if (generateButton) {
    generateButton.disabled = controlsDisabled;
    generateButton.textContent =
      state.isPlanGenerateInFlight && state.planGenerateSource === "goal"
        ? "Generating..."
        : "Generate Plan";
  }

  if (brainDumpButton) {
    brainDumpButton.disabled = controlsDisabled;
    brainDumpButton.textContent =
      state.isPlanGenerateInFlight && state.planGenerateSource === "brain_dump"
        ? "Drafting..."
        : "Draft tasks from brain dump";
  }
  updateAiWorkspaceStatusChip();
}

export function getSelectedPlanDraftTasks() {
  if (!state.planDraftState) return [];
  return state.planDraftState.workingTasks.filter((task) =>
    state.planDraftState.selectedTaskTempIds.has(task.tempId),
  );
}

export function buildPlanTaskCreatePayload(task) {
  const title = String(task.title || "").trim();
  const description = String(task.description || "").trim();
  const projectName = normalizeProjectPath(task.projectName || "");

  const payload = {
    title,
    priority: normalizePlanDraftPriority(task.priority),
    description,
  };

  if (projectName) {
    payload.category = projectName;
  }

  if (task.dueDate) {
    payload.dueDate = `${task.dueDate}T12:00:00.000Z`;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Critique panel rendering
// ---------------------------------------------------------------------------

export function renderCritiquePanel() {
  const panel = document.getElementById("aiCritiquePanel");
  if (!panel) return;

  if (!state.latestCritiqueResult) {
    panel.style.display = "none";
    panel.innerHTML = "";
    updateAiWorkspaceStatusChip();
    return;
  }

  if (hooks.FEATURE_ENHANCED_TASK_CRITIC) {
    renderEnhancedCritiquePanel(panel);
    updateAiWorkspaceStatusChip();
    return;
  }

  renderLegacyCritiquePanel(panel);
  updateAiWorkspaceStatusChip();
}

export function renderLegacyCritiquePanel(panel) {
  panel.style.display = "block";
  panel.innerHTML = `
    <div style="
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px;
      background: var(--input-bg);
    ">
      <div style="font-weight: 600; margin-bottom: 6px;">
        Task Critique Score: ${state.latestCritiqueResult.qualityScore}/100
      </div>
      <div><strong>Suggested title:</strong> ${escapeHtml(state.latestCritiqueResult.improvedTitle)}</div>
      ${
        state.latestCritiqueResult.improvedDescription
          ? `<div style="margin-top: 4px;"><strong>Suggested description:</strong> ${escapeHtml(state.latestCritiqueResult.improvedDescription)}</div>`
          : ""
      }
      <ul style="margin: 8px 0 10px 18px;">
        ${state.latestCritiqueResult.suggestions
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}
      </ul>
      <input
        id="critiqueFeedbackReasonInput"
        type="text"
        maxlength="300"
        placeholder="Feedback reason (optional): e.g., too generic, very actionable"
        style="
          width: 100%;
          margin-bottom: 8px;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          background: var(--card-bg);
          color: var(--text-primary);
        "
      />
      <div style="display: flex; gap: 8px;">
        <button class="add-btn" data-onclick="applyCritiqueSuggestion()">Apply Suggestion</button>
        <button class="add-btn" style="background: #64748b" data-onclick="dismissCritiqueSuggestion()">Dismiss</button>
      </div>
    </div>
  `;
}

export function getCritiqueSuggestions() {
  if (!Array.isArray(state.latestCritiqueResult?.suggestions)) return [];
  return state.latestCritiqueResult.suggestions
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
}

export function renderEnhancedCritiquePanel(panel) {
  const scoreValue = Number(state.latestCritiqueResult?.qualityScore);
  const hasScore = Number.isFinite(scoreValue);
  const improvedTitle = String(
    state.latestCritiqueResult?.improvedTitle || "",
  ).trim();
  const improvedDescription = String(
    state.latestCritiqueResult?.improvedDescription || "",
  ).trim();
  const suggestions = getCritiqueSuggestions();

  panel.style.display = "block";
  panel.innerHTML = `
    <div class="critic-panel-enhanced">
      <div class="critic-panel-header">
        <div class="critic-panel-title">Task Critic</div>
        <div class="critic-panel-score">
          ${
            hasScore
              ? `Quality score: <strong>${Math.round(scoreValue)}/100</strong>`
              : "No score available yet"
          }
        </div>
      </div>

      <section class="critic-section">
        <div class="critic-section-title">Suggested improvements</div>
        ${
          improvedTitle
            ? `<div class="critic-improvement-line"><strong>Title:</strong> ${escapeHtml(improvedTitle)}</div>`
            : `<div class="critic-improvement-line">No title suggestion available.</div>`
        }
        ${
          improvedDescription
            ? `<div class="critic-improvement-line"><strong>Description:</strong> ${escapeHtml(improvedDescription)}</div>`
            : `<div class="critic-improvement-line">No description suggestion available.</div>`
        }
        ${
          suggestions.length
            ? `<ul class="critic-suggestion-list">
                ${suggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
              </ul>`
            : `<div class="critic-improvement-line">No additional suggestions yet.</div>`
        }
      </section>

      <section class="critic-section">
        <label for="critiqueFeedbackReasonInput" class="critic-section-title">Feedback reason (optional)</label>
        <input
          id="critiqueFeedbackReasonInput"
          type="text"
          maxlength="300"
          placeholder="e.g., too generic, very actionable"
          class="critic-feedback-input"
        />
        <div class="critic-feedback-chips" role="group" aria-label="Quick feedback reasons">
          <button type="button" class="critic-feedback-chip" data-onclick="setCritiqueFeedbackReason('Too generic')">Too generic</button>
          <button type="button" class="critic-feedback-chip" data-onclick="setCritiqueFeedbackReason('Missing context')">Missing context</button>
          <button type="button" class="critic-feedback-chip" data-onclick="setCritiqueFeedbackReason('Very actionable')">Very actionable</button>
        </div>
      </section>

      <div class="critic-actions">
        <button class="add-btn" data-onclick="applyCritiqueSuggestionMode('title')">Apply title only</button>
        <button class="add-btn" data-onclick="applyCritiqueSuggestionMode('description')">Apply description only</button>
        <button class="add-btn" data-onclick="applyCritiqueSuggestionMode('both')">Apply both</button>
        <button class="add-btn" style="background: #64748b" data-onclick="dismissCritiqueSuggestion()">Dismiss</button>
      </div>

      <details class="critic-future-insights">
        <summary>Future insights</summary>
        <p>Coming soon: deeper critique rationale, impact estimates, and trend signals.</p>
      </details>
    </div>
  `;
}

export function updateCritiqueDraftButtonState() {
  const critiqueButton = document.getElementById("critiqueDraftButton");
  if (!(critiqueButton instanceof HTMLButtonElement)) {
    return;
  }
  const isBusy = state.critiqueRequestsInFlight > 0;
  critiqueButton.disabled = isBusy;
  critiqueButton.textContent = isBusy ? "Critiquing..." : "Critique Draft (AI)";
}

export function setCritiqueFeedbackReason(reason) {
  const input = document.getElementById("critiqueFeedbackReasonInput");
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  input.value = String(reason || "").trim();
  input.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Plan panel rendering
// ---------------------------------------------------------------------------

export function renderPlanPanel() {
  const panel = document.getElementById("aiPlanPanel");
  if (!panel) return;

  if (!state.latestPlanResult || !state.planDraftState) {
    panel.style.display = "none";
    panel.innerHTML = "";
    updateAiWorkspaceStatusChip();
    return;
  }

  if (!state.planDraftState.workingTasks.length) {
    if (!state.planDraftState.statusSyncFailed) {
      panel.style.display = "none";
      panel.innerHTML = "";
      updateAiWorkspaceStatusChip();
      return;
    }
    const controlsDisabled = isPlanActionBusy() ? "disabled" : "";
    panel.style.display = "block";
    panel.innerHTML = `
      <div class="plan-draft-panel">
        <div class="plan-draft-title">Plan tasks created</div>
        <div class="plan-draft-warning">
          Tasks were created, but marking this AI suggestion as accepted failed.
        </div>
        <div class="plan-draft-actions-bottom">
          <button class="add-btn" ${controlsDisabled} data-onclick="retryMarkPlanSuggestionAccepted()">${
            state.isPlanApplyInFlight ? "Retrying..." : "Retry mark accepted"
          }</button>
          <button class="add-btn" ${controlsDisabled} style="background: #64748b" data-onclick="dismissPlanSuggestion()">${
            state.isPlanDismissInFlight ? "Dismissing..." : "Dismiss"
          }</button>
        </div>
      </div>
    `;
    updateAiWorkspaceStatusChip();
    return;
  }

  const projects = getAllProjects();
  const hasProjects = projects.length > 0;
  const selectedCount = getSelectedPlanDraftTasks().length;
  const totalCount = state.planDraftState.workingTasks.length;
  const controlsDisabled = isPlanActionBusy() ? "disabled" : "";

  panel.style.display = "block";
  panel.innerHTML = `
    <div class="plan-draft-panel">
      <div class="plan-draft-header-row">
        <div class="plan-draft-title">${escapeHtml(state.planDraftState.summary)}</div>
        <span class="plan-draft-count">${selectedCount}/${totalCount} selected</span>
      </div>
      <div class="plan-draft-actions-top">
        <button class="mini-btn" ${controlsDisabled} data-onclick="selectAllPlanDraftTasks()">Select all</button>
        <button class="mini-btn" ${controlsDisabled} data-onclick="selectNoPlanDraftTasks()">Select none</button>
        <button class="mini-btn" ${controlsDisabled} data-onclick="resetPlanDraft()">Reset to AI draft</button>
      </div>
      <div class="plan-draft-task-list">
        ${state.planDraftState.workingTasks
          .map((task, index) => {
            const isSelected = state.planDraftState.selectedTaskTempIds.has(
              task.tempId,
            );
            const selectedAttr = isSelected ? "checked" : "";
            const firstInputId = `planDraftTitleInput-${index}`;
            const projectOptions = hasProjects
              ? `<select
                    id="planDraftProjectInput-${index}"
                    class="plan-draft-project-select"
                    aria-label="Project for ${escapeHtml(task.title || `task ${index + 1}`)}"
                    data-onchange="updatePlanDraftTaskProject(${index}, event)"
                  >
                    <option value="">No project</option>
                    ${projects
                      .map((project) =>
                        renderProjectOptionEntry(
                          project,
                          String(task.projectName || ""),
                        ),
                      )
                      .join("")}
                  </select>`
              : `<input
                    id="planDraftProjectInput-${index}"
                    type="text"
                    class="plan-draft-project-input"
                    maxlength="50"
                    placeholder="Project (optional)"
                    aria-label="Project for ${escapeHtml(task.title || `task ${index + 1}`)}"
                    value="${escapeHtml(String(task.projectName || ""))}"
                    data-onchange="updatePlanDraftTaskProject(${index}, event)"
                  />`;

            const subtasksMarkup =
              Array.isArray(task.subtasks) && task.subtasks.length > 0
                ? `
                  <details class="plan-draft-subtasks">
                    <summary>Subtasks (${task.subtasks.length})</summary>
                    <ul>
                      ${task.subtasks
                        .map(
                          (subtask) => `<li>${escapeHtml(subtask.title)}</li>`,
                        )
                        .join("")}
                    </ul>
                  </details>
                `
                : "";

            return `
              <div class="plan-draft-task-row ${isSelected ? "" : "dimmed"}">
                <div class="plan-draft-task-head">
                  <input
                    type="checkbox"
                    class="bulk-checkbox"
                    aria-label="Include task ${index + 1}"
                    ${selectedAttr}
                    ${controlsDisabled}
                    data-onchange="setPlanDraftTaskSelected(${index}, event)"
                  />
                  <label for="${firstInputId}" class="sr-only">Task title ${index + 1}</label>
                  <input
                    id="${firstInputId}"
                    type="text"
                    class="plan-draft-title-input"
                    maxlength="200"
                    value="${escapeHtml(task.title)}"
                    ${controlsDisabled}
                    data-onchange="updatePlanDraftTaskTitle(${index}, event)"
                  />
                </div>
                <label for="planDraftDescriptionInput-${index}" class="sr-only">Task description ${index + 1}</label>
                <textarea
                  id="planDraftDescriptionInput-${index}"
                  class="plan-draft-description-input"
                  rows="2"
                  maxlength="1000"
                  placeholder="Description (optional)"
                  ${controlsDisabled}
                  data-onchange="updatePlanDraftTaskDescription(${index}, event)"
                >${escapeHtml(String(task.description || ""))}</textarea>
                <div class="plan-draft-meta-row">
                  <label for="planDraftDueDateInput-${index}" class="sr-only">Due date ${index + 1}</label>
                  <input
                    id="planDraftDueDateInput-${index}"
                    type="date"
                    class="plan-draft-date-input"
                    value="${escapeHtml(String(task.dueDate || ""))}"
                    ${controlsDisabled}
                    data-onchange="updatePlanDraftTaskDueDate(${index}, event)"
                  />
                  ${projectOptions}
                  <label for="planDraftPriorityInput-${index}" class="sr-only">Priority ${index + 1}</label>
                  <select
                    id="planDraftPriorityInput-${index}"
                    class="plan-draft-priority-select"
                    ${controlsDisabled}
                    aria-label="Priority for ${escapeHtml(task.title || `task ${index + 1}`)}"
                    data-onchange="updatePlanDraftTaskPriority(${index}, event)"
                  >
                    <option value="low" ${task.priority === "low" ? "selected" : ""}>Low</option>
                    <option value="medium" ${task.priority === "medium" ? "selected" : ""}>Medium</option>
                    <option value="high" ${task.priority === "high" ? "selected" : ""}>High</option>
                  </select>
                </div>
                ${subtasksMarkup}
              </div>
            `;
          })
          .join("")}
      </div>
      <input
        id="planFeedbackReasonInput"
        type="text"
        maxlength="300"
        placeholder="Feedback reason (optional): why you accepted/rejected this plan"
        ${controlsDisabled}
        class="plan-feedback-input"
      />
      <div class="plan-draft-actions-bottom">
        <button class="add-btn" ${controlsDisabled} data-onclick="addPlanTasksToTodos()">${
          state.isPlanApplyInFlight ? "Applying..." : "Apply selected tasks"
        }</button>
        <button class="add-btn" ${controlsDisabled} style="background: #64748b" data-onclick="dismissPlanSuggestion()">${
          state.isPlanDismissInFlight ? "Dismissing..." : "Dismiss"
        }</button>
      </div>
    </div>
  `;

  if (panel.dataset.focusPending === "true") {
    panel.dataset.focusPending = "false";
    const firstTitleInput = document.getElementById("planDraftTitleInput-0");
    firstTitleInput?.focus();
  }
}

// ---------------------------------------------------------------------------
// Plan draft task actions
// ---------------------------------------------------------------------------

export function setPlanDraftTaskSelected(index, event) {
  if (!state.planDraftState || isPlanActionBusy()) return;
  const task = state.planDraftState.workingTasks[index];
  if (!task) return;
  const checked = !!event?.target?.checked;
  if (checked) {
    state.planDraftState.selectedTaskTempIds.add(task.tempId);
  } else {
    state.planDraftState.selectedTaskTempIds.delete(task.tempId);
  }
  renderPlanPanel();
}

export function updatePlanDraftTaskTitle(index, event) {
  if (!state.planDraftState) return;
  const task = state.planDraftState.workingTasks[index];
  if (!task) return;
  task.title = String(event?.target?.value || "").slice(0, 200);
}

export function updatePlanDraftTaskDescription(index, event) {
  if (!state.planDraftState) return;
  const task = state.planDraftState.workingTasks[index];
  if (!task) return;
  task.description = String(event?.target?.value || "").slice(0, 1000);
}

export function updatePlanDraftTaskDueDate(index, event) {
  if (!state.planDraftState) return;
  const task = state.planDraftState.workingTasks[index];
  if (!task) return;
  const nextValue = String(event?.target?.value || "").trim();
  task.dueDate = /^\d{4}-\d{2}-\d{2}$/.test(nextValue) ? nextValue : "";
}

export function updatePlanDraftTaskProject(index, event) {
  if (!state.planDraftState) return;
  const task = state.planDraftState.workingTasks[index];
  if (!task) return;
  task.projectName = String(event?.target?.value || "")
    .slice(0, 50)
    .trim();
}

export function updatePlanDraftTaskPriority(index, event) {
  if (!state.planDraftState) return;
  const task = state.planDraftState.workingTasks[index];
  if (!task) return;
  task.priority = normalizePlanDraftPriority(
    String(event?.target?.value || ""),
  );
}

export function selectAllPlanDraftTasks() {
  if (!state.planDraftState || isPlanActionBusy()) return;
  state.planDraftState.selectedTaskTempIds = new Set(
    state.planDraftState.workingTasks.map((task) => task.tempId),
  );
  renderPlanPanel();
}

export function selectNoPlanDraftTasks() {
  if (!state.planDraftState || isPlanActionBusy()) return;
  state.planDraftState.selectedTaskTempIds.clear();
  renderPlanPanel();
}

export function resetPlanDraft() {
  if (!state.planDraftState || isPlanActionBusy()) return;
  state.planDraftState.workingTasks = state.planDraftState.originalTasks.map(
    (task, index) => clonePlanDraftTask(task, index),
  );
  state.planDraftState.selectedTaskTempIds = new Set(
    state.planDraftState.workingTasks.map((task) => task.tempId),
  );
  state.planDraftState.statusSyncFailed = false;
  renderPlanPanel();
}

// ---------------------------------------------------------------------------
// AI action functions
// ---------------------------------------------------------------------------

export async function retryMarkPlanSuggestionAccepted() {
  if (
    !state.latestPlanSuggestionId ||
    !state.planDraftState ||
    !state.planDraftState.statusSyncFailed ||
    isPlanActionBusy()
  ) {
    return;
  }

  state.isPlanApplyInFlight = true;
  updatePlanGenerateButtonState();
  renderPlanPanel();
  try {
    const accepted = await updateSuggestionStatus(
      state.latestPlanSuggestionId,
      "accepted",
      getFeedbackReason("planFeedbackReasonInput", "Plan tasks were added"),
    );
    if (!accepted) {
      showMessage(
        "todosMessage",
        "Could not mark AI suggestion accepted yet. Retry in a moment.",
        "warning",
      );
      return;
    }
    state.latestPlanSuggestionId = null;
    state.latestPlanResult = null;
    clearPlanDraftState();
    renderPlanPanel();
    showMessage("todosMessage", "AI suggestion marked accepted", "success");
  } finally {
    state.isPlanApplyInFlight = false;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

export async function critiqueDraftWithAi() {
  const input = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
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

  const requestId = ++state.latestCritiqueRequestId;
  state.critiqueRequestsInFlight += 1;
  updateCritiqueDraftButtonState();

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/ai/task-critic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description:
          notesInput.value.trim() || projectSelect.value.trim() || undefined,
        dueDate: dueDateInput.value
          ? new Date(dueDateInput.value).toISOString()
          : undefined,
        priority: state.currentPriority,
      }),
    });

    const data = response ? await hooks.parseApiBody(response) : {};
    if (requestId !== state.latestCritiqueRequestId) {
      return;
    }
    if (response && response.ok) {
      state.latestCritiqueSuggestionId = data.suggestionId;
      state.latestCritiqueResult = data;
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
      state.aiUsage = data.usage;
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
    if (requestId !== state.latestCritiqueRequestId) {
      return;
    }
    console.error("Critique draft error:", error);
    showMessage("todosMessage", "Failed to run AI critique", "error");
  } finally {
    state.critiqueRequestsInFlight = Math.max(
      0,
      state.critiqueRequestsInFlight - 1,
    );
    updateCritiqueDraftButtonState();
  }
}

export async function applyCritiqueSuggestion() {
  await applyCritiqueSuggestionMode("both", { overwriteDescription: false });
}

export async function applyCritiqueSuggestionMode(
  mode = "both",
  { overwriteDescription = true } = {},
) {
  if (!state.latestCritiqueResult) return;

  const input = document.getElementById("todoInput");
  const notesInput = document.getElementById("todoNotesInput");
  const notesIcon = document.getElementById("notesExpandIcon");

  const applyTitle = mode === "title" || mode === "both";
  const applyDescription = mode === "description" || mode === "both";

  if (applyTitle && state.latestCritiqueResult.improvedTitle) {
    input.value = state.latestCritiqueResult.improvedTitle;
  }

  if (
    applyDescription &&
    state.latestCritiqueResult.improvedDescription &&
    (overwriteDescription || !notesInput.value.trim())
  ) {
    notesInput.value = state.latestCritiqueResult.improvedDescription;
    notesInput.style.display = "block";
    notesIcon.classList.add("expanded");
  }

  await updateSuggestionStatus(
    state.latestCritiqueSuggestionId,
    "accepted",
    getFeedbackReason("critiqueFeedbackReasonInput", "Applied to draft"),
  );
  state.latestCritiqueSuggestionId = null;
  state.latestCritiqueResult = null;
  renderCritiquePanel();
  showMessage("todosMessage", "AI suggestion applied to draft", "success");
}

export async function dismissCritiqueSuggestion() {
  await updateSuggestionStatus(
    state.latestCritiqueSuggestionId,
    "rejected",
    getFeedbackReason(
      "critiqueFeedbackReasonInput",
      "Not useful for current context",
    ),
  );
  state.latestCritiqueSuggestionId = null;
  state.latestCritiqueResult = null;
  renderCritiquePanel();
}

export async function generatePlanWithAi() {
  if (isPlanActionBusy()) {
    return;
  }
  const goalInput = document.getElementById("goalInput");
  const targetDateInput = document.getElementById("goalTargetDateInput");

  const goal = goalInput.value.trim();
  if (!goal) {
    showMessage("todosMessage", "Enter a goal to generate a plan", "error");
    return;
  }

  state.isPlanGenerateInFlight = true;
  state.planGenerateSource = "goal";
  updatePlanGenerateButtonState();
  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/ai/plan-from-goal`, {
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

    const data = response ? await hooks.parseApiBody(response) : {};
    if (response && response.ok) {
      await handlePlanFromGoalSuccess(
        data,
        "AI plan generated. Review and add tasks.",
      );
      return;
    }

    showMessage(
      "todosMessage",
      data.error || "AI plan generation failed",
      "error",
    );
    if (response && response.status === 429 && data.usage) {
      state.aiUsage = data.usage;
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
  } finally {
    state.isPlanGenerateInFlight = false;
    state.planGenerateSource = null;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

export function clearBrainDumpInput() {
  const brainDumpInput = document.getElementById("brainDumpInput");
  if (!brainDumpInput || isPlanActionBusy()) {
    return;
  }
  brainDumpInput.value = "";
  brainDumpInput.focus();
}

export async function handlePlanFromGoalSuccess(data, successMessage) {
  state.latestPlanSuggestionId = data.suggestionId;
  state.latestPlanResult = data;
  initPlanDraftState(data);
  const planPanel = document.getElementById("aiPlanPanel");
  if (planPanel) {
    planPanel.dataset.focusPending = "true";
  }
  renderPlanPanel();
  showMessage("todosMessage", successMessage, "success");
  await loadAiSuggestions();
  await loadAiUsage();
  await loadAiInsights();
}

export async function draftPlanFromBrainDumpWithAi() {
  if (isPlanActionBusy()) {
    return;
  }

  const brainDumpInput = document.getElementById("brainDumpInput");
  if (!brainDumpInput) {
    return;
  }

  const goal = brainDumpInput.value.trim();
  if (!goal) {
    showMessage("todosMessage", "Enter a brain dump to draft tasks", "error");
    return;
  }
  if (goal.length > 8000) {
    showMessage(
      "todosMessage",
      "Brain dump must be 8000 characters or less",
      "error",
    );
    return;
  }

  state.isPlanGenerateInFlight = true;
  state.planGenerateSource = "brain_dump";
  updatePlanGenerateButtonState();
  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/ai/plan-from-goal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });

    const data = response ? await hooks.parseApiBody(response) : {};
    if (response && response.ok) {
      await handlePlanFromGoalSuccess(
        data,
        "AI draft ready from brain dump. Review and add tasks.",
      );
      return;
    }

    showMessage(
      "todosMessage",
      data.error || "AI draft generation failed",
      "error",
    );
    if (response && response.status === 429 && data.usage) {
      state.aiUsage = data.usage;
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
    console.error("Brain dump plan error:", error);
    showMessage(
      "todosMessage",
      "Failed to draft tasks from brain dump",
      "error",
    );
  } finally {
    state.isPlanGenerateInFlight = false;
    state.planGenerateSource = null;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

export async function addPlanTasksToTodos() {
  if (
    !state.latestPlanSuggestionId ||
    !state.planDraftState ||
    isPlanActionBusy()
  ) {
    return;
  }

  const selectedTasks = getSelectedPlanDraftTasks();
  if (selectedTasks.length === 0) {
    showMessage(
      "todosMessage",
      "Select at least one plan task to apply",
      "error",
    );
    return;
  }

  const invalidTask = selectedTasks.find(
    (task) => String(task.title || "").trim().length === 0,
  );
  if (invalidTask) {
    showMessage(
      "todosMessage",
      "Each selected task must include a title before applying",
      "error",
    );
    return;
  }

  state.isPlanApplyInFlight = true;
  updatePlanGenerateButtonState();
  renderPlanPanel();
  try {
    const taskPromises = selectedTasks.map(async (task) => {
      const payload = buildPlanTaskCreatePayload(task);
      try {
        const response = await hooks.apiCall(`${hooks.API_URL}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response && response.ok) {
          return { ok: true, tempId: task.tempId };
        }
        const data = response ? await hooks.parseApiBody(response) : {};
        return {
          ok: false,
          tempId: task.tempId,
          error: data.error || "Failed to create task",
        };
      } catch (err) {
        return {
          ok: false,
          tempId: task.tempId,
          error: err.message || "Network error",
        };
      }
    });

    const results = await Promise.all(taskPromises);
    const createdTempIds = new Set();
    let firstError = null;

    for (const res of results) {
      if (res.ok) {
        createdTempIds.add(res.tempId);
      } else if (!firstError) {
        firstError = res.error;
      }
    }

    const created = createdTempIds.size;

    if (created > 0) {
      removeAppliedPlanDraftTasks(createdTempIds);
      await loadTodos();
    }

    if (created === selectedTasks.length) {
      const accepted = await updateSuggestionStatus(
        state.latestPlanSuggestionId,
        "accepted",
        getFeedbackReason("planFeedbackReasonInput", "Plan tasks were added"),
      );

      if (!accepted) {
        if (state.planDraftState) {
          state.planDraftState.statusSyncFailed = true;
        }
        renderPlanPanel();
        showMessage(
          "todosMessage",
          `Added ${created} AI-planned task(s), but could not mark suggestion accepted. Retry.`,
          "warning",
        );
        return;
      }

      state.latestPlanSuggestionId = null;
      state.latestPlanResult = null;
      clearPlanDraftState();
      renderPlanPanel();
      showMessage(
        "todosMessage",
        `Added ${created} AI-planned task(s)`,
        "success",
      );
    } else if (created > 0) {
      showMessage(
        "todosMessage",
        `Created ${created} of ${selectedTasks.length} tasks. Suggestion not marked accepted; fix remaining items and retry.`,
        "warning",
      );
      renderPlanPanel();
    } else {
      showMessage(
        "todosMessage",
        firstError || "Failed to apply one or more planned tasks",
        "error",
      );
    }
  } catch (error) {
    console.error("Apply planned tasks error:", error);
    showMessage("todosMessage", "Failed to apply AI suggestion", "error");
  } finally {
    state.isPlanApplyInFlight = false;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}

export async function dismissPlanSuggestion() {
  if (!state.latestPlanSuggestionId || isPlanActionBusy()) {
    return;
  }
  state.isPlanDismissInFlight = true;
  updatePlanGenerateButtonState();
  renderPlanPanel();
  try {
    await updateSuggestionStatus(
      state.latestPlanSuggestionId,
      "rejected",
      getFeedbackReason(
        "planFeedbackReasonInput",
        "Plan did not match intended approach",
      ),
    );
    state.latestPlanSuggestionId = null;
    state.latestPlanResult = null;
    clearPlanDraftState();
    showMessage("todosMessage", "AI plan dismissed", "success");
  } finally {
    state.isPlanDismissInFlight = false;
    updatePlanGenerateButtonState();
    renderPlanPanel();
  }
}
