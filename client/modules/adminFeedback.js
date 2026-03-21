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

function formatConfidence(value) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "Unknown";
}

function getAdminFeedbackElements() {
  return {
    container: document.getElementById("adminContent"),
    automation: document.getElementById("adminFeedbackAutomationPanel"),
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
      <section class="admin-section admin-feedback-automation-section">
        <div class="admin-section__header">
          <div>
            <h2 class="admin-section__title">Feedback Automation</h2>
            <p class="admin-section__subtitle">Keep auto-promotion off by default, then graduate only high-confidence, non-duplicate feedback into GitHub.</p>
          </div>
        </div>
        <div id="adminFeedbackAutomationPanel"></div>
      </section>
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

function renderAutomationPanel() {
  const { automation } = getAdminFeedbackElements();
  if (!(automation instanceof HTMLElement)) {
    return;
  }

  if (
    state.adminFeedbackAutomationConfigLoading ||
    state.adminFeedbackAutomationDecisionsLoading
  ) {
    automation.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        Loading automation controls...
      </div>
    `;
    return;
  }

  const config = state.adminFeedbackAutomationConfig;
  if (!config) {
    automation.innerHTML = `
      <p class="admin-detail-empty-copy">Automation settings are unavailable right now.</p>
    `;
    return;
  }

  const decisions = state.adminFeedbackAutomationDecisions || [];
  automation.innerHTML = `
    <div class="admin-automation-grid">
      <div class="admin-detail-block">
        <h4>Controls</h4>
        <div class="admin-automation-form">
          <label class="admin-automation-toggle">
            <input
              id="adminFeedbackAutomationEnabled"
              type="checkbox"
              ${config.feedbackAutomationEnabled ? "checked" : ""}
            />
            <span>Enable feedback automation</span>
          </label>
          <label class="admin-automation-toggle">
            <input
              id="adminFeedbackAutoPromoteEnabled"
              type="checkbox"
              ${config.feedbackAutoPromoteEnabled ? "checked" : ""}
            />
            <span>Enable auto-promotion after checks pass</span>
          </label>
          <label class="feedback-form__label" for="adminFeedbackAutoPromoteMinConfidence">Minimum confidence threshold</label>
          <input
            id="adminFeedbackAutoPromoteMinConfidence"
            class="feedback-form__input"
            type="number"
            min="0"
            max="1"
            step="0.01"
            value="${escape(config.feedbackAutoPromoteMinConfidence)}"
          />
          <p class="admin-detail-empty-copy">
            Allowlisted classifications: ${escape(
              (config.allowlistedClassifications || []).join(", "),
            )}
          </p>
          <div class="admin-feedback-actions">
            <button
              type="button"
              class="action-btn"
              data-onclick="saveAdminFeedbackAutomationConfig()"
              ${state.adminFeedbackAutomationSaving ? "disabled" : ""}
            >
              ${state.adminFeedbackAutomationSaving ? "Saving..." : "Save settings"}
            </button>
            <button
              type="button"
              class="action-btn promote"
              data-onclick="runAdminFeedbackAutomation()"
              ${state.adminFeedbackAutomationRunLoading ? "disabled" : ""}
            >
              ${state.adminFeedbackAutomationRunLoading ? "Running..." : "Run now"}
            </button>
          </div>
        </div>
      </div>
      <div class="admin-detail-block">
        <h4>Recent Decisions</h4>
        ${
          decisions.length
            ? `<div class="admin-automation-decision-list">${decisions
                .map(
                  (decision) => `
                    <button
                      type="button"
                      class="admin-automation-decision"
                      data-onclick="selectAdminFeedback('${decision.id}')"
                    >
                      <div class="admin-feedback-row__top">
                        <span class="admin-feedback-pill admin-feedback-pill--${escape(decision.type)}">${escape(decision.type)}</span>
                        <span class="admin-feedback-pill admin-feedback-pill--status">${escape(decision.promotionDecision)}</span>
                      </div>
                      <strong class="admin-feedback-row__title">${escape(decision.title)}</strong>
                      <div class="admin-feedback-row__meta">
                        <span>${escape(decision.promotionReason || "No reason captured")}</span>
                      </div>
                      <div class="admin-feedback-row__meta">
                        <span>${escape(formatDateTime(decision.promotionDecidedAt))}</span>
                        <span>${escape(
                          decision.githubIssueNumber
                            ? `#${decision.githubIssueNumber}`
                            : formatConfidence(decision.triageConfidence),
                        )}</span>
                      </div>
                    </button>
                  `,
                )
                .join("")}</div>`
            : `<p class="admin-detail-empty-copy">No automation decisions yet.</p>`
        }
      </div>
    </div>
  `;
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

function renderTriagePanel(item) {
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
          ${renderMetadataRow("Confidence", formatConfidence(item.triageConfidence))}
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

function mapFailureActionLabel(actionType) {
  if (actionType === "feedback.triage") {
    return "Retry triage";
  }
  if (actionType === "feedback.duplicate_search") {
    return "Retry duplicate check";
  }
  if (actionType === "feedback.promotion") {
    return "Retry promotion";
  }
  return "Retry";
}

function mapFailureRetryAction(actionType) {
  if (actionType === "feedback.triage") {
    return "triage";
  }
  if (actionType === "feedback.duplicate_search") {
    return "duplicate_check";
  }
  if (actionType === "feedback.promotion") {
    return "promotion";
  }
  return "";
}

function renderFailuresPanel() {
  if (state.adminFeedbackFailuresLoading) {
    return `
      <div class="admin-detail-block">
        <div class="loading">
          <div class="spinner"></div>
          Loading feedback failures...
        </div>
      </div>
    `;
  }

  if (!state.adminFeedbackFailures.length) {
    return "";
  }

  return `
    <div class="admin-detail-block">
      <div class="admin-detail-block__header">
        <h4>Pipeline Failures</h4>
      </div>
      <div class="admin-detail-stack">
        ${state.adminFeedbackFailures
          .map((failure) => {
            const retryAction = mapFailureRetryAction(failure.actionType);
            return `
              <div class="admin-detail-meta admin-detail-meta--card">
                ${renderMetadataRow("Action", failure.actionType)}
                ${renderMetadataRow("Error", failure.errorMessage || failure.errorCode || "")}
                ${renderMetadataRow("Created", formatDateTime(failure.createdAt))}
                ${renderMetadataRow("Retry count", String(failure.retryCount ?? 0))}
                ${renderMetadataRow("Resolved", failure.resolvedAt ? formatDateTime(failure.resolvedAt) : "Open")}
                ${renderMetadataRow("Resolution", failure.resolution || "")}
                ${
                  retryAction && failure.retryable && !failure.resolvedAt
                    ? `<div class="admin-feedback-actions">
                        <button type="button" class="action-btn" data-onclick="retryAdminFeedbackAction('${retryAction}')">${escape(mapFailureActionLabel(failure.actionType))}</button>
                      </div>`
                    : ""
                }
              </div>
            `;
          })
          .join("")}
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
              ${renderMetadataRow("Automation decision", item.promotionDecision || "")}
              ${renderMetadataRow("Decision reason", item.promotionReason || "")}
              ${renderMetadataRow("Decision run", item.promotionRunId || "")}
              ${renderMetadataRow("Decision time", item.promotionDecidedAt ? formatDateTime(item.promotionDecidedAt) : "")}
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
      ${renderFailuresPanel()}

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
  renderAutomationPanel();
  renderAdminFeedbackList();
  renderAdminFeedbackDetail();
}

function updateFeedbackItemInList(nextItem) {
  const itemIndex = state.adminFeedbackItems.findIndex(
    (item) => item.id === nextItem.id,
  );
  if (itemIndex >= 0) {
    state.adminFeedbackItems[itemIndex] = {
      ...state.adminFeedbackItems[itemIndex],
      ...nextItem,
    };
  }
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

export async function loadAdminFeedbackAutomationPanel() {
  ensureAdminWorkspaceShell();
  state.adminFeedbackAutomationConfigLoading = true;
  state.adminFeedbackAutomationDecisionsLoading = true;
  renderAdminFeedbackWorkspace();

  try {
    const [configResponse, decisionsResponse] = await Promise.all([
      hooks.apiCall(`${hooks.API_URL}/admin/feedback/automation/config`),
      hooks.apiCall(`${hooks.API_URL}/admin/feedback/automation/decisions`),
    ]);
    const configData = configResponse
      ? await hooks.parseApiBody(configResponse)
      : {};
    const decisionsData = decisionsResponse
      ? await hooks.parseApiBody(decisionsResponse)
      : {};

    if (!configResponse?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        configData.error || "Failed to load feedback automation settings",
        "error",
      );
      state.adminFeedbackAutomationConfig = null;
    } else {
      state.adminFeedbackAutomationConfig = configData;
    }

    if (!decisionsResponse?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        decisionsData.error || "Failed to load automation decisions",
        "error",
      );
      state.adminFeedbackAutomationDecisions = [];
    } else {
      state.adminFeedbackAutomationDecisions = Array.isArray(decisionsData)
        ? decisionsData
        : [];
    }
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
    state.adminFeedbackAutomationConfig = null;
    state.adminFeedbackAutomationDecisions = [];
  } finally {
    state.adminFeedbackAutomationConfigLoading = false;
    state.adminFeedbackAutomationDecisionsLoading = false;
    renderAdminFeedbackWorkspace();
  }
}

export async function selectAdminFeedback(feedbackId) {
  if (!feedbackId) {
    state.adminFeedbackSelectedId = "";
    state.adminFeedbackDetail = null;
    state.adminFeedbackFailures = [];
    state.adminFeedbackPromotionPreview = null;
    state.adminFeedbackPromotionPreviewError = "";
    renderAdminFeedbackWorkspace();
    return;
  }

  state.adminFeedbackSelectedId = feedbackId;
  state.adminFeedbackDetailLoading = true;
  state.adminFeedbackFailures = [];
  state.adminFeedbackFailuresLoading = true;
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

  await Promise.all([
    loadAdminFeedbackPromotionPreview(),
    loadAdminFeedbackFailures(),
  ]);
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
      state.adminFeedbackFailures = [];
      state.adminFeedbackPromotionPreview = null;
      state.adminFeedbackPromotionPreviewError = "";
      return;
    }

    hooks.hideMessage?.("adminMessage");
    state.adminFeedbackItems = Array.isArray(data) ? data : [];

    const selectedStillExists = state.adminFeedbackItems.some(
      (item) => item.id === state.adminFeedbackSelectedId,
    );
    state.adminFeedbackSelectedId =
      (selectedStillExists && state.adminFeedbackSelectedId) ||
      state.adminFeedbackItems[0]?.id ||
      "";
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
    state.adminFeedbackFailures = [];
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

export async function saveAdminFeedbackAutomationConfig() {
  const enabledField = document.getElementById(
    "adminFeedbackAutomationEnabled",
  );
  const autoPromoteField = document.getElementById(
    "adminFeedbackAutoPromoteEnabled",
  );
  const thresholdField = document.getElementById(
    "adminFeedbackAutoPromoteMinConfidence",
  );

  if (
    !(enabledField instanceof HTMLInputElement) ||
    !(autoPromoteField instanceof HTMLInputElement) ||
    !(thresholdField instanceof HTMLInputElement)
  ) {
    return;
  }

  state.adminFeedbackAutomationSaving = true;
  renderAdminFeedbackWorkspace();

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/automation/config`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackAutomationEnabled: enabledField.checked,
          feedbackAutoPromoteEnabled: autoPromoteField.checked,
          feedbackAutoPromoteMinConfidence: Number.parseFloat(
            thresholdField.value,
          ),
        }),
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to save feedback automation settings",
        "error",
      );
      return;
    }

    state.adminFeedbackAutomationConfig = data;
    hooks.showMessage?.(
      "adminMessage",
      "Feedback automation settings updated",
      "success",
    );
    renderAdminFeedbackWorkspace();
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  } finally {
    state.adminFeedbackAutomationSaving = false;
    renderAdminFeedbackWorkspace();
  }
}

export async function runAdminFeedbackAutomation() {
  state.adminFeedbackAutomationRunLoading = true;
  renderAdminFeedbackWorkspace();

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/automation/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to run feedback automation",
        "error",
      );
      return;
    }

    hooks.showMessage?.(
      "adminMessage",
      data.skipped
        ? data.reason || "Feedback automation skipped"
        : `Automation processed ${data.processedCount} items`,
      "success",
    );
    await Promise.all([
      loadAdminFeedbackAutomationPanel(),
      loadAdminFeedbackQueue(),
    ]);
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  } finally {
    state.adminFeedbackAutomationRunLoading = false;
    renderAdminFeedbackWorkspace();
  }
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
    await Promise.all([
      loadAdminFeedbackAutomationPanel(),
      loadAdminFeedbackQueue(),
    ]);
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
    updateFeedbackItemInList(data);
    renderAdminFeedbackWorkspace();
    await Promise.all([
      loadAdminFeedbackFailures(),
      loadAdminFeedbackPromotionPreview(),
      loadAdminFeedbackAutomationPanel(),
    ]);
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
    await Promise.all([
      loadAdminFeedbackAutomationPanel(),
      loadAdminFeedbackQueue(),
    ]);
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
    updateFeedbackItemInList(data);
    renderAdminFeedbackWorkspace();
    await Promise.all([
      loadAdminFeedbackFailures(),
      loadAdminFeedbackPromotionPreview(),
      loadAdminFeedbackAutomationPanel(),
    ]);
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
  } catch (error) {
    state.adminFeedbackPromotionPreview = null;
    state.adminFeedbackPromotionPreviewError =
      "Network error while building promotion preview";
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
        await Promise.all([
          loadAdminFeedbackFailures(),
          loadAdminFeedbackPromotionPreview(),
        ]);
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
    await Promise.all([
      loadAdminFeedbackFailures(),
      loadAdminFeedbackAutomationPanel(),
      loadAdminFeedbackQueue(),
    ]);
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  }
}

export async function loadAdminFeedbackFailures() {
  if (!state.adminFeedbackSelectedId) {
    state.adminFeedbackFailures = [];
    state.adminFeedbackFailuresLoading = false;
    renderAdminFeedbackWorkspace();
    return;
  }

  state.adminFeedbackFailuresLoading = true;
  renderAdminFeedbackWorkspace();

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(state.adminFeedbackSelectedId)}/failures`,
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      state.adminFeedbackFailures = [];
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to load feedback failures",
        "error",
      );
      return;
    }

    state.adminFeedbackFailures = Array.isArray(data) ? data : [];
  } catch (error) {
    state.adminFeedbackFailures = [];
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  } finally {
    state.adminFeedbackFailuresLoading = false;
    renderAdminFeedbackWorkspace();
  }
}

export async function retryAdminFeedbackAction(action) {
  if (!state.adminFeedbackSelectedId) {
    return;
  }

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/admin/feedback/${encodeURIComponent(state.adminFeedbackSelectedId)}/retry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (!response?.ok) {
      if (response?.status === 409 && data.feedbackRequest) {
        state.adminFeedbackDetail = data.feedbackRequest;
        state.adminFeedbackFailures = Array.isArray(data.failures)
          ? data.failures
          : state.adminFeedbackFailures;
        renderAdminFeedbackWorkspace();
      }
      hooks.showMessage?.(
        "adminMessage",
        data.error || "Failed to retry feedback action",
        "error",
      );
      return;
    }

    state.adminFeedbackDetail =
      data.feedbackRequest || state.adminFeedbackDetail;
    state.adminFeedbackFailures = Array.isArray(data.failures)
      ? data.failures
      : [];
    updateFeedbackItemInList(state.adminFeedbackDetail);
    hooks.showMessage?.("adminMessage", "Feedback retry completed", "success");
    renderAdminFeedbackWorkspace();
    await Promise.all([
      loadAdminFeedbackAutomationPanel(),
      loadAdminFeedbackPromotionPreview(),
      loadAdminFeedbackQueue(),
    ]);
  } catch (error) {
    hooks.showMessage?.(
      "adminMessage",
      "Network error. Please try again.",
      "error",
    );
  }
}

export { renderAdminFeedbackWorkspace };
