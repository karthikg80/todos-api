// =============================================================================
// cleanupUi.js — Phase 6: Cleanup / Anti-entropy view.
// Four read-only agent analyses rendered into a single workspace view.
// =============================================================================

import { state, hooks } from "./store.js";
import { applyAsyncAction } from "./stateActions.js";
import { callAgentAction } from "./agentApiClient.js";
import { illustrationCleanupClear } from "../utils/illustrations.js";

// ---------------------------------------------------------------------------
// Data loading — calls all four endpoints in parallel, merges into one state
// ---------------------------------------------------------------------------

export async function runCleanupAnalysis() {
  applyAsyncAction("cleanup/start");
  renderCleanupView();

  const [dupRes, staleRes, qualRes, taxRes] = await Promise.allSettled([
    callAgentAction("/agent/read/find_duplicate_tasks", {}),
    callAgentAction("/agent/read/find_stale_items", { staleDays: 30 }),
    callAgentAction("/agent/read/analyze_task_quality", {}),
    callAgentAction("/agent/read/taxonomy_cleanup_suggestions", {}),
  ]);

  const get = (res) => (res.status === "fulfilled" ? res.value : null);
  const dupData = get(dupRes);
  const staleData = get(staleRes);
  const qualData = get(qualRes);
  const taxData = get(taxRes);

  const firstError = [dupRes, staleRes, qualRes, taxRes].find(
    (r) => r.status === "rejected",
  );

  const hasAnyData = dupData || staleData || qualData || taxData;

  if (!hasAnyData && firstError) {
    applyAsyncAction("cleanup/failure", {
      error: firstError.reason?.message || "Cleanup analysis failed.",
    });
  } else {
    const qualResults = (qualData?.results ?? []).filter(
      (r) => r.issues && r.issues.length > 0,
    );
    applyAsyncAction("cleanup/success", {
      duplicates: dupData?.groups ?? [],
      staleItems: [
        ...(staleData?.staleTasks ?? []).map((t) => ({ ...t, kind: "task" })),
        ...(staleData?.staleProjects ?? []).map((p) => ({
          ...p,
          kind: "project",
        })),
      ],
      qualityResults: qualResults,
      taxonomySuggestions: [
        ...(taxData?.similarProjects ?? []).map((p) => ({
          ...p,
          kind: "similar",
        })),
        ...(taxData?.smallProjects ?? []).map((p) => ({ ...p, kind: "small" })),
      ],
    });
  }

  renderCleanupView();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderCleanupView() {
  const container = document.getElementById("todosContent");
  if (!container) return;

  const s = state.cleanupState;
  const escapeHtml = hooks.escapeHtml || ((v) => String(v));

  const hasResults =
    s.duplicates.length > 0 ||
    s.staleItems.length > 0 ||
    s.qualityResults.length > 0 ||
    s.taxonomySuggestions.length > 0;

  let body;
  if (s.loading) {
    body = `<div class="cleanup-loading">Analysing your tasks…</div>`;
  } else if (s.error && !hasResults) {
    body = `
      <div class="cleanup-error">${escapeHtml(s.error)}</div>
      <button type="button" class="cleanup-btn" data-cleanup-action="run">Try again</button>`;
  } else if (!hasResults) {
    body = `
      <div class="cleanup-intro">Run an analysis to find duplicates, stale items, quality issues, and taxonomy suggestions.</div>
      <button type="button" class="cleanup-btn cleanup-btn--primary" data-cleanup-action="run">Run analysis</button>`;
  } else {
    body = buildResultsHtml(s, escapeHtml);
  }

  container.innerHTML = `
    <div class="cleanup-view">
      <div class="cleanup-toolbar">
        <h2 class="cleanup-title">Cleanup</h2>
        <button type="button" class="cleanup-btn" data-cleanup-action="run"
          ${s.loading ? "disabled" : ""}>
          ${s.loading ? "Running…" : "Re-run analysis"}
        </button>
      </div>
      ${body}
    </div>`;
}

function buildResultsHtml(s, escapeHtml) {
  const sections = [];

  // ── Duplicates ──────────────────────────────────────────────────────────
  if (s.duplicates.length > 0) {
    const items = s.duplicates
      .map((group) => {
        const titles = group
          .map(
            (t) => `<li class="cleanup-dup-task">${escapeHtml(t.title)}</li>`,
          )
          .join("");
        return `<ul class="cleanup-dup-group">${titles}</ul>`;
      })
      .join("");
    sections.push(
      buildSection(
        "Duplicate Tasks",
        `${s.duplicates.length} group${s.duplicates.length !== 1 ? "s" : ""}`,
        items,
      ),
    );
  }

  // ── Stale Items ─────────────────────────────────────────────────────────
  if (s.staleItems.length > 0) {
    const items = s.staleItems
      .map((item) => {
        const label =
          item.kind === "project" ? "Project" : escapeHtml(item.status ?? "");
        const date = item.lastUpdated
          ? new Date(item.lastUpdated).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "";
        return `
          <div class="cleanup-stale-item">
            <span class="cleanup-stale-name">${escapeHtml(item.title ?? item.name ?? "")}</span>
            <span class="cleanup-stale-meta">${escapeHtml(label)}${date ? ` · ${date}` : ""}</span>
          </div>`;
      })
      .join("");
    sections.push(
      buildSection(
        "Stale Items",
        `${s.staleItems.length} item${s.staleItems.length !== 1 ? "s" : ""} not updated in 30+ days`,
        items,
      ),
    );
  }

  // ── Quality Issues ───────────────────────────────────────────────────────
  if (s.qualityResults.length > 0) {
    const items = s.qualityResults
      .map((r) => {
        const suggestions = r.suggestions.length
          ? `<ul class="cleanup-quality-suggestions">${r.suggestions.map((sg) => `<li>${escapeHtml(sg)}</li>`).join("")}</ul>`
          : "";
        return `
          <div class="cleanup-quality-item">
            <div class="cleanup-quality-title">${escapeHtml(r.title)}</div>
            <div class="cleanup-quality-issues">${r.issues.map((i) => escapeHtml(i)).join(" · ")}</div>
            ${suggestions}
          </div>`;
      })
      .join("");
    sections.push(
      buildSection(
        "Quality Issues",
        `${s.qualityResults.length} task${s.qualityResults.length !== 1 ? "s" : ""} with issues`,
        items,
      ),
    );
  }

  // ── Taxonomy ─────────────────────────────────────────────────────────────
  if (s.taxonomySuggestions.length > 0) {
    const items = s.taxonomySuggestions
      .map((item) => {
        if (item.kind === "similar") {
          return `
            <div class="cleanup-tax-item">
              <span class="cleanup-tax-badge">Similar</span>
              <span class="cleanup-tax-names">${escapeHtml(item.projectAName)} &amp; ${escapeHtml(item.projectBName)}</span>
            </div>`;
        }
        return `
          <div class="cleanup-tax-item">
            <span class="cleanup-tax-badge">Low activity</span>
            <span class="cleanup-tax-names">${escapeHtml(item.name)}</span>
            <span class="cleanup-tax-count">${item.taskCount} open task${item.taskCount !== 1 ? "s" : ""}</span>
          </div>`;
      })
      .join("");
    sections.push(
      buildSection(
        "Taxonomy Suggestions",
        `${s.taxonomySuggestions.length} suggestion${s.taxonomySuggestions.length !== 1 ? "s" : ""}`,
        items,
      ),
    );
  }

  return (
    sections.join("") ||
    `<div class="cleanup-empty">${illustrationCleanupClear()}No issues found — your task list looks clean!</div>`
  );
}

function buildSection(title, subtitle, bodyHtml) {
  return `
    <div class="cleanup-section">
      <div class="cleanup-section__header">
        <h3 class="cleanup-section__title">${title}</h3>
        <span class="cleanup-section__count">${subtitle}</span>
      </div>
      <div class="cleanup-section__body">${bodyHtml}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------

export function bindCleanupHandlers() {
  document.addEventListener("click", (e) => {
    if (state.currentWorkspaceView !== "cleanup") return;
    const btn = e.target.closest("[data-cleanup-action]");
    if (!(btn instanceof HTMLElement)) return;
    if (btn.getAttribute("data-cleanup-action") === "run") {
      runCleanupAnalysis();
    }
  });
}
