import type { Todo, TodoStatus, Priority } from "../types";

export type GroupBy = "none" | "project" | "status" | "priority" | "dueDate";

export interface GroupedSection {
  key: string;
  label: string;
  todos: Todo[];
}

// "done" and "cancelled" are intentionally excluded: the Everything view
// filters them out upstream before grouping. If they slip through anyway,
// groupByOrdered's fallback path (buckets.set on first encounter) will
// append them after the ordered sections rather than dropping them.
const STATUS_ORDER: TodoStatus[] = [
  "next",
  "in_progress",
  "waiting",
  "scheduled",
  "someday",
  "inbox",
];

const STATUS_LABELS: Record<string, string> = {
  next: "Next",
  in_progress: "In Progress",
  waiting: "Waiting",
  scheduled: "Scheduled",
  someday: "Someday",
  inbox: "Inbox",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_ORDER: (Priority | "none")[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No Priority",
};

type DueDateBucket =
  | "overdue"
  | "today"
  | "this-week"
  | "next-week"
  | "later"
  | "no-date";

const DUE_DATE_ORDER: DueDateBucket[] = [
  "overdue",
  "today",
  "this-week",
  "next-week",
  "later",
  "no-date",
];

const DUE_DATE_LABELS: Record<DueDateBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  "this-week": "This Week",
  "next-week": "Next Week",
  later: "Later",
  "no-date": "No Date",
};

function startOfToday(now?: Date): Date {
  const d = now ? new Date(now) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday of the current ISO week (Mon=1). */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const monday = startOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function getDueDateBucket(
  dueDate: string | null | undefined,
  now?: Date,
): DueDateBucket {
  if (!dueDate) return "no-date";
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = startOfToday(now);
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  const weekEnd = endOfWeek(today);
  if (due <= weekEnd) return "this-week";
  const nextWeekEnd = new Date(weekEnd);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  if (due <= nextWeekEnd) return "next-week";
  return "later";
}

// Groups todos by project using insertion order (first-seen project key
// determines position in the output array).
function groupByProject(todos: Todo[]): GroupedSection[] {
  const map = new Map<string, { label: string; todos: Todo[] }>();
  for (const todo of todos) {
    const key = todo.projectId ?? todo.category ?? "__none__";
    const label = todo.category ?? "No Project";
    if (!map.has(key)) map.set(key, { label, todos: [] });
    map.get(key)!.todos.push(todo);
  }
  return Array.from(map.entries()).map(([key, val]) => ({
    key,
    label: val.label,
    todos: val.todos,
  }));
}

function groupByOrdered<T extends string>(
  todos: Todo[],
  order: T[],
  labels: Record<string, string>,
  getKey: (t: Todo) => T,
): GroupedSection[] {
  const buckets = new Map<T, Todo[]>();
  for (const k of order) buckets.set(k, []);
  for (const todo of todos) {
    const k = getKey(todo);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(todo);
  }
  return Array.from(buckets.entries())
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({
      key,
      label: labels[key] ?? key,
      todos: list,
    }));
}

export function groupTodos(
  todos: Todo[],
  groupBy: GroupBy,
  now?: Date,
): GroupedSection[] {
  switch (groupBy) {
    case "none":
      return [{ key: "__all__", label: "", todos }];
    case "project":
      return groupByProject(todos);
    case "status":
      return groupByOrdered(
        todos,
        STATUS_ORDER,
        STATUS_LABELS,
        (t) => t.status,
      );
    case "priority":
      return groupByOrdered(
        todos,
        PRIORITY_ORDER,
        PRIORITY_LABELS,
        (t) => (t.priority ?? "none") as Priority | "none",
      );
    case "dueDate":
      return groupByOrdered(
        todos,
        DUE_DATE_ORDER,
        DUE_DATE_LABELS,
        (t) => getDueDateBucket(t.dueDate, now),
      );
  }
}
