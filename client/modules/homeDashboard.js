// =============================================================================
// homeDashboard.js — Home workspace dashboard, top-focus AI, focus tiles
// =============================================================================
import { state, hooks } from "./store.js";
import { applyDomainAction } from "./stateActions.js";
import {
  isSameLocalDay,
  isTodoUnsorted,
  getOpenTodos,
  setDateView,
  setSelectedProjectKey,
  clearHomeListDrilldown,
} from "./filterLogic.js";
import { selectProjectFromRail } from "./railUi.js";
import { openTodoDrawer } from "./drawerUi.js";
import { loadHomeFocusSuggestions } from "./homeAiService.js";

const { escapeHtml } = window.Utils || {};
const { getProjectLeafName, normalizeProjectPath } =
  window.ProjectPathUtils || {};

const HOME_STALE_RISK_DAYS = 14;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function getTodoDueDate(todo) {
  if (!todo?.dueDate) return null;
  const parsed = new Date(todo.dueDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getStartOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getEndOfDay(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatHomeDueBadge(todo) {
  const dueDate = getTodoDueDate(todo);
  if (!dueDate) return "";
  const now = new Date();
  const today = getStartOfToday(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dueDay = getStartOfToday(dueDate);
  if (dueDay < today && !todo.completed) return "Overdue";
  if (isSameLocalDay(dueDate, now)) return "Today";
  if (isSameLocalDay(dueDate, tomorrow)) return "Tomorrow";
  return dueDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Home model builders
// ---------------------------------------------------------------------------

export function createHomeTodoIdSet(items = []) {
  return new Set(items.map((todo) => String(todo?.id || "")).filter(Boolean));
}

export function takeExclusiveTodos(
  candidates = [],
  limit = 6,
  usedTodoIds = new Set(),
) {
  const result = [];
  for (const todo of candidates) {
    if (result.length >= limit) break;
    const id = String(todo?.id || "");
    if (!id || usedTodoIds.has(id)) continue;
    usedTodoIds.add(id);
    result.push(todo);
  }
  return result;
}

export function getHomeTodoDaysSinceRecentActivity(todo) {
  const raw = todo?.updatedAt || todo?.createdAt || null;
  if (!raw) return Infinity;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return Infinity;
  return (Date.now() - date.getTime()) / 86400000;
}

export function getHomeTopFocusDeterministicReason(todo) {
  const dueDate = getTodoDueDate(todo);
  if (dueDate) {
    const now = new Date();
    const today = getStartOfToday(now);
    if (dueDate < today && !todo.completed) return "Overdue";
    if (isSameLocalDay(dueDate, now)) return "Due today";
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (isSameLocalDay(dueDate, tomorrow)) return "Due tomorrow";
  }
  if (normalizePriorityValue(todo?.priority) === "high") return "High priority";
  return "";
}

export function getHomeAiSuggestionByTodoId(todoId) {
  const normalizedTodoId = String(todoId || "");
  if (!normalizedTodoId) return null;
  return (
    (Array.isArray(state.homeAi?.suggestions)
      ? state.homeAi.suggestions
      : []
    ).find((suggestion) => suggestion.todoId === normalizedTodoId) || null
  );
}

export function getHomeTopFocusReason(todo) {
  const aiSuggestion = getHomeAiSuggestionByTodoId(todo?.id);
  if (aiSuggestion?.summary) return aiSuggestion.summary;
  return getHomeTopFocusDeterministicReason(todo);
}

export function getHomeDueSoonGroupKey(todo) {
  const dueDate = getTodoDueDate(todo);
  if (!dueDate) return "";
  const now = new Date();
  const today = getStartOfToday(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const next3Start = new Date(today);
  next3Start.setDate(today.getDate() + 2);
  const next3End = getEndOfDay(new Date(today.getTime() + 4 * 86400000));
  const dueDay = getStartOfToday(dueDate);
  if (dueDay < today) return "overdue";
  if (isSameLocalDay(dueDate, today)) return "today";
  if (isSameLocalDay(dueDate, tomorrow)) return "tomorrow";
  if (dueDate >= next3Start && dueDate <= next3End) return "next_3_days";
  return "";
}

export function buildHomeDueSoonGroups(items = []) {
  const grouped = {
    overdue: [],
    today: [],
    tomorrow: [],
    next_3_days: [],
  };
  for (const todo of items) {
    const key = getHomeDueSoonGroupKey(todo);
    if (!key || !grouped[key]) continue;
    grouped[key].push(todo);
  }
  return [
    { key: "overdue", label: "Overdue", items: grouped.overdue },
    { key: "today", label: "Today", items: grouped.today },
    { key: "tomorrow", label: "Tomorrow", items: grouped.tomorrow },
    { key: "next_3_days", label: "Next 3 days", items: grouped.next_3_days },
  ].filter((group) => group.items.length > 0);
}

export function getDueSoonTodos(limit = 6) {
  const now = new Date();
  const todayStart = getStartOfToday(now);
  const dueLimit = getEndOfDay(new Date(todayStart.getTime() + 4 * 86400000));
  return getOpenTodos()
    .map((todo) => ({ todo, dueDate: getTodoDueDate(todo) }))
    .filter(({ dueDate }) => dueDate && dueDate <= dueLimit)
    .sort((a, b) => {
      const aOverdue = a.dueDate < todayStart;
      const bOverdue = b.dueDate < todayStart;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (a.dueDate.getTime() !== b.dueDate.getTime()) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      return String(a.todo.title || "").localeCompare(
        String(b.todo.title || ""),
      );
    })
    .slice(0, limit)
    .map(({ todo }) => todo);
}

export function getStaleRiskTodos(limit = 6) {
  const now = Date.now();
  return getOpenTodos()
    .map((todo) => {
      const updatedMs =
        Date.parse(String(todo.updatedAt || todo.createdAt || "")) || 0;
      const createdMs =
        Date.parse(String(todo.createdAt || "")) || updatedMs || 0;
      const daysStale = updatedMs ? (now - updatedMs) / 86400000 : 0;
      const daysOld = createdMs ? (now - createdMs) / 86400000 : 0;
      const dueDate = getTodoDueDate(todo);
      const priority = normalizePriorityValue(todo.priority);
      const isOld = daysStale >= HOME_STALE_RISK_DAYS;
      const isUnsortedOld = isTodoUnsorted(todo) && daysStale >= 7;
      const isHighOld = priority === "high" && daysStale >= 7;
      const isMediumVeryOld =
        priority === "medium" && daysStale >= HOME_STALE_RISK_DAYS + 7;
      const qualifies = isOld || isUnsortedOld || isHighOld || isMediumVeryOld;
      const score =
        daysStale +
        daysOld * 0.2 +
        (isOld ? 4 : 0) +
        (isUnsortedOld ? 4 : 0) +
        (isHighOld ? 3 : 0) +
        (isMediumVeryOld ? 1 : 0) +
        (!dueDate ? 1 : 0);
      return { todo, score, qualifies };
    })
    .filter((entry) => entry.qualifies)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.todo.title || "").localeCompare(
        String(b.todo.title || ""),
      );
    })
    .slice(0, limit)
    .map((entry) => entry.todo);
}

export function getQuickWinTodos(limit = 6) {
  const now = new Date();
  const today = getStartOfToday(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return getOpenTodos()
    .filter((todo) => {
      const dueDate = getTodoDueDate(todo);
      const isOverdue = dueDate && dueDate < now;
      const isDueTodayOrTomorrow =
        !!dueDate &&
        (isSameLocalDay(dueDate, today) || isSameLocalDay(dueDate, tomorrow));
      const hasSubtasks =
        Array.isArray(todo.subtasks) && todo.subtasks.length > 0;
      const hasNotes = !!String(todo.notes || "").trim();
      const title = String(todo.title || "").trim();
      return (
        !!title &&
        !isOverdue &&
        !isDueTodayOrTomorrow &&
        !hasSubtasks &&
        !hasNotes &&
        title.length < 35 &&
        title.split(/\s+/).filter(Boolean).length <= 8
      );
    })
    .sort((a, b) => {
      const aPriority =
        a.priority === "high" ? 0 : a.priority === "medium" ? 1 : 2;
      const bPriority =
        b.priority === "high" ? 0 : b.priority === "medium" ? 1 : 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      const aDue = getTodoDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = getTodoDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
      return String(a.title || "").localeCompare(String(b.title || ""));
    })
    .slice(0, limit);
}

export function getProjectsToNudge(limit = 4) {
  const byProject = new Map();
  const dueSoonSet = new Set(
    getDueSoonTodos(20).map((todo) => String(todo.id)),
  );
  for (const todo of getOpenTodos()) {
    const project = normalizeProjectPath(todo.category);
    if (!project) continue;
    const entry = byProject.get(project) || {
      projectName: project,
      openCount: 0,
      dueSoonCount: 0,
      overdueCount: 0,
    };
    entry.openCount += 1;
    if (dueSoonSet.has(String(todo.id))) entry.dueSoonCount += 1;
    const dueDate = getTodoDueDate(todo);
    if (dueDate && dueDate < new Date()) entry.overdueCount += 1;
    byProject.set(project, entry);
  }
  return Array.from(byProject.values())
    .sort((a, b) => {
      const scoreA = a.openCount + a.dueSoonCount * 2 + a.overdueCount * 3;
      const scoreB = b.openCount + b.dueSoonCount * 2 + b.overdueCount * 3;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.projectName.localeCompare(b.projectName);
    })
    .slice(0, limit);
}

export function getTopFocusFallbackTodos(limit = 3) {
  const dueSoon = getDueSoonTodos(12);
  const stale = getStaleRiskTodos(12);
  const candidates = [...dueSoon, ...stale, ...getOpenTodos()]
    .filter(
      (todo, index, list) =>
        list.findIndex(
          (candidate) => String(candidate.id) === String(todo.id),
        ) === index,
    )
    .sort((a, b) => {
      const aDue = getTodoDueDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = getTodoDueDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const aPriority =
        a.priority === "high" ? 0 : a.priority === "medium" ? 1 : 2;
      const bPriority =
        b.priority === "high" ? 0 : b.priority === "medium" ? 1 : 2;
      if (aDue !== bDue) return aDue - bDue;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  return candidates.slice(0, limit);
}

export function getHomeDashboardModel({ topFocusItems = [] } = {}) {
  const usedTodoIds = createHomeTodoIdSet(topFocusItems);
  const dueSoon = takeExclusiveTodos(getDueSoonTodos(24), 6, usedTodoIds);
  const staleRisks = takeExclusiveTodos(getStaleRiskTodos(24), 6, usedTodoIds);
  const quickWins = takeExclusiveTodos(getQuickWinTodos(24), 6, usedTodoIds);
  return {
    dueSoon,
    dueSoonGroups: buildHomeDueSoonGroups(dueSoon),
    staleRisks,
    quickWins,
    projectsToNudge: getProjectsToNudge(4),
    topFocusFallback: getTopFocusFallbackTodos(3),
  };
}

export function buildHomeTileListByKey(key) {
  const model = getHomeDashboardModel();
  if (key === "due_soon") return model.dueSoon;
  if (key === "stale_risks") return model.staleRisks;
  if (key === "quick_wins") return model.quickWins;
  return [];
}

export function buildHomeTopFocusCandidates() {
  const candidates = [];
  const seen = new Set();
  const push = (todo) => {
    const id = String(todo?.id || "");
    if (!id || seen.has(id) || !!todo.completed) return;
    seen.add(id);
    candidates.push(todo);
  };
  [
    ...getDueSoonTodos(24),
    ...getStaleRiskTodos(24),
    ...getOpenTodos()
      .filter((todo) => todo.priority === "high" || isTodoUnsorted(todo))
      .slice(0, 24),
  ].forEach(push);
  return candidates.slice(0, 60);
}

export function getHomeTopFocusRequestKey(candidates) {
  return candidates
    .map((todo) => `${todo.id}:${todo.updatedAt || ""}`)
    .sort()
    .join("|");
}

export function readCachedHomeTopFocus() {
  return null;
}

export function writeCachedHomeTopFocus() {
  return null;
}

export function buildHomeAiTopFocusItems() {
  const todoById = new Map(
    getOpenTodos().map((todo) => [String(todo.id), todo]),
  );
  const selected = [];
  for (const suggestion of Array.isArray(state.homeAi?.suggestions)
    ? state.homeAi.suggestions
    : []) {
    const todo = todoById.get(String(suggestion.todoId || ""));
    if (!todo) continue;
    if (selected.some((item) => String(item.id) === String(todo.id))) continue;
    selected.push(todo);
    if (selected.length >= 3) break;
  }
  return selected;
}

export function applyHomeTopFocusResult() {
  return null;
}

export async function hydrateHomeTopFocusIfNeeded() {
  const candidates = buildHomeTopFocusCandidates();
  const requestKey = getHomeTopFocusRequestKey(candidates);
  if (!requestKey) {
    await loadHomeFocusSuggestions({ candidates: [], requestKey: "" });
    return;
  }
  await loadHomeFocusSuggestions({
    candidates: candidates.map((todo) => ({
      id: String(todo.id),
      title: String(todo.title || ""),
      dueAt: todo.dueDate || null,
      priority: normalizePriorityValue(todo.priority),
      projectId:
        typeof todo.projectId === "string" && todo.projectId.trim()
          ? todo.projectId.trim()
          : null,
      projectName: normalizeProjectPath(todo.category) || null,
      category: normalizeProjectPath(todo.category) || null,
      createdAt: todo.createdAt || null,
      updatedAt: todo.updatedAt || null,
      hasSubtasks: Array.isArray(todo.subtasks) && todo.subtasks.length > 0,
      notesPresent: !!String(todo.notes || "").trim(),
    })),
    requestKey,
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const HOME_BADGE_ICONS = {
  Overdue: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  Today: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/></svg>`,
  Tomorrow: `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
};

export function renderHomeTaskRow(todo, { reason = "" } = {}) {
  const aiSuggestion = getHomeAiSuggestionByTodoId(todo?.id);
  const isApplying =
    !!aiSuggestion &&
    state.homeAi?.applyingSuggestionId === aiSuggestion.suggestionId;
  const isDismissing =
    !!aiSuggestion &&
    state.homeAi?.dismissingSuggestionId === aiSuggestion.suggestionId;
  const dueBadge = formatHomeDueBadge(todo);
  const badgeIcon =
    HOME_BADGE_ICONS[dueBadge] ??
    (dueBadge
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`
      : "");
  return `
    <div class="home-task-row" data-home-todo-id="${escapeHtml(String(todo.id))}">
      <input
        type="checkbox"
        class="todo-checkbox home-task-row__checkbox"
        aria-label="Mark ${escapeHtml(String(todo.title || "task"))} complete"
        ${todo.completed ? "checked" : ""}
        data-onchange="toggleTodo('${todo.id}')"
      >
      <button
        type="button"
        class="home-task-row__title"
        data-onclick="openTodoFromHomeTile('${todo.id}')"
        title="${escapeHtml(String(todo.title || ""))}"
      >
        ${escapeHtml(String(todo.title || "Untitled task"))}
      </button>
      ${dueBadge ? `<span class="home-task-row__badge ${dueBadge === "Overdue" ? "home-task-row__badge--overdue" : ""}">${badgeIcon}${escapeHtml(dueBadge)}</span>` : ""}
      ${reason ? `<div class="home-task-row__reason">${escapeHtml(reason)}</div>` : ""}
      ${
        aiSuggestion
          ? `<div class="home-task-row__actions">
              <button
                type="button"
                class="mini-btn home-task-row__action"
                data-onclick="applyHomeFocusSuggestion('${escapeHtml(aiSuggestion.suggestionId)}')"
                ${isApplying || isDismissing ? "disabled" : ""}
              >
                ${isApplying ? "Opening…" : "Use focus"}
              </button>
              <button
                type="button"
                class="mini-btn home-task-row__action home-task-row__action--secondary"
                data-onclick="dismissHomeFocusSuggestion('${escapeHtml(aiSuggestion.suggestionId)}')"
                ${isApplying || isDismissing ? "disabled" : ""}
              >
                ${isDismissing ? "Dismissing…" : "Dismiss"}
              </button>
            </div>`
          : ""
      }
    </div>
  `;
}

function getHomeTopFocusHelperMessage() {
  if (state.homeAi?.status === "loading") {
    return "Refreshing focus…";
  }
  if (state.homeAi?.error) {
    return state.homeAi.error;
  }
  if (state.homeAi?.unavailable) {
    return "Using focus fallback.";
  }
  return "";
}

export function renderHomeTaskTile({
  key,
  title,
  subtitle = "",
  items = [],
  groupedItems = null,
  seeAllLabel = "See all",
  emptyText = "No tasks here.",
  showReasons = false,
  showSeeAll = true,
} = {}) {
  const bodyHtml =
    items.length > 0
      ? Array.isArray(groupedItems) && groupedItems.length > 0
        ? groupedItems
            .map(
              (group) => `
                <div class="home-task-group" data-home-task-group="${escapeHtml(group.key)}">
                  <div class="home-task-group__label">${escapeHtml(group.label)}</div>
                  <div class="home-task-group__items">
                    ${group.items
                      .map((todo) =>
                        renderHomeTaskRow(todo, {
                          reason: showReasons
                            ? getHomeTopFocusReason(todo)
                            : "",
                        }),
                      )
                      .join("")}
                  </div>
                </div>
              `,
            )
            .join("")
        : items
            .map((todo) =>
              renderHomeTaskRow(todo, {
                reason: showReasons ? getHomeTopFocusReason(todo) : "",
              }),
            )
            .join("")
      : `<div class="home-tile__empty">${escapeHtml(emptyText)}</div>`;
  const TILE_ICON_SVG = {
    top_focus: `<svg class="home-tile__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
    due_soon: `<svg class="home-tile__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 12"/></svg>`,
  };
  const tileIcon = TILE_ICON_SVG[key] ?? "";
  return `
    <section class="home-tile" data-home-tile="${escapeHtml(key)}">
      <div class="home-tile__header">
        <div class="home-tile__title-row">
          ${tileIcon}<h3 class="home-tile__title">${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="home-tile__subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        ${showSeeAll ? `<button type="button" class="mini-btn home-tile__see-all" data-onclick="openHomeTileList('${escapeHtml(key)}')">${escapeHtml(seeAllLabel)}</button>` : ""}
      </div>
      <div class="home-tile__body" ${key === "top_focus" ? 'id="homeTopFocusBody"' : ""}>
        ${bodyHtml}
        ${
          key === "top_focus" && getHomeTopFocusHelperMessage()
            ? `<div class="home-tile__helper" role="status">${escapeHtml(getHomeTopFocusHelperMessage())}</div>`
            : ""
        }
      </div>
    </section>
  `;
}

export function renderProjectsToNudgeTile(items = []) {
  const folderIcon = `<svg class="home-project-row__icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  return `
    <section class="home-tile" data-home-tile="projects_to_nudge">
      <div class="home-tile__header">
        <div class="home-tile__title-row">
          <svg class="home-tile__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <h3 class="home-tile__title">Projects to Nudge</h3>
        </div>
      </div>
      <div class="home-tile__body">
        ${
          items.length > 0
            ? items
                .map(
                  (project) => `
                  <button
                    type="button"
                    class="home-project-row"
                    data-onclick="openHomeProject('${escapeHtml(project.projectName)}')"
                  >
                    <span class="home-project-row__header">${folderIcon}<span class="home-project-row__name">${escapeHtml(getProjectLeafName(project.projectName))}</span></span>
                    <span class="home-project-row__meta">${project.openCount} open${project.overdueCount ? ` \u00b7 ${project.overdueCount} overdue` : ""}${project.dueSoonCount ? ` \u00b7 ${project.dueSoonCount} due soon` : ""}</span>
                  </button>
                `,
                )
                .join("")
            : '<div class="home-tile__empty">No project hotspots right now.</div>'
        }
      </div>
    </section>
  `;
}

export function renderHomeDashboard() {
  const aiTopFocusItems = buildHomeAiTopFocusItems();
  const fallbackTopFocus = getTopFocusFallbackTodos(3);
  const topFocusItems =
    aiTopFocusItems.length > 0 ? aiTopFocusItems : fallbackTopFocus;
  const model = getHomeDashboardModel({ topFocusItems });
  void hydrateHomeTopFocusIfNeeded();

  return `
    <section class="home-dashboard" data-testid="home-dashboard">
      <div class="home-dashboard__header">
        <h2 class="home-dashboard__title">Home</h2>
      </div>
      ${renderHomeTaskTile({
        key: "top_focus",
        title: "Focus",
        items: topFocusItems,
        emptyText: "Nothing urgent right now.",
        showReasons: true,
        showSeeAll: false,
      })}
      ${renderHomeTaskTile({
        key: "due_soon",
        title: "Up Next",
        items: model.dueSoon,
        groupedItems: model.dueSoonGroups,
        emptyText: "Nothing coming up.",
      })}
      ${renderProjectsToNudgeTile(model.projectsToNudge)}
    </section>
  `;
}

export function openHomeTileList(tileKey) {
  if (
    tileKey === "stale_risks" ||
    tileKey === "quick_wins" ||
    tileKey === "due_soon"
  ) {
    clearHomeListDrilldown();
    applyDomainAction("homeDrilldown:set", { tileKey });
    applyDomainAction("workspace/view:set", { view: "all" });
    setSelectedProjectKey("", { reason: "home-see-all", skipApply: true });
    setDateView("all", { skipApply: true });
    hooks.applyFiltersAndRender?.({ reason: `home-see-all-${tileKey}` });
  }
}

export function openHomeProject(projectName) {
  clearHomeListDrilldown();
  selectProjectFromRail(projectName);
}

export function openTodoFromHomeTile(todoId) {
  openTodoDrawer(String(todoId || ""), document.activeElement);
}

export function getHomeDrilldownLabel() {
  const labels = {
    due_soon: "Up Next",
    stale_risks: "Stale Risks",
    quick_wins: "Quick Wins",
  };
  return labels[state.homeListDrilldownKey] || "";
}

export function clearHomeFocusDashboard() {
  const dashboard = document.getElementById("homeFocusDashboard");
  if (!(dashboard instanceof HTMLElement)) return;
  dashboard.hidden = true;
  dashboard.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Home focus dashboard (legacy focus panel)
// ---------------------------------------------------------------------------

export function getTodoDueSummary(todo, now = new Date()) {
  if (!todo?.dueDate) {
    return {
      hasDueDate: false,
      isOverdue: false,
      daysLate: 0,
      isToday: false,
      isTomorrow: false,
      isNextThreeDays: false,
    };
  }

  const due = new Date(todo.dueDate);
  if (Number.isNaN(due.getTime())) {
    return {
      hasDueDate: false,
      isOverdue: false,
      daysLate: 0,
      isToday: false,
      isTomorrow: false,
      isNextThreeDays: false,
    };
  }

  const nowStart = startOfLocalDay(now);
  const dueStart = startOfLocalDay(due);
  const dayDiff = Math.floor(
    (dueStart.getTime() - nowStart.getTime()) / 86400000,
  );
  const daysLate = Math.max(0, -dayDiff);

  return {
    hasDueDate: true,
    dueDate: due,
    isOverdue: dayDiff < 0,
    daysLate,
    isToday: dayDiff === 0,
    isTomorrow: dayDiff === 1,
    isNextThreeDays: dayDiff >= 2 && dayDiff <= 4,
  };
}

export function formatDashboardDueChip(todo, dueSummary) {
  if (!dueSummary.hasDueDate) return "";
  if (dueSummary.isOverdue) {
    return dueSummary.daysLate > 0 ? `${dueSummary.daysLate}d late` : "Late";
  }
  return dueSummary.dueDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function getDashboardReasonLine(todo, dueSummary) {
  if (dueSummary.isOverdue) return "Overdue";
  if (dueSummary.isToday) return "Due today";
  if (dueSummary.isTomorrow) return "Due tomorrow";
  if (dueSummary.isNextThreeDays) return "Due in the next 3 days";
  if (todo.priority === "high") return "High priority";
  if (todo.category) return `Project: ${todo.category}`;
  return "No due date";
}

export function getTodoRecencyDays(todo, now = new Date()) {
  const raw = todo?.updatedAt || todo?.createdAt || null;
  if (!raw) return 0;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

export function renderTopFocusRow(
  todo,
  reason,
  dueChipLabel,
  showFallbackOverduePill,
) {
  return `
    <li class="home-focus-row" data-testid="top-focus-row">
      <div class="home-focus-row__main">
        <div class="home-focus-row__title">${escapeHtml(String(todo.title || "Untitled task"))}</div>
        <div class="home-focus-row__reason" data-testid="top-focus-reason">${escapeHtml(reason)}</div>
      </div>
      ${
        dueChipLabel
          ? `<span class="home-focus-due-chip${dueChipLabel.includes("late") ? " home-focus-due-chip--overdue" : ""}" data-testid="top-focus-due-chip">${escapeHtml(dueChipLabel)}</span>`
          : showFallbackOverduePill
            ? '<span class="todo-chip todo-chip--due-overdue" data-testid="top-focus-overdue-pill">Overdue</span>'
            : ""
      }
    </li>
  `;
}

export function renderHomeFocusDashboard(visibleTodos) {
  const dashboard = document.getElementById("homeFocusDashboard");
  if (!(dashboard instanceof HTMLElement)) return;

  const activeTodos = visibleTodos.filter((todo) => !todo.completed);
  if (activeTodos.length === 0) {
    dashboard.hidden = true;
    dashboard.innerHTML = "";
    return;
  }

  const now = new Date();
  const usedTodoIds = new Set();
  const dueSummaryById = new Map(
    activeTodos.map((todo) => [String(todo.id), getTodoDueSummary(todo, now)]),
  );

  const topFocus = [...activeTodos]
    .sort((a, b) => {
      const dueA = dueSummaryById.get(String(a.id));
      const dueB = dueSummaryById.get(String(b.id));
      const overdueA = dueA?.isOverdue ? 1 : 0;
      const overdueB = dueB?.isOverdue ? 1 : 0;
      if (overdueA !== overdueB) return overdueB - overdueA;
      const dueTimeA = dueA?.hasDueDate
        ? dueA.dueDate.getTime()
        : Number.MAX_SAFE_INTEGER;
      const dueTimeB = dueB?.hasDueDate
        ? dueB.dueDate.getTime()
        : Number.MAX_SAFE_INTEGER;
      if (dueTimeA !== dueTimeB) return dueTimeA - dueTimeB;
      const priA = a.priority === "high" ? 0 : a.priority === "medium" ? 1 : 2;
      const priB = b.priority === "high" ? 0 : b.priority === "medium" ? 1 : 2;
      if (priA !== priB) return priA - priB;
      return String(a.title || "").localeCompare(String(b.title || ""));
    })
    .slice(0, 3);

  const topFocusRows = topFocus
    .map((todo) => {
      usedTodoIds.add(String(todo.id));
      const dueSummary =
        dueSummaryById.get(String(todo.id)) || getTodoDueSummary(todo, now);
      const reason = getDashboardReasonLine(todo, dueSummary);
      const dueChipLabel = formatDashboardDueChip(todo, dueSummary);
      const showFallbackOverduePill = !dueSummary.hasDueDate && !reason;
      return renderTopFocusRow(
        todo,
        reason,
        dueChipLabel,
        showFallbackOverduePill,
      );
    })
    .join("");

  const dueSoonCandidates = activeTodos.filter((todo) => {
    if (usedTodoIds.has(String(todo.id))) return false;
    const dueSummary = dueSummaryById.get(String(todo.id));
    return !!dueSummary?.hasDueDate;
  });

  const dueGroups = {
    overdue: [],
    today: [],
    tomorrow: [],
    next3Days: [],
  };

  dueSoonCandidates.forEach((todo) => {
    const dueSummary = dueSummaryById.get(String(todo.id));
    if (!dueSummary) return;
    if (dueSummary.isOverdue) {
      dueGroups.overdue.push(todo);
      usedTodoIds.add(String(todo.id));
      return;
    }
    if (dueSummary.isToday) {
      dueGroups.today.push(todo);
      usedTodoIds.add(String(todo.id));
      return;
    }
    if (dueSummary.isTomorrow) {
      dueGroups.tomorrow.push(todo);
      usedTodoIds.add(String(todo.id));
      return;
    }
    if (dueSummary.isNextThreeDays) {
      dueGroups.next3Days.push(todo);
      usedTodoIds.add(String(todo.id));
    }
  });

  const renderDueGroup = (label, todosInGroup) => {
    if (!todosInGroup.length) return "";
    return `
      <div class="home-focus-group">
        <div class="home-focus-group__label" data-testid="due-soon-group-label">${label}</div>
        <ul class="home-focus-list">
          ${todosInGroup
            .slice(0, 3)
            .map((todo) => {
              const dueSummary =
                dueSummaryById.get(String(todo.id)) ||
                getTodoDueSummary(todo, now);
              const dueChip = formatDashboardDueChip(todo, dueSummary);
              return `
                <li class="home-focus-row">
                  <div class="home-focus-row__main">
                    <div class="home-focus-row__title">${escapeHtml(String(todo.title || "Untitled task"))}</div>
                    <div class="home-focus-row__reason">${escapeHtml(getDashboardReasonLine(todo, dueSummary))}</div>
                  </div>
                  <span class="home-focus-due-chip${dueSummary.isOverdue ? " home-focus-due-chip--overdue" : ""}">
                    ${escapeHtml(dueChip)}
                  </span>
                </li>
              `;
            })
            .join("")}
        </ul>
      </div>
    `;
  };

  const staleRisks = activeTodos
    .filter((todo) => !usedTodoIds.has(String(todo.id)))
    .map((todo) => ({
      todo,
      staleDays: getTodoRecencyDays(todo, now),
      dueSummary:
        dueSummaryById.get(String(todo.id)) || getTodoDueSummary(todo, now),
    }))
    .filter((entry) => entry.staleDays >= 7 || !entry.dueSummary.hasDueDate)
    .sort((a, b) => b.staleDays - a.staleDays)
    .slice(0, 3);

  staleRisks.forEach((entry) => usedTodoIds.add(String(entry.todo.id)));

  const staleMarkup = staleRisks.length
    ? `
      <ul class="home-focus-list">
        ${staleRisks
          .map(
            ({ todo, staleDays }) => `
              <li class="home-focus-row">
                <div class="home-focus-row__main">
                  <div class="home-focus-row__title">${escapeHtml(String(todo.title || "Untitled task"))}</div>
                  <div class="home-focus-row__reason">${escapeHtml(`Last touched ${staleDays}d ago`)}</div>
                </div>
              </li>
            `,
          )
          .join("")}
      </ul>
    `
    : '<div class="home-focus-empty">No stale risks \u2014 nice.</div>';

  const projectStats = new Map();
  activeTodos
    .filter((todo) => !usedTodoIds.has(String(todo.id)))
    .forEach((todo) => {
      const project = String(todo.category || "Uncategorized");
      const dueSummary =
        dueSummaryById.get(String(todo.id)) || getTodoDueSummary(todo, now);
      const record = projectStats.get(project) || {
        project,
        dueSoon: 0,
        overdue: 0,
        maxStaleDays: 0,
      };
      if (dueSummary.isOverdue) {
        record.overdue += 1;
      } else if (
        dueSummary.isToday ||
        dueSummary.isTomorrow ||
        dueSummary.isNextThreeDays
      ) {
        record.dueSoon += 1;
      }
      record.maxStaleDays = Math.max(
        record.maxStaleDays,
        getTodoRecencyDays(todo, now),
      );
      projectStats.set(project, record);
    });

  const projectsToNudge = Array.from(projectStats.values())
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return b.overdue - a.overdue;
      if (a.dueSoon !== b.dueSoon) return b.dueSoon - a.dueSoon;
      if (a.maxStaleDays !== b.maxStaleDays)
        return b.maxStaleDays - a.maxStaleDays;
      return a.project.localeCompare(b.project);
    })
    .slice(0, 4);

  const projectsMarkup = projectsToNudge.length
    ? `
      <ul class="home-focus-list">
        ${projectsToNudge
          .map((entry) => {
            const whyParts = [];
            if (entry.dueSoon > 0) whyParts.push(`${entry.dueSoon} due soon`);
            if (entry.overdue > 0) whyParts.push(`${entry.overdue} overdue`);
            const why = whyParts.length
              ? whyParts.join(" \u2022 ")
              : `Last touched ${entry.maxStaleDays}d ago`;
            return `
              <li class="home-focus-row">
                <div class="home-focus-row__main">
                  <div class="home-focus-row__title">${escapeHtml(entry.project)}</div>
                  <div class="home-focus-row__reason">${escapeHtml(why)}</div>
                </div>
              </li>
            `;
          })
          .join("")}
      </ul>
    `
    : '<div class="home-focus-empty">No projects need nudging.</div>';

  dashboard.hidden = false;
  dashboard.innerHTML = `
    <div class="home-focus-grid">
      <section class="home-focus-card">
        <h3>Top Focus</h3>
        <ul class="home-focus-list">${topFocusRows}</ul>
      </section>
      <section class="home-focus-card" data-testid="due-soon-card">
        <h3>Due Soon</h3>
        ${renderDueGroup("OVERDUE", dueGroups.overdue)}
        ${renderDueGroup("TODAY", dueGroups.today)}
        ${renderDueGroup("TOMORROW", dueGroups.tomorrow)}
        ${renderDueGroup("NEXT 3 DAYS", dueGroups.next3Days)}
      </section>
      <section class="home-focus-card">
        <h3>Stale Risks</h3>
        ${staleMarkup}
      </section>
      <section class="home-focus-card">
        <h3>Projects to Nudge</h3>
        ${projectsMarkup}
      </section>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Local helper (not exported — used only within this module)
// ---------------------------------------------------------------------------

function normalizePriorityValue(priority) {
  const value = String(priority || "").toLowerCase();
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium";
}
