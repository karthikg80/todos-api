// =============================================================================
// inboxUi.js — Triage view: captures + tasks that still need organizing.
// Uses callAgentAction for all API calls. Renders into #todosContent when
// the triage workspace is active.
// All user-provided content is passed through hooks.escapeHtml before
// being assigned to innerHTML, consistent with the existing codebase pattern.
// =============================================================================

import { state, hooks } from "./store.js";
import { applyAsyncAction } from "./stateActions.js";
import { callAgentAction } from "./agentApiClient.js";
import { illustrationInboxClear } from "../utils/illustrations.js";

export async function loadInboxItems() {
  if (state.inboxState.loading) return;
  applyAsyncAction("inbox/start");
  if (isTriageWorkspaceActive()) {
    renderInboxView();
  }
  try {
    const data = await callAgentAction("/agent/read/list_inbox_items", {
      lifecycle: "new",
      limit: 100,
    });
    applyAsyncAction("inbox/success", {
      items: Array.isArray(data?.items) ? data.items : [],
    });
  } catch (err) {
    applyAsyncAction("inbox/failure", {
      error: err.message || "Could not load triage captures.",
    });
  }
  if (typeof hooks.renderProjectsRail === "function") {
    hooks.renderProjectsRail();
  }
  renderInboxView();
}

function formatAge(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function isTriageWorkspaceActive() {
  return typeof hooks.isTriageWorkspaceActive === "function"
    ? hooks.isTriageWorkspaceActive()
    : state.currentWorkspaceView === "triage";
}

function getNeedsOrganizingTodos() {
  const matcher =
    typeof hooks.isTodoNeedsOrganizing === "function"
      ? hooks.isTodoNeedsOrganizing
      : (todo) => !todo?.completed;
  return state.todos.filter((todo) => matcher(todo));
}

function renderCaptureItem(item) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const s = state.inboxState;
  const isTriaging = s.triagingIds.has(item.id);
  const age = item.capturedAt ? formatAge(new Date(item.capturedAt)) : "";

  return `
    <li class="todo-item triage-capture-item" data-capture-id="${escapeHtml(item.id)}">
      <div class="triage-capture-item__content">
        <div class="todo-title" title="${escapeHtml(item.text || "")}">${escapeHtml(item.text || "")}</div>
        <p class="todo-description">Raw capture</p>
        ${age ? `<div class="todo-meta"><span class="todo-chip">${escapeHtml(age)}</span></div>` : ""}
      </div>
      <div class="todo-row-actions triage-capture-item__actions">
        ${
          isTriaging
            ? `<span class="triage-capture-item__spinner">Processing...</span>`
            : `
          <button type="button" class="mini-btn"
            data-triage-action="promote" data-capture-id="${escapeHtml(item.id)}">
            Create task
          </button>
          <button type="button" class="mini-btn"
            data-triage-action="discard" data-capture-id="${escapeHtml(item.id)}">
            Discard
          </button>
        `
        }
      </div>
    </li>
  `;
}

function renderSectionState(message, { modifier = "", actionsHtml = "" } = {}) {
  const escapeHtml = hooks.escapeHtml || ((value) => String(value ?? ""));
  const className = ["todo-list-state", modifier].filter(Boolean).join(" ");
  return `
    <li class="${className}" role="status" aria-live="polite">
      <p>${escapeHtml(message)}</p>
      ${actionsHtml}
    </li>
  `;
}

function renderCapturesSection() {
  const s = state.inboxState;
  if (s.loading && !s.hasLoaded) {
    return renderSectionState("Loading captures…", {
      modifier: "todo-list-state--loading",
    });
  }
  if (s.error && s.items.length === 0) {
    return renderSectionState(s.error || "Could not load captures.", {
      modifier: "todo-list-state--error",
      actionsHtml:
        '<button type="button" class="mini-btn" data-triage-action="reload">Retry</button>',
    });
  }
  if (!s.loading && s.hasLoaded && s.items.length === 0) {
    return `
      <li class="todo-list-state triage-empty-state" role="status" aria-live="polite">
        ${illustrationInboxClear()}
        <p>Captures are clear.</p>
        <button type="button" class="mini-btn" data-onclick="openTaskComposer()">New task</button>
      </li>
    `;
  }
  return s.items.map(renderCaptureItem).join("");
}

function renderNeedsOrganizingSection() {
  const todos = getNeedsOrganizingTodos();
  if (!todos.length) {
    return renderSectionState("Nothing needs organizing right now.");
  }
  return todos.map((todo) => hooks.renderTodoRowHtml?.(todo) || "").join("");
}

export function renderInboxView() {
  const container = document.getElementById("todosContent");
  if (!container) return;
  if (!isTriageWorkspaceActive()) return;

  const captureCount = state.inboxState.items.length;
  const needsOrganizingTodos = getNeedsOrganizingTodos();
  const totalCount = captureCount + needsOrganizingTodos.length;

  hooks.updateHeaderAndContextUI?.({
    projectName: "Triage",
    visibleCount: totalCount,
    dateLabel: "",
  });

  container.innerHTML = `
    <div class="triage-view">
      <div class="triage-view__toolbar">
        <div class="triage-view__summary">
          <p class="triage-view__eyebrow">Triage</p>
          <h2 class="triage-view__title">Process captures and organize loose tasks.</h2>
          <p class="triage-view__copy">Use New Task or press N to capture something new, then finish sorting it here.</p>
        </div>
        <div class="triage-view__actions">
          <button type="button" class="mini-btn" data-onclick="openTaskComposer()">New task</button>
          <button type="button" class="mini-btn" data-triage-action="reload">Refresh</button>
        </div>
      </div>
      <div class="triage-view__sections">
        <section class="triage-section" aria-labelledby="triageCapturesHeading">
          <div class="todo-group-header triage-section__header">
            <span id="triageCapturesHeading">Captures</span>
            <span>${captureCount} item${captureCount === 1 ? "" : "s"}</span>
          </div>
          <ul class="todos-list triage-section__list">
            ${renderCapturesSection()}
          </ul>
        </section>
        <section class="triage-section" aria-labelledby="triageOrganizingHeading">
          <div class="todo-group-header triage-section__header">
            <span id="triageOrganizingHeading">Needs organizing</span>
            <span>${needsOrganizingTodos.length} task${needsOrganizingTodos.length === 1 ? "" : "s"}</span>
          </div>
          <ul class="todos-list triage-section__list">
            ${renderNeedsOrganizingSection()}
          </ul>
        </section>
      </div>
    </div>
  `;
}

async function promoteItem(captureId) {
  state.inboxState.triagingIds.add(captureId);
  renderInboxView();
  try {
    const promoted = await callAgentAction("/agent/write/promote_inbox_item", {
      captureItemId: captureId,
      type: "task",
    });
    if (promoted?.task) {
      state.todos.unshift(promoted.task);
    }
    state.inboxState.items = state.inboxState.items.filter(
      (i) => i.id !== captureId,
    );
    hooks.applyFiltersAndRender?.();
  } catch (err) {
    console.error("Triage promote failed:", err);
  } finally {
    state.inboxState.triagingIds.delete(captureId);
  }
  if (typeof hooks.renderProjectsRail === "function") {
    hooks.renderProjectsRail();
  }
  renderInboxView();
}

async function discardItem(captureId) {
  state.inboxState.triagingIds.add(captureId);
  renderInboxView();
  try {
    await callAgentAction("/agent/write/triage_capture_item", {
      captureItemId: captureId,
      mode: "apply",
    });
    state.inboxState.items = state.inboxState.items.filter(
      (i) => i.id !== captureId,
    );
  } catch (err) {
    console.error("Triage discard failed:", err);
  } finally {
    state.inboxState.triagingIds.delete(captureId);
  }
  if (typeof hooks.renderProjectsRail === "function") {
    hooks.renderProjectsRail();
  }
  renderInboxView();
}

export function bindInboxHandlers() {
  document.addEventListener("click", (event) => {
    if (!isTriageWorkspaceActive()) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionEl = target.closest("[data-triage-action]");
    if (!(actionEl instanceof HTMLElement)) return;

    const action = actionEl.getAttribute("data-triage-action");
    const captureId = actionEl.getAttribute("data-capture-id") || "";

    if (action === "reload") {
      loadInboxItems();
    } else if (action === "promote" && captureId) {
      void promoteItem(captureId);
    } else if (action === "discard" && captureId) {
      void discardItem(captureId);
    }
  });
}
