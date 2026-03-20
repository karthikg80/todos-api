import { state, hooks } from "./store.js";

const STATUS_FILTERS = ["new", "triaged", "promoted", "rejected"];
const TYPE_FILTERS = ["bug", "feature"];

function escape(value) {
  return hooks.escapeHtml
    ? hooks.escapeHtml(String(value ?? ""))
    : String(value ?? "");
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function getAdminFeedbackElements() {
  return {
    container: document.getElementById("adminContent"),
    list: document.getElementById("adminFeedbackList"),
    detail: document.getElementById("adminFeedbackDetail"),
  };
}

function ensureAdminWorkspaceShell() {
  const { container } = getAdminFeedbackElements();
  if (!(container instanceof HTMLElement)) {
    return false;
  }

  if (container.dataset.adminShellReady === "true") {
    return true;
  }

  container.innerHTML = `
    <div class="admin-layout">
      <section class="admin-section admin-feedback-section">
        <div class="admin-section__header">
          <div>
            <h2 class="admin-section__title">Feedback Queue</h2>
            <p class="admin-section__subtitle">Review incoming bugs and feature requests before promotion.</p>
          </div>
        </div>
        <div class="admin-filter-groups">
          <div class="admin-filter-group">
            <span class="admin-filter-label">Status</span>
            <div class="admin-filter-row">
              <button type="button" class="admin-filter-chip" data-onclick="setAdminFeedbackFilter('status', '')">All</button>
              ${STATUS_FILTERS.map(
                (status) =>
                  `<button type="button" class="admin-filter-chip" data-onclick="setAdminFeedbackFilter('status', '${status}')">${escape(status)}</button>`,
              ).join("")}
            </div>
          </div>
          <div class="admin-filter-group">
            <span class="admin-filter-label">Type</span>
            <div class="admin-filter-row">
              <button type="button" class="admin-filter-chip" data-onclick="setAdminFeedbackFilter('type', '')">All</button>
              ${TYPE_FILTERS.map(
                (type) =>
                  `<button type="button" class="admin-filter-chip" data-onclick="setAdminFeedbackFilter('type', '${type}')">${escape(type)}</button>`,
              ).join("")}
            </div>
          </div>
        </div>
        <div class="admin-feedback-grid">
          <div id="adminFeedbackList" class="admin-feedback-list"></div>
          <div id="adminFeedbackDetail" class="admin-feedback-detail"></div>
        </div>
      </section>
      <section class="admin-section">
        <div id="adminUsersContent">
          <div class="loading">
            <div class="spinner"></div>
            Loading users...
          </div>
        </div>
      </section>
    </div>
  `;
  container.dataset.adminShellReady = "true";
  return true;
}

function renderFilterChips() {
  const container = document.getElementById("adminContent");
  if (!(container instanceof HTMLElement)) {
    return;
  }

  container.querySelectorAll(".admin-filter-chip").forEach((element) => {
    if (!(element instanceof HTMLButtonElement)) {
      return;
    }
    const handler = element.dataset.onclick || "";
    const statusMatch = handler.match(
      /setAdminFeedbackFilter\('status', '([^']*)'\)/,
    );
    const typeMatch = handler.match(
      /setAdminFeedbackFilter\('type', '([^']*)'\)/,
    );
    const active =
      (statusMatch && statusMatch[1] === state.adminFeedbackFilters.status) ||
      (typeMatch && typeMatch[1] === state.adminFeedbackFilters.type);
    element.classList.toggle("is-active", Boolean(active));
  });
}

function renderAdminFeedbackList() {
  const { list } = getAdminFeedbackElements();
  if (!(list instanceof HTMLElement)) {
    return;
  }

  renderFilterChips();

  if (state.adminFeedbackListLoading) {
    list.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        Loading feedback...
      </div>
    `;
    return;
  }

  if (!state.adminFeedbackItems.length) {
    list.innerHTML = `
      <div class="admin-feedback-empty">
        No feedback matches the current filters.
      </div>
    `;
    return;
  }

  list.innerHTML = state.adminFeedbackItems
    .map((item) => {
      const isSelected = item.id === state.adminFeedbackSelectedId;
      return `
        <button
          type="button"
          class="admin-feedback-row${isSelected ? " is-selected" : ""}"
          data-onclick="selectAdminFeedback('${item.id}')"
        >
          <div class="admin-feedback-row__top">
            <span class="admin-feedback-pill admin-feedback-pill--${escape(item.type)}">${escape(item.type)}</span>
            <span class="admin-feedback-pill admin-feedback-pill--status">${escape(item.status)}</span>
          </div>
          <strong class="admin-feedback-row__title">${escape(item.title)}</strong>
          <div class="admin-feedback-row__meta">
            <span>${escape(item.user?.email || item.userId)}</span>
            <span>${escape(formatDateTime(item.createdAt))}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderMetadataRow(label, value) {
  return `
    <div class="admin-detail-meta__row">
      <span class="admin-detail-meta__label">${escape(label)}</span>
      <span class="admin-detail-meta__value">${escape(value || "—")}</span>
    </div>
  `;
}

function renderAdminFeedbackDetail() {
  const { detail } = getAdminFeedbackElements();
  if (!(detail instanceof HTMLElement)) {
    return;
  }

  if (state.adminFeedbackDetailLoading) {
    detail.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        Loading details...
      </div>
    `;
    return;
  }

  const item = state.adminFeedbackDetail;
  if (!item) {
    detail.innerHTML = `
      <div class="admin-feedback-empty">
        Select a feedback item to inspect the full submission and metadata.
      </div>
    `;
    return;
  }

  const attachmentSummary = item.attachmentMetadata
    ? `${item.attachmentMetadata.name || "Attachment"} • ${item.attachmentMetadata.type || "unknown"} • ${item.attachmentMetadata.size ?? 0} bytes`
    : "No attachment metadata";

  detail.innerHTML = `
    <div class="admin-detail-card">
      <div class="admin-detail-card__header">
        <div>
          <div class="admin-feedback-row__top">
            <span class="admin-feedback-pill admin-feedback-pill--${escape(item.type)}">${escape(item.type)}</span>
            <span class="admin-feedback-pill admin-feedback-pill--status">${escape(item.status)}</span>
          </div>
          <h3>${escape(item.title)}</h3>
          <p class="admin-section__subtitle">Submitted by ${escape(item.user?.email || item.userId)} on ${escape(formatDateTime(item.createdAt))}</p>
        </div>
      </div>

      <div class="admin-detail-block">
        <h4>Submission</h4>
        <pre class="admin-detail-pre">${escape(item.body)}</pre>
      </div>

      <div class="admin-detail-block">
        <h4>Captured Metadata</h4>
        <div class="admin-detail-meta">
          ${renderMetadataRow("User", item.user?.email || item.userId)}
          ${renderMetadataRow("Reviewer", item.reviewer?.email || "")}
          ${renderMetadataRow("Reviewed at", item.reviewedAt ? formatDateTime(item.reviewedAt) : "")}
          ${renderMetadataRow("Page URL", item.pageUrl || "")}
          ${renderMetadataRow("App version", item.appVersion || "")}
          ${renderMetadataRow("Browser", item.userAgent || "")}
          ${renderMetadataRow("Screenshot URL", item.screenshotUrl || "")}
          ${renderMetadataRow("Attachment", attachmentSummary)}
          ${renderMetadataRow("Triage summary", item.triageSummary || "")}
          ${renderMetadataRow("Severity", item.severity || "")}
          ${renderMetadataRow("Rejection reason", item.rejectionReason || "")}
        </div>
      </div>

      <div class="admin-detail-block">
        <h4>Review Actions</h4>
        <div class="admin-feedback-actions">
          <button type="button" class="action-btn demote" data-onclick="updateAdminFeedbackStatus('triaged')">Mark reviewed</button>
          <button type="button" class="action-btn promote" data-onclick="updateAdminFeedbackStatus('promoted')">Ready for promotion</button>
          <button type="button" class="action-btn delete" data-onclick="updateAdminFeedbackStatus('rejected')">Reject</button>
        </div>
        <label class="feedback-form__label" for="adminFeedbackRejectionReason">Rejection reason</label>
        <textarea id="adminFeedbackRejectionReason" class="feedback-form__textarea admin-feedback-rejection" placeholder="Add context if you reject this item.">${escape(item.rejectionReason || "")}</textarea>
      </div>
    </div>
  `;
}

function renderAdminFeedbackWorkspace() {
  if (!ensureAdminWorkspaceShell()) {
    return;
  }
  renderAdminFeedbackList();
  renderAdminFeedbackDetail();
}

function buildQueryString() {
  const search = new URLSearchParams();
  if (state.adminFeedbackFilters.status) {
    search.set("status", state.adminFeedbackFilters.status);
  }
  if (state.adminFeedbackFilters.type) {
    search.set("type", state.adminFeedbackFilters.type);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function selectAdminFeedback(feedbackId) {
  if (!feedbackId) {
    state.adminFeedbackSelectedId = "";
    state.adminFeedbackDetail = null;
    renderAdminFeedbackDetail();
    return;
  }

  state.adminFeedbackSelectedId = feedbackId;
  state.adminFeedbackDetailLoading = true;
  renderAdminFeedbackWorkspace();

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(feedbackId)}`,
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to load feedback details",
        "error",
      );
      state.adminFeedbackDetail = null;
      return;
    }

    hooks.hideMessage?.("adminMessage");
    state.adminFeedbackDetail = data;
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
    state.adminFeedbackDetail = null;
  } finally {
    state.adminFeedbackDetailLoading = false;
    renderAdminFeedbackWorkspace();
  }
}

export async function loadAdminFeedbackQueue() {
  ensureAdminWorkspaceShell();
  state.adminFeedbackListLoading = true;
  renderAdminFeedbackWorkspace();

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback${buildQueryString()}`,
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to load feedback queue",
        "error",
      );
      state.adminFeedbackItems = [];
      state.adminFeedbackSelectedId = "";
      state.adminFeedbackDetail = null;
      return;
    }

    hooks.hideMessage?.("adminMessage");
    state.adminFeedbackItems = Array.isArray(data) ? data : [];

    const selectedStillExists = state.adminFeedbackItems.some(
      (item) => item.id === state.adminFeedbackSelectedId,
    );
    const nextSelectedId =
      (selectedStillExists && state.adminFeedbackSelectedId) ||
      state.adminFeedbackItems[0]?.id ||
      "";

    state.adminFeedbackSelectedId = nextSelectedId;
    state.adminFeedbackDetail = null;
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
    state.adminFeedbackItems = [];
    state.adminFeedbackSelectedId = "";
    state.adminFeedbackDetail = null;
  } finally {
    state.adminFeedbackListLoading = false;
    renderAdminFeedbackWorkspace();
  }

  if (state.adminFeedbackSelectedId) {
    await selectAdminFeedback(state.adminFeedbackSelectedId);
  }
}

export function setAdminFeedbackFilter(kind, value) {
  if (kind !== "status" && kind !== "type") {
    return;
  }

  state.adminFeedbackFilters[kind] = value || "";
  void loadAdminFeedbackQueue();
}

export async function updateAdminFeedbackStatus(status) {
  if (!state.adminFeedbackSelectedId) {
    return;
  }

  const rejectionField = document.getElementById(
    "adminFeedbackRejectionReason",
  );
  const rejectionReason =
    rejectionField instanceof HTMLTextAreaElement
      ? rejectionField.value.trim()
      : "";

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(state.adminFeedbackSelectedId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rejectionReason: rejectionReason || null,
        }),
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to update feedback status",
        "error",
      );
      return;
    }

    hooks.showMessage?.("adminMessage", `Feedback marked ${status}`, "success");
    await loadAdminFeedbackQueue();
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  }
}

export { renderAdminFeedbackWorkspace };
