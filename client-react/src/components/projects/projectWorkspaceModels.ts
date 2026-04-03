import type { Heading, Todo } from "../../types";

export interface SectionGroup {
  key: string;
  heading: Heading | null;
  label: string;
  todos: Todo[];
}

export type ProjectOverviewMode = "simple" | "guided" | "rich";

export interface ProjectOverviewProfile {
  mode: ProjectOverviewMode;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  headingsCount: number;
  sectionsWithTasks: number;
  datedTasks: number;
  priorityTasks: number;
  overdueTasks: number;
  waitingTasks: number;
  unplacedTasks: number;
  recentActivityCount: number;
  showStarter: boolean;
  showSectionsPreview: boolean;
  showInsights: boolean;
  showRiskInsights: boolean;
  showRecentInsights: boolean;
  showUnplacedInsights: boolean;
  primaryContent: "tasks" | "sections";
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

function daysSince(date: string | null | undefined, now = new Date()) {
  if (!date) return null;
  const then = new Date(date);
  const today = startOfToday(now);
  return Math.floor((today.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
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

export function classifyProjectOverview(
  projectTodos: Todo[],
  headings: Heading[],
  now = new Date(),
): ProjectOverviewProfile {
  const totalTasks = projectTodos.length;
  const openTasks = projectTodos.filter((todo) => !todo.completed).length;
  const completedTasks = totalTasks - openTasks;
  const headingsCount = headings.length;
  const sectionsWithTasks = headings.filter((heading) =>
    projectTodos.some((todo) => todo.headingId === heading.id),
  ).length;
  const datedTasks = projectTodos.filter(
    (todo) => todo.dueDate || todo.startDate || todo.scheduledDate,
  ).length;
  const priorityTasks = projectTodos.filter((todo) => !!todo.priority).length;
  const overdueTasks = projectTodos.filter((todo) => isOverdue(todo, now)).length;
  const waitingTasks = projectTodos.filter(
    (todo) => !todo.completed && (todo.status === "waiting" || !!todo.waitingOn),
  ).length;
  const unplacedTasks = projectTodos.filter(
    (todo) => !todo.completed && !todo.headingId,
  ).length;
  const recentActivityCount = projectTodos.filter((todo) => {
    const age = daysSince(todo.updatedAt, now);
    return age != null && age <= 7;
  }).length;

  const isSimple =
    totalTasks <= 5 &&
    headingsCount <= 1 &&
    datedTasks <= 1 &&
    priorityTasks <= 1 &&
    completedTasks <= 1;
  const isRich =
    totalTasks >= 12 ||
    headingsCount >= 3 ||
    sectionsWithTasks >= 3 ||
    datedTasks >= 4 ||
    completedTasks >= 4 ||
    (recentActivityCount >= 8 && totalTasks >= 8);

  const mode: ProjectOverviewMode = isSimple ? "simple" : isRich ? "rich" : "guided";
  const showStarter = totalTasks === 0 || (mode === "simple" && totalTasks <= 2);
  const showSectionsPreview =
    sectionsWithTasks >= 2 || (mode !== "simple" && headingsCount >= 2);
  const showRiskInsights = overdueTasks > 0 || waitingTasks > 1;
  const showUnplacedInsights = unplacedTasks > 1 && showSectionsPreview;
  const showRecentInsights = mode === "rich" && recentActivityCount >= 3;

  return {
    mode,
    totalTasks,
    openTasks,
    completedTasks,
    headingsCount,
    sectionsWithTasks,
    datedTasks,
    priorityTasks,
    overdueTasks,
    waitingTasks,
    unplacedTasks,
    recentActivityCount,
    showStarter,
    showSectionsPreview,
    showInsights: showRiskInsights || showUnplacedInsights || showRecentInsights,
    showRiskInsights,
    showRecentInsights,
    showUnplacedInsights,
    primaryContent: showSectionsPreview ? "sections" : "tasks",
  };
}
