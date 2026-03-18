// =============================================================================
// planTodayAgent.js — Day Plan panel using the real plan_today agent action.
// Renders into #dayPlanAgentPanel when the "today" date view is active.
// All user-provided content is passed through hooks.escapeHtml before
// being assigned to innerHTML, consistent with the existing codebase pattern.
// =============================================================================

import { state, hooks } from "./store.js";
import { callAgentAction } from "./agentApiClient.js";

const PANEL_ID = "dayPlanAgentPanel";

// ---------------------------------------------------------------------------
// Local state (module-level, not in shared store — this panel is lightweight)
// ---------------------------------------------------------------------------

const planState = {
  loading: false,
  error: "",
  tasks: [], // [{ taskId, title, estimatedMinutes, reason }]
  totalMinutes: 0,
  remainingMinutes: 0,
  availableMinutes: 480,
  energy: "medium",
};

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function getPanelEl() {
  return document.getElementById(PANEL_ID);
}

function isTodayViewActive() {
  return state.currentDateView === "today";
}

export function renderDayPlanAgentPanel() {
  const panel = getPanelEl();
  if (!panel) return;

  if (!isTodayViewActive()) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  panel.hidden = false;
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));

  let bodyHtml;
  if (planState.loading) {
    bodyHtml = `<p class="day-plan-agent__loading">Planning your day…</p>`;
  } else if (planState.error) {
    bodyHtml = `<p class="day-plan-agent__error">${escapeHtml(planState.error)}</p>`;
  } else if (planState.tasks.length > 0) {
    const taskRows = planState.tasks
      .map(
        (t) => `
        <div class="day-plan-agent__task">
          <div class="day-plan-agent__task-title">${escapeHtml(t.title)}</div>
          ${t.estimatedMinutes ? `<span class="day-plan-agent__task-mins">${t.estimatedMinutes}m</span>` : ""}
          ${t.reason ? `<div class="day-plan-agent__task-reason">${escapeHtml(t.reason)}</div>` : ""}
        </div>`,
      )
      .join("");
    const totals =
      planState.totalMinutes > 0
        ? `<div class="day-plan-agent__totals">${planState.totalMinutes}m planned · ${planState.remainingMinutes}m remaining</div>`
        : "";
    bodyHtml = `${totals}<div class="day-plan-agent__task-list">${taskRows}</div>`;
  } else {
    bodyHtml = "";
  }

  // All dynamic values are passed through escapeHtml before innerHTML assignment.
  panel.innerHTML = `
    <div class="day-plan-agent__header">
      <span class="day-plan-agent__title">Day plan</span>
      <div class="day-plan-agent__controls">
        <label class="sr-only" for="dayPlanMinutes">Available minutes</label>
        <input
          type="number"
          id="dayPlanMinutes"
          class="day-plan-agent__input"
          min="30" max="1440" step="30"
          value="${planState.availableMinutes}"
          aria-label="Available minutes"
        />
        <label class="sr-only" for="dayPlanEnergy">Energy level</label>
        <select id="dayPlanEnergy" class="day-plan-agent__select" aria-label="Energy level">
          <option value="low" ${planState.energy === "low" ? "selected" : ""}>Low energy</option>
          <option value="medium" ${planState.energy === "medium" ? "selected" : ""}>Medium energy</option>
          <option value="high" ${planState.energy === "high" ? "selected" : ""}>High energy</option>
        </select>
        <button
          type="button"
          class="mini-btn"
          data-day-plan-action="generate"
          ${planState.loading ? "disabled" : ""}
        >
          ${planState.loading ? "Planning…" : "Plan day"}
        </button>
        ${planState.tasks.length > 0 ? `<button type="button" class="mini-btn mini-btn--ghost" data-day-plan-action="clear">Clear</button>` : ""}
      </div>
    </div>
    ${bodyHtml ? `<div class="day-plan-agent__body">${bodyHtml}</div>` : ""}
  `;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function generateDayPlan() {
  planState.loading = true;
  planState.error = "";
  planState.tasks = [];
  renderDayPlanAgentPanel();

  try {
    const data = await callAgentAction("/agent/read/plan_today", {
      availableMinutes: planState.availableMinutes,
      energy: planState.energy,
    });
    planState.tasks = Array.isArray(data?.selectedTasks)
      ? data.selectedTasks.map((t) => ({
          taskId: t.taskId || t.id || "",
          title: t.title || "",
          estimatedMinutes: t.estimatedMinutes || 0,
          reason: t.reason || "",
        }))
      : [];
    planState.totalMinutes = data?.totalMinutes || 0;
    planState.remainingMinutes = data?.remainingMinutes || 0;
    planState.error = "";
  } catch (err) {
    planState.error = err.message || "Could not generate day plan.";
  } finally {
    planState.loading = false;
  }
  renderDayPlanAgentPanel();
}

function clearDayPlan() {
  planState.tasks = [];
  planState.error = "";
  planState.totalMinutes = 0;
  planState.remainingMinutes = 0;
  renderDayPlanAgentPanel();
}

// ---------------------------------------------------------------------------
// Event binding (delegated, called once from app.js)
// ---------------------------------------------------------------------------

export function bindDayPlanAgentHandlers() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const actionEl = target.closest("[data-day-plan-action]");
    if (!(actionEl instanceof HTMLElement)) return;
    const action = actionEl.getAttribute("data-day-plan-action");
    if (action === "generate") {
      generateDayPlan();
    } else if (action === "clear") {
      clearDayPlan();
    }
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "dayPlanEnergy") {
      planState.energy = target.value || "medium";
    } else if (target.id === "dayPlanMinutes") {
      const v = parseInt(target.value, 10);
      if (!isNaN(v) && v >= 30 && v <= 1440) planState.availableMinutes = v;
    }
  });
}
