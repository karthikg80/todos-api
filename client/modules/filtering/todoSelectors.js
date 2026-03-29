// =============================================================================
// todoSelectors.js — Pure predicates and selectors on todo objects.
// Only reads state; contains no DOM access and no side effects.
// =============================================================================
import { state } from "../store.js";

export function isTodoUnsorted(todo) {
  const hasCategory = !!(todo.category && String(todo.category).trim());
  const hasProjectId = !!(todo.projectId && String(todo.projectId).trim());
  return !hasCategory && !hasProjectId;
}

export function isTodoNeedsOrganizing(todo) {
  if (!todo || todo.completed) return false;
  return (
    String(todo.status || "").toLowerCase() === "inbox" || isTodoUnsorted(todo)
  );
}

export function isTodoNeedingTriage(todo) {
  return isTodoNeedsOrganizing(todo);
}

export function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function matchesDateView(todo) {
  if (state.currentDateView === "all") return true;
  if (state.currentDateView === "completed") return !!todo.completed;
  if (state.currentDateView === "waiting")
    return (
      !todo.completed && String(todo.status || "").toLowerCase() === "waiting"
    );
  if (state.currentDateView === "scheduled")
    return !todo.completed && !!todo.scheduledDate;

  const dueDate = todo.dueDate ? new Date(todo.dueDate) : null;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  if (state.currentDateView === "someday") return !dueDate;
  if (!dueDate) return false;
  if (state.currentDateView === "today")
    return !todo.completed && dueDate <= todayEnd;
  if (state.currentDateView === "upcoming") {
    const upcomingEnd = new Date(todayEnd.getTime() + 14 * 24 * 60 * 60 * 1000);
    return dueDate > todayEnd && dueDate <= upcomingEnd;
  }
  if (state.currentDateView === "next_month") {
    const nextMonth = (now.getMonth() + 1) % 12;
    const nextMonthYear =
      now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    return (
      dueDate.getFullYear() === nextMonthYear &&
      dueDate.getMonth() === nextMonth
    );
  }
  return dueDate >= todayStart;
}

export function getOpenTodos() {
  return state.todos.filter((todo) => !todo.completed);
}

export function getUniqueTagsWithCounts() {
  const counts = new Map();
  state.todos.forEach((todo) => {
    if (!Array.isArray(todo.tags)) return;
    todo.tags.forEach((t) => {
      const tag = String(t).trim();
      if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  return counts;
}

export function getVisibleTodosCount(visibleTodos = []) {
  return Array.isArray(visibleTodos) ? visibleTodos.length : 0;
}
