import type { Heading, Project, Todo, TodoStatus } from "../../types";

/** When `activeHeadingId` equals this in AppShell, task list shows only tasks with no `headingId`. */
export const PROJECT_RAIL_BACKLOG_SENTINEL = "__unplaced__";
import {
  daysUntil,
  estimateTaskEffort,
  formatProjectDate,
  pickTopTasks,
} from "./projectWorkspaceModels";

export type ProjectEditorDefaultView = "editor" | "list" | "board";

const DEFAULT_VIEW_KEY = "todos:project-editor:defaultView";

export function defaultViewStorageKey(projectId: string): string {
  return `${DEFAULT_VIEW_KEY}:${projectId}`;
}

export function readDefaultView(projectId: string): ProjectEditorDefaultView {
  try {
    const raw = localStorage.getItem(defaultViewStorageKey(projectId));
    if (raw === "list" || raw === "board" || raw === "editor") return raw;
  } catch {
    /* ignore */
  }
  return "editor";
}

export function writeDefaultView(
  projectId: string,
  value: ProjectEditorDefaultView,
): void {
  try {
    localStorage.setItem(defaultViewStorageKey(projectId), value);
  } catch {
    /* ignore */
  }
}

export interface ProjectEditorStats {
  openCount: number;
  completedCount: number;
  nextStepTitle: string;
  progressLabel: string;
  progressPercent: number;
}

export function buildProjectEditorStats(projectTodos: Todo[]): ProjectEditorStats {
  const active = projectTodos.filter((t) => !t.archived);
  const open = active.filter((t) => !t.completed);
  const completed = active.filter((t) => t.completed);
  const total = active.length;
  const next = pickTopTasks(active)[0];
  const progressPercent =
    total > 0 ? Math.round((completed.length / total) * 100) : 0;
  let progressLabel = "Not started";
  if (total === 0) progressLabel = "No tasks yet";
  else if (progressPercent === 100) progressLabel = "Complete";
  else if (progressPercent > 0) progressLabel = `${progressPercent}%`;

  return {
    openCount: open.length,
    completedCount: completed.length,
    nextStepTitle: next?.title ?? "—",
    progressLabel,
    progressPercent,
  };
}

export function countOpenTasksInSection(
  projectTodos: Todo[],
  headingId: string | null,
): number {
  const active = projectTodos.filter((t) => !t.archived && !t.completed);
  if (headingId === null) {
    return active.filter((t) => !t.headingId).length;
  }
  return active.filter((t) => t.headingId === headingId).length;
}

export function sectionRowsForRail(
  headings: Heading[],
  projectTodos: Todo[],
): { heading: Heading | null; label: string; count: number; key: string }[] {
  const rows: { heading: Heading | null; label: string; count: number; key: string }[] =
    [];
  rows.push({
    heading: null,
    label: "Backlog",
    count: countOpenTasksInSection(projectTodos, null),
    key: PROJECT_RAIL_BACKLOG_SENTINEL,
  });
  for (const h of headings) {
    rows.push({
      heading: h,
      label: h.name,
      count: countOpenTasksInSection(projectTodos, h.id),
      key: h.id,
    });
  }
  return rows;
}

const STATUS_LABELS: Record<TodoStatus, string> = {
  inbox: "Inbox",
  next: "Next up",
  in_progress: "In progress",
  waiting: "Waiting",
  scheduled: "Scheduled",
  someday: "Someday",
  done: "Done",
  cancelled: "Cancelled",
};

export function todoStatusLabel(status: TodoStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export const TODO_STATUS_OPTIONS: { value: TodoStatus; label: string }[] = (
  Object.entries(STATUS_LABELS) as [TodoStatus, string][]
).map(([value, label]) => ({ value, label }));

export function formatDueFriendly(
  dueDate: string | null | undefined,
  now = new Date(),
): string {
  if (!dueDate) return "No date";
  const short = formatProjectDate(dueDate);
  if (!short) return "No date";
  const d = daysUntil(dueDate, now);
  if (d === null) return short;
  if (d < 0) return `Overdue (${short})`;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d <= 7) return "This week";
  if (d <= 14) return "Next week";
  return short;
}

export function effortDisplayLabel(todo: Todo): string {
  return estimateTaskEffort(todo).label;
}

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.split("T")[0] ?? "";
}

export function fromDateInputValue(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return `${v}T12:00:00.000Z`;
}

export function projectStatusLabel(status: Project["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "on_hold":
      return "On hold";
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}
