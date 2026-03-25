// =============================================================================
// inboxUi.js — Capture inbox view: list, capture, triage, promote.
// Uses callAgentAction for all API calls. Renders into #todosContent when
// currentWorkspaceView === "inbox".
// All user-provided content is passed through hooks.escapeHtml before
// being assigned to innerHTML, consistent with the existing codebase pattern.
// =============================================================================

import { state, hooks } from "./store.js";
import { applyAsyncAction } from "./stateActions.js";
import { callAgentAction } from "./agentApiClient.js";
import { illustrationInboxClear } from "../utils/illustrations.js";

// ---------------------------------------------------------------------------
// Load inbox items from the agent API
// ---------------------------------------------------------------------------

export async function loadInboxItems() {
  if (state.inboxState.loading) return;
  applyAsyncAction("inbox/start");
  renderInboxView();
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
      error: err.message || "Could not load inbox.",
    });
  }
  renderInboxView();
}

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

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

function renderInboxItem(item) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const s = state.inboxState;
  const isTriaging = s.triagingIds.has(item.id);
  const age = item.capturedAt ? formatAge(new Date(item.capturedAt)) : "";

  return `
    <div class="inbox-item" data-capture-id="${escapeHtml(item.id)}">
      <div class="inbox-item__body">
        <p class="inbox-item__text">${escapeHtml(item.text || "")}</p>
        ${age ? `<span class="inbox-item__age">${escapeHtml(age)}</span>` : ""}
      </div>
      <div class="inbox-item__actions">
        ${
          isTriaging
            ? `<span class="inbox-item__spinner">Processing…</span>`
            : `
          <button type="button" class="inbox-btn inbox-btn--primary"
            data-inbox-action="promote" data-capture-id="${escapeHtml(item.id)}">
            Promote to task
          </button>
          <button type="button" class="inbox-btn inbox-btn--ghost"
            data-inbox-action="discard" data-capture-id="${escapeHtml(item.id)}">
            Discard
          </button>
        `
        }
      </div>
    </div>
  `;
}

export function renderInboxView() {
  const container = document.getElementById("todosContent");
  if (!container) return;
  if (state.currentWorkspaceView !== "inbox") return;

  const s = state.inboxState;
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));

  let bodyHtml;

  if (s.loading && !s.hasLoaded) {
    bodyHtml = `<div class="inbox-view__loading" role="status" aria-live="polite">Loading inbox…</div>`;
  } else if (s.error && s.items.length === 0) {
    bodyHtml = `
      <div class="inbox-view__error" role="status">
        <p>${escapeHtml(s.error)}</p>
        <button type="button" class="inbox-btn" data-inbox-action="reload">Retry</button>
      </div>`;
  } else if (!s.loading && s.hasLoaded && s.items.length === 0) {
    bodyHtml = `<div class="inbox-view__empty">${illustrationInboxClear()}<p>Inbox is clear.</p></div>`;
  } else {
    const itemsHtml = s.items.map(renderInboxItem).join("");
    bodyHtml = `
      <div class="inbox-view__toolbar">
        <span class="inbox-view__count">${s.items.length} item${s.items.length !== 1 ? "s" : ""}</span>
        <button type="button" class="inbox-btn" data-inbox-action="reload">Refresh</button>
      </div>
      <div class="inbox-view__list">${itemsHtml}</div>`;
  }

  // All dynamic values passed through escapeHtml before innerHTML assignment.
  container.innerHTML = `
    <div class="inbox-view">
      <div class="inbox-view__capture">
        <form class="inbox-capture-form" data-inbox-action="capture-submit">
          <input
            type="text"
            class="inbox-capture-input"
            id="inboxCaptureInput"
            placeholder="Capture something… (Enter to save)"
            maxlength="2000"
            autocomplete="off"
          />
          <button type="submit" class="inbox-btn inbox-btn--primary">Capture</button>
        </form>
      </div>
      <div class="inbox-view__body">${bodyHtml}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function promoteItem(captureId) {
  state.inboxState.triagingIds.add(captureId);
  renderInboxView();
  try {
    await callAgentAction("/agent/write/promote_inbox_item", {
      captureItemId: captureId,
      type: "task",
    });
    state.inboxState.items = state.inboxState.items.filter(
      (i) => i.id !== captureId,
    );
    if (typeof hooks.applyFiltersAndRender === "function") {
      hooks.applyFiltersAndRender();
    }
  } catch (err) {
    console.error("Inbox promote failed:", err);
  } finally {
    state.inboxState.triagingIds.delete(captureId);
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
    console.error("Inbox discard failed:", err);
  } finally {
    state.inboxState.triagingIds.delete(captureId);
  }
  renderInboxView();
}

async function captureItem(text) {
  if (!text.trim()) return;
  try {
    await callAgentAction("/agent/write/capture_inbox_item", {
      text: text.trim(),
      source: "manual",
    });
    await loadInboxItems();
  } catch (err) {
    console.error("Inbox capture failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Event binding (delegated, called once from app.js)
// ---------------------------------------------------------------------------

export function bindInboxHandlers() {
  document.addEventListener("click", (event) => {
    if (state.currentWorkspaceView !== "inbox") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionEl = target.closest("[data-inbox-action]");
    if (!(actionEl instanceof HTMLElement)) return;

    const action = actionEl.getAttribute("data-inbox-action");
    const captureId = actionEl.getAttribute("data-capture-id") || "";

    if (action === "reload") {
      loadInboxItems();
    } else if (action === "promote" && captureId) {
      promoteItem(captureId);
    } else if (action === "discard" && captureId) {
      discardItem(captureId);
    }
  });

  document.addEventListener("submit", (event) => {
    if (state.currentWorkspaceView !== "inbox") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches("[data-inbox-action='capture-submit']")) return;
    event.preventDefault();
    const input = document.getElementById("inboxCaptureInput");
    if (input instanceof HTMLInputElement && input.value.trim()) {
      const text = input.value;
      input.value = "";
      captureItem(text);
    }
  });
}
