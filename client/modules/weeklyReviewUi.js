// =============================================================================
// weeklyReviewUi.js — Weekly Reset view: suggest mode → show findings &
// recommended actions → apply mode with confirmation.
// Renders into #todosContent when currentWorkspaceView === "weekly-review".
// All user-provided content is passed through hooks.escapeHtml before
// being assigned to innerHTML, consistent with the existing codebase pattern.
// =============================================================================

import { state, hooks } from "./store.js";
import { applyAsyncAction } from "./stateActions.js";
import { callAgentAction } from "./agentApiClient.js";
import { SOUL_COPY } from "./soulConfig.js";
import { illustrationWeeklyResetClear } from "../utils/illustrations.js";

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderFindingRow(f) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const label = f.type ? f.type.replace(/_/g, " ") : "finding";
  const subject = f.taskTitle || f.projectName || "";
  return `
    <div class="wr-finding">
      <span class="wr-finding__type">${escapeHtml(label)}</span>
      ${subject ? `<span class="wr-finding__subject">${escapeHtml(subject)}</span>` : ""}
      ${f.reason ? `<p class="wr-finding__reason">${escapeHtml(f.reason)}</p>` : ""}
    </div>`;
}

function renderActionRow(a) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const label = a.type ? a.type.replace(/_/g, " ") : "action";
  return `
    <div class="wr-action">
      <span class="wr-action__type">${escapeHtml(label)}</span>
      ${a.title ? `<span class="wr-action__title">${escapeHtml(a.title)}</span>` : ""}
      ${a.reason ? `<p class="wr-action__reason">${escapeHtml(a.reason)}</p>` : ""}
    </div>`;
}

function renderRolloverGroup(group) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const items = Array.isArray(group?.items) ? group.items : [];
  return `
    <div class="wr-rollover-group">
      <div class="wr-rollover-group__header">
        <span class="wr-finding__type">${escapeHtml(String(group?.label || group?.key || "Group"))}</span>
        <span class="wr-finding__subject">${escapeHtml(String(items.length))}</span>
      </div>
      ${
        items.length > 0
          ? `<ul class="wr-rollover-group__list">
              ${items
                .map(
                  (item) =>
                    `<li>${escapeHtml(String(item?.title || "Untitled task"))}</li>`,
                )
                .join("")}
            </ul>`
          : `<p class="wr-empty">Nothing here.</p>`
      }
    </div>`;
}

function renderAnchorSuggestion(item) {
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  return `
    <div class="wr-action">
      <span class="wr-action__type">anchor</span>
      <span class="wr-action__title">${escapeHtml(String(item?.title || "Untitled task"))}</span>
      ${
        item?.reason
          ? `<p class="wr-action__reason">${escapeHtml(String(item.reason))}</p>`
          : ""
      }
    </div>`;
}

function renderSummaryBadges(summary) {
  if (!summary) return "";
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  const badges = [
    {
      label: "projects without next action",
      value: summary.projectsWithoutNextAction,
    },
    { label: "stale tasks", value: summary.staleTasks },
    { label: "pending", value: summary.waitingTasks },
    { label: "upcoming", value: summary.upcomingTasks },
  ]
    .filter((b) => b.value !== undefined && b.value !== null)
    .map(
      (b) =>
        `<span class="wr-badge"><strong>${escapeHtml(String(b.value))}</strong> ${escapeHtml(b.label)}</span>`,
    )
    .join("");
  return badges ? `<div class="wr-summary">${badges}</div>` : "";
}

export function renderWeeklyReviewView() {
  const container = document.getElementById("todosContent");
  if (!container) return;
  if (state.currentWorkspaceView !== "weekly-review") return;

  const s = state.weeklyReviewState;
  const escapeHtml = hooks.escapeHtml || ((s) => String(s));

  let bodyHtml;

  if (s.loading) {
    bodyHtml = `<div class="wr-loading" role="status" aria-live="polite">Running weekly reset…</div>`;
  } else if (s.error) {
    bodyHtml = `
      <div class="wr-error">${escapeHtml(s.error)}</div>
      <button type="button" class="wr-btn" data-wr-action="suggest">Retry</button>`;
  } else if (s.hasRun) {
    const reflectionHtml = s.reflectionSummary
      ? `<section class="wr-section">
           <h3 class="wr-section__title">Reflection</h3>
           <p class="wr-intro">${escapeHtml(s.reflectionSummary)}</p>
         </section>`
      : "";

    const findingsHtml =
      s.findings.length > 0
        ? `<section class="wr-section">
            <h3 class="wr-section__title">What got stuck (${s.findings.length})</h3>
            ${s.findings.map(renderFindingRow).join("")}
          </section>`
        : "";

    const rolloverHtml =
      s.rolloverGroups.length > 0
        ? `<section class="wr-section">
             <h3 class="wr-section__title">Rollover review</h3>
             ${s.rolloverGroups.map(renderRolloverGroup).join("")}
           </section>`
        : "";

    const anchorsHtml =
      s.anchorSuggestions.length > 0
        ? `<section class="wr-section">
             <h3 class="wr-section__title">Next week focus</h3>
             ${s.anchorSuggestions.map(renderAnchorSuggestion).join("")}
           </section>`
        : "";

    const adjustmentHtml = s.behaviorAdjustment
      ? `<section class="wr-section">
           <h3 class="wr-section__title">One adjustment</h3>
           <p class="wr-intro">${escapeHtml(s.behaviorAdjustment)}</p>
         </section>`
      : "";

    const actionsHtml =
      s.actions.length > 0
        ? `<section class="wr-section">
            <h3 class="wr-section__title">Suggested cleanup (${s.actions.length})</h3>
            ${s.actions.map(renderActionRow).join("")}
            ${
              s.mode === "suggest"
                ? `<div class="wr-apply-row">
                    <button type="button" class="wr-btn wr-btn--primary" data-wr-action="apply">
                      Apply all actions
                    </button>
                  </div>`
                : `<p class="wr-applied-msg">Actions applied.</p>`
            }
          </section>`
        : `<div class="wr-empty">${illustrationWeeklyResetClear()}<p>Nothing urgent to reset this week.</p></div>`;

    bodyHtml = `${renderSummaryBadges(s.summary)}${reflectionHtml}${rolloverHtml}${findingsHtml}${anchorsHtml}${adjustmentHtml}${actionsHtml}`;
  } else {
    bodyHtml = `<p class="wr-intro">${escapeHtml(SOUL_COPY.reviewIntro)}</p>`;
  }

  // All dynamic values are passed through escapeHtml before innerHTML assignment.
  container.innerHTML = `
    <div class="wr-view">
      <div class="wr-toolbar">
        <h2 class="wr-title">Weekly Reset</h2>
        <button
          type="button"
          class="wr-btn wr-btn--primary"
          data-wr-action="suggest"
          ${s.loading ? "disabled" : ""}
        >
          ${s.loading ? "Running…" : s.hasRun ? "Re-run" : "Run review"}
        </button>
      </div>
      <div class="wr-body">${bodyHtml}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function runWeeklyReview(mode = "suggest") {
  applyAsyncAction("weeklyReview/start");
  if (mode === "apply") {
    applyAsyncAction("weeklyReview/mode:set", { mode: "apply" });
  }
  renderWeeklyReviewView();

  try {
    const data = await callAgentAction("/agent/write/weekly_review", { mode });
    const review = data?.review || data;
    applyAsyncAction("weeklyReview/success", {
      summary: review?.summary || null,
      findings: Array.isArray(review?.findings) ? review.findings : [],
      actions: Array.isArray(review?.recommendedActions)
        ? review.recommendedActions
        : Array.isArray(review?.appliedActions)
          ? review.appliedActions
          : [],
      rolloverGroups: Array.isArray(review?.rolloverGroups)
        ? review.rolloverGroups
        : [],
      anchorSuggestions: Array.isArray(review?.anchorSuggestions)
        ? review.anchorSuggestions
        : [],
      behaviorAdjustment: String(review?.behaviorAdjustment || ""),
      reflectionSummary: String(review?.reflectionSummary || ""),
    });
    if (mode === "apply") {
      applyAsyncAction("weeklyReview/mode:set", { mode: "apply" });
      if (typeof hooks.applyFiltersAndRender === "function") {
        hooks.applyFiltersAndRender();
      }
    }
  } catch (err) {
    applyAsyncAction("weeklyReview/failure", {
      error: err.message || "Could not run weekly reset.",
    });
  }
  renderWeeklyReviewView();
}

// ---------------------------------------------------------------------------
// Event binding (delegated, called once from app.js)
// ---------------------------------------------------------------------------

export function bindWeeklyReviewHandlers() {
  document.addEventListener("click", (event) => {
    if (state.currentWorkspaceView !== "weekly-review") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const actionEl = target.closest("[data-wr-action]");
    if (!(actionEl instanceof HTMLElement)) return;
    const action = actionEl.getAttribute("data-wr-action");
    if (action === "suggest") {
      runWeeklyReview("suggest");
    } else if (action === "apply") {
      runWeeklyReview("apply");
    }
  });
}
