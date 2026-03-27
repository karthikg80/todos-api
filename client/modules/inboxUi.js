// =============================================================================
// inboxUi.js — Triage workspace: capture backlog plus tasks that still need
// organization. Kept on the legacy filename to minimize import churn.
// =============================================================================

import { state, hooks } from "./store.js";
import { applyAsyncAction } from "./stateActions.js";
import { callAgentAction } from "./agentApiClient.js";
import { illustrationInboxClear } from "../utils/illustrations.js";
import { isTodoNeedingTriage } from "./filterLogic.js";
import { getVisibleTodosOverride } from "./todosService.js";

export async function loadInboxItems() {
  if (state.inboxState.loading) return;
  applyAsyncAction("inbox/start");
  if (state.currentWorkspaceView === "triage") {
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

function getNeedsOrganizingTodos() {
  const override =
    state.currentWorkspaceView === "triage" ? getVisibleTodosOverride() : null;
  const source = Array.isArray(override) ? override : state.todos;
  return source
    .filter((todo) => isTodoNeedingTriage(todo))
    .sort((a, b) => {
      const aPriority = a.status === "inbox" ? 0 : 1;
      const bPriority = b.status === "inbox" ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
      );
    });
}

function renderCaptureItem(item) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const s = state.inboxState;
  const isTriaging = s.triagingIds.has(item.id);
  const age = item.capturedAt ? formatAge(new Date(item.capturedAt)) : "";

  return `
    <article class="triage-item triage-item--capture" data-capture-id="${escapeHtml(item.id)}">
      <div class="triage-item__body">
        <p class="triage-item__title">${escapeHtml(item.text || "")}</p>
        ${age ? `<span class="triage-item__meta">${escapeHtml(age)}</span>` : ""}
      </div>
      <div class="triage-item__actions">
        ${
          isTriaging
            ? `<span class="triage-item__spinner">Processing...</span>`
            : `
          <button type="button" class="mini-btn"
            data-triage-action="promote" data-capture-id="${escapeHtml(item.id)}">
            Promote to task
          </button>
          <button type="button" class="mini-btn"
            data-triage-action="discard" data-capture-id="${escapeHtml(item.id)}">
            Discard
          </button>
        `
        }
      </div>
    </article>
  `;
}

function renderTodoItem(todo) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const projectLabel =
    hooks.getProjectLeafName?.(todo.category) || "No project";
  const statusLabel = todo.status === "inbox" ? "Untriaged" : "Needs project";
  return `
    <article class="triage-item triage-item--todo" data-todo-id="${escapeHtml(todo.id)}">
      <div class="triage-item__body">
        <p class="triage-item__title">${escapeHtml(todo.title || "")}</p>
        <div class="triage-item__meta-row">
          <span class="triage-item__pill">${escapeHtml(statusLabel)}</span>
          <span class="triage-item__meta">${escapeHtml(projectLabel)}</span>
        </div>
      </div>
      <div class="triage-item__actions">
        <button type="button" class="mini-btn" data-triage-action="open-task" data-todo-id="${escapeHtml(todo.id)}">
          Open task
        </button>
      </div>
    </article>
  `;
}

function renderSection({ title, description, emptyMessage, itemsHtml, count }) {
  return `
    <section class="triage-section">
      <header class="triage-section__header">
        <div>
          <h3>${title}</h3>
          <p>${description}</p>
        </div>
        <span class="triage-section__count">${count}</span>
      </header>
      ${
        itemsHtml
          ? `<div class="triage-section__list">${itemsHtml}</div>`
          : `<div class="triage-section__empty">${emptyMessage}</div>`
      }
    </section>
  `;
}

export function renderInboxView() {
  const container = document.getElementById("todosContent");
  if (!container) return;
  if (state.currentWorkspaceView !== "triage") return;

  const s = state.inboxState;
  const needsOrganizingTodos = getNeedsOrganizingTodos();

  let capturesHtml = "";
  if (s.loading && !s.hasLoaded) {
    capturesHtml = `<div class="triage-section__empty">Loading captures...</div>`;
  } else if (s.error && s.items.length === 0) {
    capturesHtml = `
      <div class="triage-section__empty triage-section__empty--error">
        <p>${hooks.escapeHtml?.(s.error) || s.error}</p>
        <button type="button" class="mini-btn" data-triage-action="reload">Retry</button>
      </div>
    `;
  } else {
    capturesHtml = s.items.map(renderCaptureItem).join("");
  }

  const capturesSection = renderSection({
    title: "Captures",
    description: "Raw notes and ideas waiting to be promoted or discarded.",
    emptyMessage: "No captures waiting in triage.",
    itemsHtml: capturesHtml,
    count: s.items.length,
  });

  const todosSection = renderSection({
    title: "Needs organizing",
    description: "Tasks that still need a project or a clearer status.",
    emptyMessage: "All tasks are organized.",
    itemsHtml: needsOrganizingTodos.map(renderTodoItem).join(""),
    count: needsOrganizingTodos.length,
  });

  const emptyState =
    !s.loading &&
    s.hasLoaded &&
    s.items.length === 0 &&
    needsOrganizingTodos.length === 0
      ? `
        <div class="triage-view__empty">
          ${illustrationInboxClear()}
          <p>Triage is clear.</p>
        </div>
      `
      : "";

  container.innerHTML = `
    <div class="triage-view">
      <div class="triage-view__toolbar">
        <div>
          <h2>Triage</h2>
          <p>Capture at the top of the list, then organize here.</p>
        </div>
        <button type="button" class="mini-btn" data-triage-action="reload">Refresh</button>
      </div>
      ${emptyState || `${capturesSection}${todosSection}`}
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
    if (state.currentWorkspaceView !== "triage") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionEl = target.closest("[data-triage-action]");
    if (!(actionEl instanceof HTMLElement)) return;

    const action = actionEl.getAttribute("data-triage-action");
    const captureId = actionEl.getAttribute("data-capture-id") || "";
    const todoId = actionEl.getAttribute("data-todo-id") || "";

    if (action === "reload") {
      loadInboxItems();
    } else if (action === "promote" && captureId) {
      void promoteItem(captureId);
    } else if (action === "discard" && captureId) {
      void discardItem(captureId);
    } else if (action === "open-task" && todoId) {
      hooks.openTodoDrawer?.(todoId);
    }
  });
}
