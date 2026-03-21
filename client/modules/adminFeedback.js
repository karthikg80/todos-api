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

function renderListBlock(title, items, emptyLabel = "None") {
  const listItems = Array.isArray(items) ? items.filter(Boolean) : [];
  return `
    <div class="admin-detail-block">
      <h4>${escape(title)}</h4>
      ${
        listItems.length
          ? `<ul class="admin-detail-list">${listItems
              .map((item) => `<li>${escape(item)}</li>`)
              .join("")}</ul>`
          : `<p class="admin-detail-empty-copy">${escape(emptyLabel)}</p>`
      }
    </div>
  `;
}

function renderTriagePanel(item) {
  const confidence =
    typeof item.triageConfidence === "number"
      ? `${Math.round(item.triageConfidence * 100)}%`
      : "Not triaged yet";

  return `
    <div class="admin-detail-panel">
      <div class="admin-detail-block">
        <div class="admin-detail-block__header">
          <h4>AI Triage</h4>
          <button type="button" class="action-btn" data-onclick="runAdminFeedbackTriage()">
            ${item.classification ? "Re-run triage" : "Run triage"}
          </button>
        </div>
        <div class="admin-detail-meta">
          ${renderMetadataRow("Classification", item.classification || "")}
          ${renderMetadataRow("Confidence", confidence)}
          ${renderMetadataRow("Normalized title", item.normalizedTitle || "")}
          ${renderMetadataRow("Summary", item.triageSummary || "")}
          ${renderMetadataRow("Impact", item.impactSummary || "")}
          ${renderMetadataRow("Expected behavior", item.expectedBehavior || "")}
          ${renderMetadataRow("Actual behavior", item.actualBehavior || "")}
          ${renderMetadataRow("Proposed outcome", item.proposedOutcome || "")}
          ${renderMetadataRow("Dedupe key", item.dedupeKey || "")}
          ${renderMetadataRow("Severity", item.severity || "")}
        </div>
      </div>
      <div class="admin-detail-block">
        <h4>Normalized body</h4>
        <pre class="admin-detail-pre">${escape(item.normalizedBody || "No triage output yet.")}</pre>
      </div>
      ${renderListBlock("Repro steps", item.reproSteps, "No repro steps extracted")}
      ${renderListBlock("Labels", item.agentLabels, "No labels assigned")}
      ${renderListBlock("Missing info flags", item.missingInfo, "No missing info flags")}
    </div>
  `;
}

function renderDuplicatePanel(item) {
  const hasConfirmedDuplicate =
    item.duplicateOfFeedbackId || item.duplicateOfGithubIssueNumber;
  const hasCandidate =
    item.duplicateCandidate ||
    (Array.isArray(item.matchedFeedbackIds) &&
      item.matchedFeedbackIds.length > 0) ||
    item.matchedGithubIssueNumber;

  if (!hasConfirmedDuplicate && !hasCandidate) {
    return "";
  }

  return `
    <div class="admin-detail-block">
      <div class="admin-detail-block__header">
        <h4>Duplicate Review</h4>
        <button type="button" class="action-btn" data-onclick="runAdminFeedbackDuplicateCheck()">
          Check duplicates
        </button>
      </div>
      <div class="admin-detail-meta">
        ${renderMetadataRow("Suggested duplicate", item.duplicateCandidate ? "Yes" : "No")}
        ${renderMetadataRow("Suggested feedback IDs", (item.matchedFeedbackIds || []).join(", "))}
        ${renderMetadataRow("Suggested GitHub issue", item.matchedGithubIssueNumber ? `#${item.matchedGithubIssueNumber}` : "")}
        ${renderMetadataRow("Confirmed feedback duplicate", item.duplicateOfFeedbackId || "")}
        ${renderMetadataRow("Confirmed GitHub duplicate", item.duplicateOfGithubIssueNumber ? `#${item.duplicateOfGithubIssueNumber}` : "")}
        ${renderMetadataRow("Duplicate reason", item.duplicateReason || "")}
      </div>
      ${
        item.matchedGithubIssueUrl || item.duplicateOfGithubIssueUrl
          ? `<div class="admin-detail-links">
              ${
                item.matchedGithubIssueUrl
                  ? `<a class="admin-detail-link" href="${escape(item.matchedGithubIssueUrl)}" target="_blank" rel="noreferrer">Suggested GitHub issue</a>`
                  : ""
              }
              ${
                item.duplicateOfGithubIssueUrl
                  ? `<a class="admin-detail-link" href="${escape(item.duplicateOfGithubIssueUrl)}" target="_blank" rel="noreferrer">Confirmed GitHub issue</a>`
                  : ""
              }
            </div>`
          : ""
      }
      ${
        item.duplicateCandidate
          ? `<div class="admin-feedback-actions">
              ${
                item.matchedFeedbackIds?.[0]
                  ? `<button type="button" class="action-btn demote" data-onclick="confirmAdminFeedbackDuplicate('feedback')">Link matched feedback</button>`
                  : ""
              }
              ${
                item.matchedGithubIssueNumber
                  ? `<button type="button" class="action-btn demote" data-onclick="confirmAdminFeedbackDuplicate('github')">Link GitHub issue</button>`
                  : ""
              }
              <button type="button" class="action-btn promote" data-onclick="ignoreDuplicateAndPromote()">Ignore and promote</button>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderPromotionPanel(item) {
  if (state.adminFeedbackPromotionPreviewLoading) {
    return `
      <div class="admin-detail-block">
        <div class="loading">
          <div class="spinner"></div>
          Building issue preview...
        </div>
      </div>
    `;
  }

  if (state.adminFeedbackPromotionPreviewError) {
    return `
      <div class="admin-detail-block">
        <div class="admin-detail-block__header">
          <h4>Promotion Preview</h4>
          <button type="button" class="action-btn" data-onclick="runAdminFeedbackPromotionPreview()">
            Refresh preview
          </button>
        </div>
        <p class="admin-detail-empty-copy">${escape(state.adminFeedbackPromotionPreviewError)}</p>
      </div>
    `;
  }

  const preview = state.adminFeedbackPromotionPreview;
  if (!preview) {
    return "";
  }

  const promoteButtonLabel = item.duplicateCandidate
    ? "Ignore duplicate and create issue"
    : item.githubIssueNumber
      ? "Issue already created"
      : "Create GitHub issue";

  return `
    <div class="admin-detail-block">
      <div class="admin-detail-block__header">
        <h4>Promotion Preview</h4>
        <button type="button" class="action-btn" data-onclick="runAdminFeedbackPromotionPreview()">
          Refresh preview
        </button>
      </div>
      <div class="admin-detail-meta">
        ${renderMetadataRow("Issue type", preview.issueType)}
        ${renderMetadataRow("Issue title", preview.title)}
        ${renderMetadataRow("Labels", (preview.labels || []).join(", "))}
        ${renderMetadataRow("Source feedback IDs", (preview.sourceFeedbackIds || []).join(", "))}
        ${renderMetadataRow("Promotion status", item.githubIssueNumber ? `Created as #${item.githubIssueNumber}` : preview.canPromote ? "Ready" : "Blocked")}
      </div>
      ${
        item.githubIssueUrl
          ? `<div class="admin-detail-links">
              <a class="admin-detail-link" href="${escape(item.githubIssueUrl)}" target="_blank" rel="noreferrer">Open created GitHub issue</a>
            </div>`
          : ""
      }
      ${renderListBlock("Labels to apply", preview.labels, "No labels suggested")}
      <div class="admin-detail-block">
        <h4>Issue body</h4>
        <pre class="admin-detail-pre">${escape(preview.body)}</pre>
      </div>
      <div class="admin-feedback-actions">
        <button
          type="button"
          class="action-btn promote"
          data-onclick="${item.duplicateCandidate ? "ignoreDuplicateAndPromote()" : "promoteAdminFeedback()"}"
          ${item.githubIssueNumber ? "disabled" : ""}
        >
          ${escape(promoteButtonLabel)}
        </button>
      </div>
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

      <div class="admin-detail-columns">
        <div class="admin-detail-panel">
          <div class="admin-detail-block">
            <h4>Raw submission</h4>
            <pre class="admin-detail-pre">${escape(item.body)}</pre>
          </div>

          <div class="admin-detail-block">
            <h4>Captured metadata</h4>
            <div class="admin-detail-meta">
              ${renderMetadataRow("User", item.user?.email || item.userId)}
              ${renderMetadataRow("Reviewer", item.reviewer?.email || "")}
              ${renderMetadataRow("Reviewed at", item.reviewedAt ? formatDateTime(item.reviewedAt) : "")}
              ${renderMetadataRow("Promoted at", item.promotedAt ? formatDateTime(item.promotedAt) : "")}
              ${renderMetadataRow("Page URL", item.pageUrl || "")}
              ${renderMetadataRow("App version", item.appVersion || "")}
              ${renderMetadataRow("Browser", item.userAgent || "")}
              ${renderMetadataRow("Screenshot URL", item.screenshotUrl || "")}
              ${renderMetadataRow("Attachment", attachmentSummary)}
              ${renderMetadataRow("Rejection reason", item.rejectionReason || "")}
            </div>
          </div>
        </div>

        ${renderTriagePanel(item)}
      </div>

      ${renderDuplicatePanel(item)}
      ${renderPromotionPanel(item)}

      <div class="admin-detail-block">
        <h4>Review Actions</h4>
        <div class="admin-feedback-actions">
          <button type="button" class="action-btn demote" data-onclick="updateAdminFeedbackStatus('triaged')">Mark reviewed</button>
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
    state.adminFeedbackPromotionPreview = null;
    state.adminFeedbackPromotionPreviewError = "";
    renderAdminFeedbackDetail();
    return;
  }

  state.adminFeedbackSelectedId = feedbackId;
  state.adminFeedbackDetailLoading = true;
  state.adminFeedbackPromotionPreview = null;
  state.adminFeedbackPromotionPreviewError = "";
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

  await loadAdminFeedbackPromotionPreview();
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
      state.adminFeedbackPromotionPreview = null;
      state.adminFeedbackPromotionPreviewError = "";
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
    state.adminFeedbackPromotionPreview = null;
    state.adminFeedbackPromotionPreviewError = "";
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
      if (response?.status === 409 && data.feedbackRequest) {
        hooks.showMessage?.(
          "adminMessage",
          data.error || "Duplicate candidate found. Review suggestions below.",
          "error",
        );
        state.adminFeedbackDetail = data.feedbackRequest;
        renderAdminFeedbackWorkspace();
        return;
      }

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

export async function runAdminFeedbackTriage() {
  if (!state.adminFeedbackSelectedId) {
    return;
  }

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(state.adminFeedbackSelectedId)}/triage`,
      {
        method: "POST",
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to triage feedback",
        "error",
      );
      return;
    }

    hooks.showMessage?.("adminMessage", "Feedback triage updated", "success");
    state.adminFeedbackDetail = data;
    const itemIndex = state.adminFeedbackItems.findIndex(
      (item) => item.id === data.id,
    );
    if (itemIndex >= 0) {
      state.adminFeedbackItems[itemIndex] = {
        ...state.adminFeedbackItems[itemIndex],
        ...data,
      };
    }
    renderAdminFeedbackWorkspace();
    await loadAdminFeedbackPromotionPreview();
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  }
}

async function patchAdminFeedback(payload, successMessage) {
  if (!state.adminFeedbackSelectedId) {
    return;
  }

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(state.adminFeedbackSelectedId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to update duplicate resolution",
        "error",
      );
      return;
    }

    hooks.showMessage?.("adminMessage", successMessage, "success");
    await loadAdminFeedbackQueue();
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  }
}

export async function confirmAdminFeedbackDuplicate(kind) {
  const item = state.adminFeedbackDetail;
  if (!item) {
    return;
  }

  if (kind === "feedback" && item.matchedFeedbackIds?.[0]) {
    await patchAdminFeedback(
      {
        status: "triaged",
        duplicateOfFeedbackId: item.matchedFeedbackIds[0],
        duplicateReason:
          item.duplicateReason || "Confirmed duplicate of existing feedback",
      },
      "Feedback linked as duplicate",
    );
  }

  if (kind === "github" && item.matchedGithubIssueNumber) {
    await patchAdminFeedback(
      {
        status: "triaged",
        duplicateOfGithubIssueNumber: item.matchedGithubIssueNumber,
        duplicateReason:
          item.duplicateReason ||
          "Confirmed duplicate of existing GitHub issue",
      },
      "Feedback linked to existing GitHub issue",
    );
  }
}

export async function ignoreDuplicateAndPromote() {
  await promoteAdminFeedback(true);
}

export async function runAdminFeedbackDuplicateCheck() {
  if (!state.adminFeedbackSelectedId) {
    return;
  }

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(state.adminFeedbackSelectedId)}/duplicate-check`,
      {
        method: "POST",
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to check duplicates",
        "error",
      );
      return;
    }

    hooks.showMessage?.(
      "adminMessage",
      data.duplicateCandidate
        ? "Duplicate candidates found"
        : "No duplicate candidates found",
      "success",
    );
    state.adminFeedbackDetail = data;
    renderAdminFeedbackWorkspace();
    await loadAdminFeedbackPromotionPreview();
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  }
}

export async function loadAdminFeedbackPromotionPreview() {
  if (!state.adminFeedbackSelectedId) {
    state.adminFeedbackPromotionPreview = null;
    state.adminFeedbackPromotionPreviewError = "";
    return;
  }

  state.adminFeedbackPromotionPreviewLoading = true;
  state.adminFeedbackPromotionPreviewError = "";
  renderAdminFeedbackWorkspace();

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(state.adminFeedbackSelectedId)}/promotion-preview`,
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      state.adminFeedbackPromotionPreview = null;
      state.adminFeedbackPromotionPreviewError =
        data.error || "Promotion preview unavailable";
      renderAdminFeedbackWorkspace();
      return;
    }

    state.adminFeedbackPromotionPreview = data;
    renderAdminFeedbackWorkspace();
  } catch (error) {
    state.adminFeedbackPromotionPreview = null;
    state.adminFeedbackPromotionPreviewError =
      "Network error while building promotion preview";
    renderAdminFeedbackWorkspace();
  } finally {
    state.adminFeedbackPromotionPreviewLoading = false;
    renderAdminFeedbackWorkspace();
  }
}

export async function runAdminFeedbackPromotionPreview() {
  await loadAdminFeedbackPromotionPreview();
}

export async function promoteAdminFeedback(ignoreDuplicateSuggestion = false) {
  if (!state.adminFeedbackSelectedId) {
    return;
  }

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(state.adminFeedbackSelectedId)}/promote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignoreDuplicateSuggestion }),
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      if (response?.status === 409 && data.feedbackRequest) {
        hooks.showMessage?.(
          "adminMessage",
          data.error || "Duplicate candidate found. Review suggestions below.",
          "error",
        );
        state.adminFeedbackDetail = data.feedbackRequest;
        renderAdminFeedbackWorkspace();
        await loadAdminFeedbackPromotionPreview();
        return;
      }

      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to promote feedback to GitHub",
        "error",
      );
      return;
    }

    state.adminFeedbackDetail =
      data.feedbackRequest || state.adminFeedbackDetail;
    hooks.showMessage?.(
      "adminMessage",
      data.promotion?.issueNumber
        ? `Created GitHub issue #${data.promotion.issueNumber}`
        : "Feedback promoted",
      "success",
    );
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
