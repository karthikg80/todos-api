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
import {
  renderPrioritiesTileShell,
  loadPrioritiesBrief,
} from "./homePrioritiesTile.js";
import { loadHomeFocusSuggestions } from "./homeAiService.js";
import {
  getDayPlanState,
  generateDayPlan,
  planTodayTaskIds,
} from "./planTodayAgent.js";
import {
  isOnboardingActive,
  onboardingStep,
  maybeRenderOnboardingModal,
} from "./onboardingFlow.js";

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

export function getWaitingTodos(limit = 6) {
  return getOpenTodos()
    .filter((todo) => String(todo.status || "").toLowerCase() === "waiting")
    .sort((a, b) => {
      const aTime = Date.parse(String(a.updatedAt || a.createdAt || "")) || 0;
      const bTime = Date.parse(String(b.updatedAt || b.createdAt || "")) || 0;
      return aTime - bTime; // longest waiting first
    })
    .slice(0, limit);
}

export function getScheduledTodos(limit = 6) {
  return getOpenTodos()
    .filter((todo) => {
      if (!todo.scheduledDate) return false;
      const sd = new Date(todo.scheduledDate);
      return !Number.isNaN(sd.getTime());
    })
    .sort((a, b) => {
      const aTime = new Date(a.scheduledDate).getTime();
      const bTime = new Date(b.scheduledDate).getTime();
      return aTime - bTime;
    })
    .slice(0, limit);
}

export function getNextActionTodos(limit = 6) {
  return getOpenTodos()
    .filter((todo) => String(todo.status || "").toLowerCase() === "next")
    .sort((a, b) => {
      const aPriority =
        a.priority === "urgent"
          ? 0
          : a.priority === "high"
            ? 1
            : a.priority === "medium"
              ? 2
              : 3;
      const bPriority =
        b.priority === "urgent"
          ? 0
          : b.priority === "high"
            ? 1
            : b.priority === "medium"
              ? 2
              : 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return String(a.title || "").localeCompare(String(b.title || ""));
    })
    .slice(0, limit);
}

function isProjectReviewOverdue(projectRecord) {
  if (!projectRecord?.reviewCadence || !projectRecord?.lastReviewedAt)
    return false;
  const lastReviewed = new Date(projectRecord.lastReviewedAt);
  if (Number.isNaN(lastReviewed.getTime())) return false;
  const cadenceDays = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 90,
  };
  const days = cadenceDays[projectRecord.reviewCadence];
  if (!days) return false;
  const daysSinceReview = (Date.now() - lastReviewed.getTime()) / 86400000;
  return daysSinceReview > days;
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
      reviewOverdue: false,
    };
    entry.openCount += 1;
    if (dueSoonSet.has(String(todo.id))) entry.dueSoonCount += 1;
    const dueDate = getTodoDueDate(todo);
    if (dueDate && dueDate < new Date()) entry.overdueCount += 1;
    byProject.set(project, entry);
  }

  // Surface review-overdue projects from state.projectRecords
  for (const record of Array.isArray(state.projectRecords)
    ? state.projectRecords
    : []) {
    if (!isProjectReviewOverdue(record)) continue;
    const project = normalizeProjectPath(record.name);
    if (!project) continue;
    const entry = byProject.get(project) || {
      projectName: project,
      openCount: 0,
      dueSoonCount: 0,
      overdueCount: 0,
      reviewOverdue: false,
    };
    entry.reviewOverdue = true;
    byProject.set(project, entry);
  }

  return Array.from(byProject.values())
    .sort((a, b) => {
      const scoreA =
        a.openCount +
        a.dueSoonCount * 2 +
        a.overdueCount * 3 +
        (a.reviewOverdue ? 2 : 0);
      const scoreB =
        b.openCount +
        b.dueSoonCount * 2 +
        b.overdueCount * 3 +
        (b.reviewOverdue ? 2 : 0);
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
  createHomeTodoIdSet(topFocusItems);
  const allDueSoon = getDueSoonTodos(24);

  const now = new Date();
  const todayStart = getStartOfToday(now);
  const dueSoonFuture = allDueSoon.filter((todo) => {
    const dueDate = getTodoDueDate(todo);
    return dueDate && dueDate >= todayStart && !isSameLocalDay(dueDate, now);
  });

  const usedDueSoonIds = createHomeTodoIdSet(allDueSoon);
  const waitingTodos = takeExclusiveTodos(
    getWaitingTodos(12),
    6,
    new Set(usedDueSoonIds),
  );
  const scheduledTodos = takeExclusiveTodos(
    getScheduledTodos(12),
    6,
    new Set(usedDueSoonIds),
  );
  const nextActionTodos = takeExclusiveTodos(
    getNextActionTodos(12),
    6,
    new Set(usedDueSoonIds),
  );

  return {
    dueSoon: allDueSoon,
    dueSoonGroups: buildHomeDueSoonGroups(allDueSoon),
    dueSoonFuture,
    waitingTodos,
    scheduledTodos,
    nextActionTodos,
  };
}

export function buildHomeTileListByKey(key) {
  const model = getHomeDashboardModel();
  if (key === "due_soon") return model.dueSoon;
  if (key === "stale_risks") return getStaleRiskTodos(6);
  if (key === "quick_wins") return getQuickWinTodos(6);
  if (key === "waiting") return model.waitingTodos;
  if (key === "scheduled") return model.scheduledTodos;
  if (key === "next_actions") return model.nextActionTodos;
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
      status: todo.status || "inbox",
      context: todo.context || null,
      energy: todo.energy || null,
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
                    <span class="home-project-row__meta">${project.openCount} open${project.overdueCount ? ` · ${project.overdueCount} overdue` : ""}${project.dueSoonCount ? ` · ${project.dueSoonCount} due soon` : ""}</span>
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

let _planLoadedForToday = false;
let _planLoadingInFlight = false;
let _upcomingTab = "due";

function getUpcomingDueItems(model) {
  return takeExclusiveTodos(
    [...model.dueSoonFuture, ...model.nextActionTodos],
    6,
    new Set(),
  );
}

function getUpcomingTabItems(model, tab = _upcomingTab) {
  const plannedTaskIds = new Set(planTodayTaskIds.map(String));
  let items = [];

  if (tab === "due") {
    items = getUpcomingDueItems(model);
  } else if (tab === "scheduled") {
    items = model.scheduledTodos;
  } else if (tab === "waiting") {
    items = model.waitingTodos;
  }

  return items.filter((todo) => !plannedTaskIds.has(String(todo?.id || "")));
}

export async function hydrateTodaysPlanIfNeeded() {
  if (_planLoadedForToday || _planLoadingInFlight) return;
  const pd = getDayPlanState();
  if (pd.tasks.length > 0 || pd.loading) return;

  _planLoadingInFlight = true;
  try {
    await generateDayPlan();
    _planLoadedForToday = true;
  } finally {
    _planLoadingInFlight = false;
  }

  hooks.applyFiltersAndRender?.({ reason: "plan-today-loaded" });
}

export function renderTodaysPlanZone() {
  const pd = getDayPlanState();
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const bodyHtml = pd.loading
    ? `<div class="home-tile__empty" aria-live="polite">Building today's plan…</div>`
    : pd.error
      ? `<div class="home-tile__empty home-tile__empty--error">
           Could not load plan.
           <button type="button" class="mini-btn"
                   data-onclick="retryTodaysPlan()">Retry</button>
         </div>`
      : pd.tasks.length === 0
        ? `<div class="home-tile__empty">No plan yet — add tasks with due dates to get started.</div>`
        : pd.tasks
            .map((task) => {
              const taskId = escapeHtml(String(task.taskId || ""));
              const minsLabel =
                task.estimatedMinutes > 0 ? `${task.estimatedMinutes}m` : "";
              return `
                <div class="home-task-row" data-home-todo-id="${taskId}">
                  <input type="checkbox"
                         class="todo-checkbox home-task-row__checkbox"
                         aria-label="Mark ${escapeHtml(String(task.title || "task"))} complete"
                         data-onchange="toggleTodo('${taskId}')">
                  <button type="button"
                          class="home-task-row__title"
                          data-onclick="openTodoFromHomeTile('${taskId}')">
                    ${escapeHtml(String(task.title || "Untitled task"))}
                  </button>
                  ${minsLabel ? `<span class="home-task-row__badge">${escapeHtml(minsLabel)}</span>` : ""}
                  ${task.reason ? `<div class="home-task-row__reason">${escapeHtml(String(task.reason))}</div>` : ""}
                </div>`;
            })
            .join("");

  return `
    <section class="home-tile home-tile--plan" data-home-tile="todays_plan"
             id="homeTodaysPlan">
      <div class="home-tile__header">
        <div class="home-tile__title-row">
          <svg class="home-tile__icon" xmlns="http://www.w3.org/2000/svg"
               width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
            <line x1="16" x2="16" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
            <path d="M8 14h.01"/><path d="M12 14h.01"/>
          </svg>
          <h3 class="home-tile__title">Today's plan</h3>
        </div>
        <span class="home-tile__date-label">${escapeHtml(todayLabel)}</span>
      </div>
      <div class="home-tile__body" id="homeTodaysPlanBody">
        ${bodyHtml}
      </div>
    </section>`;
}

export function retryTodaysPlan() {
  _planLoadedForToday = false;
  _planLoadingInFlight = false;
  void hydrateTodaysPlanIfNeeded();
}

function _renderUpcomingTabBody() {
  const model = getHomeDashboardModel();
  const items = getUpcomingTabItems(model);
  let emptyText = "";

  if (_upcomingTab === "due") {
    emptyText = "Nothing due soon or marked next.";
  } else if (_upcomingTab === "scheduled") {
    emptyText = "Nothing scheduled.";
  } else {
    emptyText = "Nothing waiting.";
  }

  if (items.length === 0) {
    return `<div class="home-tile__empty">${escapeHtml(emptyText)}</div>`;
  }

  return items.map((todo) => renderHomeTaskRow(todo, { reason: "" })).join("");
}

export function setUpcomingTab(tab) {
  if (tab === "due" || tab === "scheduled" || tab === "waiting") {
    _upcomingTab = tab;
  }
  const body = document.getElementById("upcomingZoneBody");
  if (!body) return;
  body.innerHTML = _renderUpcomingTabBody();
  body.parentElement?.querySelectorAll(".home-upcoming-tab").forEach((btn) => {
    btn.classList.toggle(
      "home-upcoming-tab--active",
      btn.getAttribute("data-tab") === _upcomingTab,
    );
  });
}

export function renderUpcomingZone() {
  const model = getHomeDashboardModel();
  const dueItems = getUpcomingTabItems(model, "due");
  const scheduledItems = getUpcomingTabItems(model, "scheduled");
  const waitingItems = getUpcomingTabItems(model, "waiting");
  const hasDue = dueItems.length > 0;
  const hasScheduled = scheduledItems.length > 0;
  const hasWaiting = waitingItems.length > 0;
  const hasNext = model.nextActionTodos.length > 0;

  if (!hasDue && !hasScheduled && !hasWaiting && !hasNext) return "";

  const tabs = [
    { key: "due", label: `Due soon${hasDue ? ` (${dueItems.length})` : ""}` },
    {
      key: "scheduled",
      label: `Scheduled${hasScheduled ? ` (${scheduledItems.length})` : ""}`,
    },
    {
      key: "waiting",
      label: `Waiting${hasWaiting ? ` (${waitingItems.length})` : ""}`,
    },
  ].filter(
    (tab) =>
      (tab.key === "due" && hasDue) ||
      (tab.key === "scheduled" && hasScheduled) ||
      (tab.key === "waiting" && hasWaiting),
  );

  if (!tabs.find((tab) => tab.key === _upcomingTab)) {
    _upcomingTab = tabs[0]?.key ?? "due";
  }

  const tabsHtml = tabs
    .map(
      (tab) => `
        <button type="button"
                class="home-upcoming-tab${_upcomingTab === tab.key ? " home-upcoming-tab--active" : ""}"
                data-tab="${escapeHtml(tab.key)}"
                data-onclick="setUpcomingTab('${escapeHtml(tab.key)}')">
          ${escapeHtml(tab.label)}
        </button>`,
    )
    .join("");

  return `
    <section class="home-tile home-tile--upcoming" data-home-tile="upcoming">
      <div class="home-tile__header">
        <div class="home-tile__title-row">
          <h3 class="home-tile__title">Upcoming</h3>
        </div>
        <div class="home-upcoming-tabs">${tabsHtml}</div>
      </div>
      <div class="home-tile__body" id="upcomingZoneBody">
        ${_renderUpcomingTabBody()}
      </div>
    </section>`;
}

export function renderHomeDashboard() {
  // Show onboarding modal (steps 1 & 4) as a side effect of rendering the home
  // view — guarantees the overlay only appears when home workspace is active.
  maybeRenderOnboardingModal();

  // During inline onboarding steps (2 = add tasks, 3 = set due dates), suppress
  // the normal dashboard tiles so the onboarding banner has visual focus.
  if (isOnboardingActive() && (onboardingStep === 2 || onboardingStep === 3)) {
    return `<section class="home-dashboard" data-testid="home-dashboard"></section>`;
  }

  void hydrateHomeTopFocusIfNeeded();
  void hydrateTodaysPlanIfNeeded();
  void loadPrioritiesBrief();

  return `
    <section class="home-dashboard" data-testid="home-dashboard">
      ${renderPrioritiesTileShell()}
      <div class="home-dashboard__header">
        <h2 class="home-dashboard__title">Home</h2>
      </div>
      ${renderTodaysPlanZone()}
      ${renderUpcomingZone()}
    </section>`;
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
