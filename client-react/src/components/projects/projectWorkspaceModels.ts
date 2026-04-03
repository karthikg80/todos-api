import type { Heading, Todo } from "../../types";

export interface SectionGroup {
  key: string;
  heading: Heading | null;
  label: string;
  todos: Todo[];
}

export function startOfToday(now = new Date()) {
  return new Date(now.toDateString());
}

export function formatProjectDate(date: string | null | undefined) {
  if (!date) return null;
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(todo: Todo, now = new Date()) {
  if (!todo.dueDate || todo.completed) return false;
  return new Date(todo.dueDate) < startOfToday(now);
}

export function daysUntil(date: string | null | undefined, now = new Date()) {
  if (!date) return null;
  const due = new Date(date);
  const today = startOfToday(now);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildSectionGroups(
  projectTodos: Todo[],
  headings: Heading[],
): SectionGroup[] {
  const groups: SectionGroup[] = [];
  const byHeading = new Map<string, Todo[]>();

  for (const todo of projectTodos) {
    const key = todo.headingId ?? "__unplaced__";
    const list = byHeading.get(key) ?? [];
    list.push(todo);
    byHeading.set(key, list);
  }

  for (const heading of headings) {
    groups.push({
      key: heading.id,
      heading,
      label: heading.name,
      todos: byHeading.get(heading.id) ?? [],
    });
  }

  const unplaced = byHeading.get("__unplaced__") ?? [];
  if (unplaced.length > 0 || groups.length === 0) {
    groups.unshift({
      key: "__unplaced__",
      heading: null,
      label: "Unplaced work",
      todos: unplaced,
    });
  }

  return groups;
}

export function pickTopTasks(projectTodos: Todo[], now = new Date()) {
  const priorityRank: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...projectTodos]
    .filter((todo) => !todo.completed)
    .sort((a, b) => {
      const overdueDelta = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
      if (overdueDelta !== 0) return overdueDelta;

      const statusRank = (todo: Todo) =>
        todo.status === "in_progress" ? 0 : todo.status === "next" ? 1 : 2;
      const statusDelta = statusRank(a) - statusRank(b);
      if (statusDelta !== 0) return statusDelta;

      const priorityDelta =
        (priorityRank[a.priority ?? "low"] ?? 3) -
        (priorityRank[b.priority ?? "low"] ?? 3);
      if (priorityDelta !== 0) return priorityDelta;

      const aDays = daysUntil(a.dueDate, now) ?? 9999;
      const bDays = daysUntil(b.dueDate, now) ?? 9999;
      return aDays - bDays;
    })
    .slice(0, 4);
}
