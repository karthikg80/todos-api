// src/services/focusBriefService.ts
import type {
  AgendaItem,
  TaskItem,
  UnsortedPanelData,
  DueSoonPanelData,
  DueSoonGroup,
  BacklogHygienePanelData,
  ProjectsToNudgePanelData,
  ProjectToNudge,
  TrackOverviewPanelData,
  RescueModePanelData,
} from "../types/focusBrief";

function toTaskItem(t: any, today: Date): TaskItem {
  const dueDate = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null;
  const overdue = t.dueDate ? new Date(t.dueDate) < today : false;
  return {
    id: t.id,
    title: t.title,
    dueDate,
    estimateMinutes: t.estimateMinutes ?? null,
    priority: t.priority ?? "medium",
    overdue,
  };
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysUntil(date: Date, today: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function computeTodayAgenda(todos: any[], today: Date): AgendaItem[] {
  return todos
    .filter((t) => {
      if (t.completed || t.archived) return false;
      const due = t.dueDate ? new Date(t.dueDate) : null;
      const scheduled = t.scheduledDate ? new Date(t.scheduledDate) : null;
      const doDate = t.doDate ? new Date(t.doDate) : null;
      return (
        (due && (isSameDay(due, today) || due < today)) ||
        (scheduled && isSameDay(scheduled, today)) ||
        (doDate && isSameDay(doDate, today))
      );
    })
    .map((t) => ({
      ...toTaskItem(t, today),
      completed: t.completed ?? false,
    }));
}

export function computeUnsorted(todos: any[]): UnsortedPanelData {
  const items = todos
    .filter((t) => !t.completed && !t.archived && t.status === "inbox")
    .map((t) => ({ id: t.id, title: t.title }));
  return { type: "unsorted", items };
}

export function computeDueSoon(todos: any[], today: Date): DueSoonPanelData {
  const active = todos.filter((t) => !t.completed && !t.archived && t.dueDate);
  const groups: DueSoonGroup[] = [];

  const overdue = active.filter((t) => daysUntil(new Date(t.dueDate!), today) < 0);
  if (overdue.length > 0)
    groups.push({ label: "Overdue", items: overdue.slice(0, 6).map((t) => toTaskItem(t, today)) });

  const todayTasks = active.filter((t) => daysUntil(new Date(t.dueDate!), today) === 0);
  if (todayTasks.length > 0)
    groups.push({ label: "Today", items: todayTasks.slice(0, 6).map((t) => toTaskItem(t, today)) });

  const tomorrow = active.filter((t) => daysUntil(new Date(t.dueDate!), today) === 1);
  if (tomorrow.length > 0)
    groups.push({
      label: "Tomorrow",
      items: tomorrow.slice(0, 6).map((t) => toTaskItem(t, today)),
    });

  const next3 = active.filter((t) => {
    const d = daysUntil(new Date(t.dueDate!), today);
    return d >= 2 && d <= 3;
  });
  if (next3.length > 0)
    groups.push({
      label: "Next 3 days",
      items: next3.slice(0, 6).map((t) => toTaskItem(t, today)),
    });

  return { type: "dueSoon", groups };
}

export function computeBacklogHygiene(todos: any[], today: Date): BacklogHygienePanelData {
  const staleThreshold = (t: any) => {
    if (t.priority === "high" || t.priority === "urgent") return 7;
    if (t.status === "inbox") return 7;
    return 14;
  };

  const items = todos
    .filter((t) => {
      if (t.completed || t.archived) return false;
      const updated = t.updatedAt ? new Date(t.updatedAt) : null;
      if (!updated) return false;
      const days = daysUntil(today, updated);
      return days >= staleThreshold(t);
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      staleDays: Math.round(
        (today.getTime() - new Date(t.updatedAt).getTime()) / 86400000,
      ),
    }))
    .sort((a, b) => b.staleDays - a.staleDays)
    .slice(0, 5);

  return { type: "backlogHygiene", items };
}

export function computeProjectsToNudge(
  projects: any[],
  todos: any[],
  today: Date,
): ProjectsToNudgePanelData {
  const activeProjects = projects.filter((p: any) => !p.archived);
  const items: ProjectToNudge[] = activeProjects
    .map((p: any) => {
      const projectTodos = todos.filter(
        (t: any) => t.projectId === p.id && !t.completed && !t.archived,
      );
      const overdueCount = projectTodos.filter(
        (t: any) => t.dueDate && new Date(t.dueDate) < today,
      ).length;
      const waitingCount = projectTodos.filter((t: any) => t.status === "waiting").length;
      const dueSoonCount = projectTodos.filter((t: any) => {
        if (!t.dueDate) return false;
        const d = daysUntil(new Date(t.dueDate), today);
        return d >= 0 && d <= 3;
      }).length;
      return { id: p.id, name: p.name, overdueCount, waitingCount, dueSoonCount };
    })
    .filter((p) => p.overdueCount > 0 || p.waitingCount > 0 || p.dueSoonCount > 0)
    .sort(
      (a, b) =>
        b.overdueCount +
        b.waitingCount +
        b.dueSoonCount -
        (a.overdueCount + a.waitingCount + a.dueSoonCount),
    )
    .slice(0, 5);

  return { type: "projectsToNudge", items };
}

export function computeTrackOverview(todos: any[], today: Date): TrackOverviewPanelData {
  const active = todos.filter((t) => !t.completed && !t.archived);
  const thisWeek: TaskItem[] = [];
  const next14Days: TaskItem[] = [];
  const later: TaskItem[] = [];

  for (const t of active) {
    const item = toTaskItem(t, today);
    if (!t.dueDate) {
      if (t.priority === "high" || t.priority === "urgent") thisWeek.push(item);
      else later.push(item);
    } else {
      const d = daysUntil(new Date(t.dueDate), today);
      if (d <= 7) thisWeek.push(item);
      else if (d <= 14) next14Days.push(item);
      else later.push(item);
    }
  }

  return {
    type: "trackOverview",
    columns: {
      thisWeek: thisWeek.slice(0, 15),
      next14Days: next14Days.slice(0, 15),
      later: later.slice(0, 15),
    },
  };
}

export function computeRescueMode(todos: any[], today: Date): RescueModePanelData {
  const active = todos.filter((t) => !t.completed && !t.archived);
  const overdueCount = active.filter((t) => t.dueDate && new Date(t.dueDate) < today).length;
  return { type: "rescueMode", openCount: active.length, overdueCount };
}
