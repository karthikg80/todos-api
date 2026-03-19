// =============================================================================
// onboardingFlow.js — First-time user onboarding: 4-step guided setup.
// Step 1: area picker (modal)
// Step 2: add first 3 tasks (inline on Home)
// Step 3: set one due date (inline on Home)
// Step 4: meet the daily brief (modal)
// =============================================================================

import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";

const { escapeHtml } = window.Utils || {};

// ---------------------------------------------------------------------------
// State (module-level, not in shared store)
// ---------------------------------------------------------------------------

let _step = 0; // 0 = not started, 1-4 = active step, 5 = complete
let _pendingTasks = []; // tasks created in step 2 — { id, title }
let _saving = false;

const AREA_OPTIONS = [
  { key: "work", label: "Work" },
  { key: "home", label: "Home" },
  { key: "family", label: "Family" },
  { key: "finance", label: "Finance" },
  { key: "health", label: "Health" },
  { key: "side-projects", label: "Side projects" },
];

// ---------------------------------------------------------------------------
// Initialisation — called after loadUserProfile() resolves
// ---------------------------------------------------------------------------

export function initOnboarding() {
  if (_step > 0) return; // already initialized — guard against duplicate calls
  const user = state.currentUser;
  if (!user) return;

  // Already completed — never show again
  if (user.onboardingCompletedAt) return;

  // Resume from saved step, defaulting to step 1
  _step = Number(user.onboardingStep || 0);
  if (_step <= 0) _step = 1;
  if (_step >= 5) {
    _markComplete();
    return;
  }

  // Modal steps (1 & 4) are shown as a side effect of renderHomeDashboard()
  // to guarantee they only appear when the home view is active.
  // Inline steps (2 & 3) are handled via the renderHomeDashboard() guard.
  // No immediate _render() call here.
}

// Called by renderHomeDashboard() — shows modal overlay for steps 1 & 4 when
// home view is active. Idempotent: no-op if overlay is already present.
export function maybeRenderOnboardingModal() {
  if (_step !== 1 && _step !== 4) return;
  if (document.getElementById("onboardingOverlay")) return; // already shown
  _render();
}

export function isOnboardingActive() {
  return _step >= 1 && _step <= 4;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export function advanceOnboarding() {
  if (_step >= 4) {
    _markComplete();
    return;
  }
  _step += 1;
  _saveStep(_step);
  _render();
}

export function dismissOnboarding() {
  _markComplete();
}

// ---------------------------------------------------------------------------
// Server persistence
// ---------------------------------------------------------------------------

async function _saveStep(step) {
  if (_saving) return;
  _saving = true;
  try {
    await hooks.apiCall(`${hooks.API_URL}/users/me/onboarding/step`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
  } catch (err) {
    console.warn("Onboarding step save failed:", err);
  } finally {
    _saving = false;
  }
}

async function _markComplete() {
  _step = 5;
  _removeOverlay();
  _removeInlineBanner();

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/users/me/onboarding/complete`,
      { method: "POST" },
    );
    if (response && response.ok) {
      const user = await response.json();
      state.currentUser = { ...state.currentUser, ...user };
    }
  } catch (err) {
    console.warn("Onboarding complete save failed:", err);
  }

  // Refresh the home dashboard now that onboarding is done
  EventBus.dispatch("todos:changed", { reason: "onboarding-complete" });
}

// ---------------------------------------------------------------------------
// Render dispatcher
// ---------------------------------------------------------------------------

function _render() {
  if (_step === 1) {
    _removeInlineBanner();
    _renderStep1Modal();
    return;
  }
  if (_step === 2) {
    _removeOverlay();
    _renderStep2Inline();
    return;
  }
  if (_step === 3) {
    _removeOverlay();
    _renderStep3Inline();
    return;
  }
  if (_step === 4) {
    _removeInlineBanner();
    _renderStep4Modal();
    return;
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Area picker modal
// ---------------------------------------------------------------------------

function _renderStep1Modal() {
  _removeOverlay();

  const selected = new Set(["work"]); // sensible default pre-selection

  const overlay = document.createElement("div");
  overlay.id = "onboardingOverlay";
  overlay.className = "onboarding-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "onboardingModalTitle");

  const renderGrid = () =>
    AREA_OPTIONS.map((area) => {
      const isSelected = selected.has(area.key);
      return `
      <button type="button"
              class="onb-area-btn${isSelected ? " onb-area-btn--selected" : ""}"
              data-area="${escapeHtml(area.key)}"
              data-onclick="toggleOnboardingArea('${escapeHtml(area.key)}')">
        ${escapeHtml(area.label)}
      </button>`;
    }).join("");

  overlay.innerHTML = `
    <div class="onb-modal">
      <div class="onb-progress">
        <span class="onb-progress__dot onb-progress__dot--active"></span>
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot"></span>
      </div>
      <h2 class="onb-modal__title" id="onboardingModalTitle">
        What areas of your life do you want to track?
      </h2>
      <p class="onb-modal__subtitle">
        We'll create a project for each. You can change this any time.
      </p>
      <div class="onb-area-grid" id="onbAreaGrid">
        ${renderGrid()}
      </div>
      <div class="onb-modal__actions">
        <button type="button" class="onb-skip-btn"
                data-onclick="dismissOnboarding()">Skip for now</button>
        <button type="button" class="onb-primary-btn" id="onbStep1Next"
                data-onclick="onboardingStep1Next()">
          Create projects →
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Store selected set on overlay for use by toggle handler
  overlay._selectedAreas = selected;
}

export function toggleOnboardingArea(areaKey) {
  const overlay = document.getElementById("onboardingOverlay");
  if (!overlay || !overlay._selectedAreas) return;
  const selected = overlay._selectedAreas;
  if (selected.has(areaKey)) {
    selected.delete(areaKey);
  } else {
    selected.add(areaKey);
  }
  // Re-render the grid
  const grid = document.getElementById("onbAreaGrid");
  if (grid) {
    grid.innerHTML = AREA_OPTIONS.map((area) => {
      const isSelected = selected.has(area.key);
      return `
        <button type="button"
                class="onb-area-btn${isSelected ? " onb-area-btn--selected" : ""}"
                data-area="${escapeHtml(area.key)}"
                data-onclick="toggleOnboardingArea('${escapeHtml(area.key)}')">
          ${escapeHtml(area.label)}
        </button>`;
    }).join("");
  }
}

export async function onboardingStep1Next() {
  const overlay = document.getElementById("onboardingOverlay");
  const selected = overlay?._selectedAreas;
  const btn = document.getElementById("onbStep1Next");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Creating\u2026";
  }

  // Create a project for each selected area in parallel
  if (selected && selected.size > 0) {
    const creates = Array.from(selected).map((areaKey) => {
      const label =
        AREA_OPTIONS.find((a) => a.key === areaKey)?.label || areaKey;
      return hooks
        .apiCall(`${hooks.API_URL}/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: label, area: areaKey }),
        })
        .catch(() => null);
    });
    await Promise.all(creates);
    // Reload projects so rail reflects new state
    await hooks.loadProjects?.();
  }

  advanceOnboarding();
}

// ---------------------------------------------------------------------------
// Step 2 — Add first tasks (inline on Home)
// ---------------------------------------------------------------------------

function _renderStep2Inline() {
  _ensureInlineBannerMounted();
  const banner = document.getElementById("onboardingInlineBanner");
  if (!banner) return;

  const taskCount = _pendingTasks.length;

  banner.innerHTML = `
    <div class="onb-inline">
      <div class="onb-inline__header">
        <div class="onb-inline__progress">
          <div class="onb-inline__bar">
            <div class="onb-inline__fill" style="width:50%"></div>
          </div>
          <span class="onb-inline__step-label">Step 2 of 4</span>
        </div>
        <button type="button" class="onb-dismiss-x"
                data-onclick="dismissOnboarding()" aria-label="Dismiss setup">\xd7</button>
      </div>
      <h3 class="onb-inline__title">Add your first tasks</h3>
      <p class="onb-inline__sub">
        What's on your mind right now? Add at least one to continue.
      </p>
      <div class="onb-task-entry">
        <input type="text"
               id="onbTaskInput"
               class="onb-task-input"
               placeholder="e.g. Finish AWS study plan"
               maxlength="200"
               autocomplete="off" />
        <button type="button" class="onb-add-task-btn"
                data-onclick="onboardingAddTask()">Add</button>
      </div>
      ${
        taskCount > 0
          ? `
        <div class="onb-task-list">
          ${_pendingTasks
            .map(
              (t) => `
            <div class="onb-task-row">
              <span class="onb-task-row__check">\u2713</span>
              <span class="onb-task-row__title">${escapeHtml(t.title)}</span>
            </div>`,
            )
            .join("")}
        </div>`
          : ""
      }
      <div class="onb-inline__footer">
        <span class="onb-inline__count">
          ${
            taskCount === 0
              ? "No tasks yet"
              : taskCount === 1
                ? "1 task added"
                : `${taskCount} tasks added`
          }
        </span>
        <button type="button"
                class="onb-primary-btn${taskCount === 0 ? " onb-primary-btn--disabled" : ""}"
                ${taskCount === 0 ? "disabled" : ""}
                data-onclick="advanceOnboarding()">Next \u2192</button>
      </div>
    </div>`;

  // Auto-focus the input
  window.requestAnimationFrame(() => {
    document.getElementById("onbTaskInput")?.focus();
  });
}

export async function onboardingAddTask() {
  const input = document.getElementById("onbTaskInput");
  if (!(input instanceof HTMLInputElement)) return;
  const title = input.value.trim();
  if (!title) return;

  input.value = "";
  input.disabled = true;

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status: "next", source: "manual" }),
    });
    if (response && response.ok) {
      const task = await response.json();
      _pendingTasks.push({ id: task.id, title: task.title });
      // Reload todos so the main list stays in sync
      await hooks.loadTodos?.();
    }
  } catch (err) {
    console.warn("Onboarding task create failed:", err);
  } finally {
    if (input) input.disabled = false;
  }

  _renderStep2Inline();

  // Limit to 5 tasks in onboarding
  if (_pendingTasks.length >= 5) {
    advanceOnboarding();
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Set one due date (inline on Home)
// ---------------------------------------------------------------------------

function _renderStep3Inline() {
  _ensureInlineBannerMounted();
  const banner = document.getElementById("onboardingInlineBanner");
  if (!banner) return;

  banner.innerHTML = `
    <div class="onb-inline">
      <div class="onb-inline__header">
        <div class="onb-inline__progress">
          <div class="onb-inline__bar">
            <div class="onb-inline__fill" style="width:75%"></div>
          </div>
          <span class="onb-inline__step-label">Step 3 of 4</span>
        </div>
        <button type="button" class="onb-dismiss-x"
                data-onclick="dismissOnboarding()" aria-label="Dismiss setup">\xd7</button>
      </div>
      <h3 class="onb-inline__title">Which one has a deadline?</h3>
      <p class="onb-inline__sub">
        Setting a due date helps the planner rank your work. You can skip this.
      </p>
      <div class="onb-due-list">
        ${_pendingTasks
          .map(
            (t) => `
          <div class="onb-due-row" id="onb-due-${escapeHtml(t.id)}">
            <span class="onb-due-row__title">${escapeHtml(t.title)}</span>
            <input type="date"
                   class="onb-due-input"
                   data-task-id="${escapeHtml(t.id)}"
                   data-onchange="onboardingSetDueDate('${escapeHtml(t.id)}', this.value)" />
          </div>`,
          )
          .join("")}
      </div>
      <div class="onb-inline__footer">
        <button type="button" class="onb-skip-btn"
                data-onclick="advanceOnboarding()">Skip</button>
        <button type="button" class="onb-primary-btn"
                data-onclick="advanceOnboarding()">Done \u2192</button>
      </div>
    </div>`;
}

export async function onboardingSetDueDate(taskId, dateValue) {
  if (!taskId || !dateValue) return;
  const dueDate = new Date(`${dateValue}T09:00:00`).toISOString();
  try {
    await hooks.apiCall(
      `${hooks.API_URL}/todos/${encodeURIComponent(taskId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate }),
      },
    );
  } catch (err) {
    console.warn("Onboarding due date save failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Meet the daily brief (modal)
// ---------------------------------------------------------------------------

function _renderStep4Modal() {
  _removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "onboardingOverlay";
  overlay.className = "onboarding-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "onboardingModalTitle");

  overlay.innerHTML = `
    <div class="onb-modal onb-modal--wide">
      <div class="onb-progress">
        <span class="onb-progress__dot onb-progress__dot--done"></span>
        <span class="onb-progress__dot onb-progress__dot--done"></span>
        <span class="onb-progress__dot onb-progress__dot--done"></span>
        <span class="onb-progress__dot onb-progress__dot--active"></span>
      </div>
      <h2 class="onb-modal__title" id="onboardingModalTitle">
        You're set up. Here's your daily brief.
      </h2>
      <p class="onb-modal__subtitle">
        Every time you open the app, this tile synthesises what matters most
        right now \u2014 deadlines, blockers, and the one thing to do today.
      </p>
      <div class="onb-brief-preview" id="onbBriefPreview">
        <div class="onb-brief-loading">Generating your first brief\u2026</div>
      </div>
      <div class="onb-modal__actions onb-modal__actions--right">
        <button type="button" class="onb-primary-btn"
                data-onclick="dismissOnboarding()">
          Let's go \u2192
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Kick off the priorities brief in the background
  _loadBriefPreview();
}

async function _loadBriefPreview() {
  const container = document.getElementById("onbBriefPreview");
  if (!container) return;

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/ai/priorities-brief`,
    );
    if (response && response.ok) {
      const data = await response.json();
      container.innerHTML = `<div class="onb-brief-content">${data.html || ""}</div>`;
    } else {
      container.innerHTML = `
        <div class="onb-brief-fallback">
          Your priorities will appear here based on your tasks and deadlines.
        </div>`;
    }
  } catch {
    container.innerHTML = `
      <div class="onb-brief-fallback">
        Your priorities will appear here based on your tasks and deadlines.
      </div>`;
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function _removeOverlay() {
  document.getElementById("onboardingOverlay")?.remove();
}

function _removeInlineBanner() {
  document.getElementById("onboardingInlineBanner")?.remove();
}

function _ensureInlineBannerMounted() {
  if (document.getElementById("onboardingInlineBanner")) return;

  const banner = document.createElement("section");
  banner.id = "onboardingInlineBanner";
  banner.className = "onboarding-inline-banner";

  // Insert before #homeFocusDashboard (the home dashboard section)
  const dashboard = document.getElementById("homeFocusDashboard");
  if (dashboard && dashboard.parentElement) {
    dashboard.parentElement.insertBefore(banner, dashboard);
  } else {
    // Fallback: prepend to todosScrollRegion
    const scroll = document.getElementById("todosScrollRegion");
    if (scroll) scroll.prepend(banner);
  }
}

// Export step value for render guard in homeDashboard.js
export { _step as onboardingStep };
