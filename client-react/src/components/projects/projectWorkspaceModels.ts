import type { Heading, Project, Todo } from "../../types";

export interface SectionGroup {
  key: string;
  heading: Heading | null;
  label: string;
  todos: Todo[];
}

export type ProjectOverviewMode = "simple" | "guided" | "rich";

export type ComplexityLabel = "Simple project" | "Structured project" | "Complex project";

export const COMPLEXITY_LABELS: Record<ProjectOverviewMode, ComplexityLabel> = {
  simple: "Simple project",
  guided: "Structured project",
  rich: "Complex project",
};

/** Shown on the derived complexity badge (from `classifyProjectOverview`, not user-edited text). */
export const COMPLEXITY_INFERENCE_TITLE =
  "Inferred from tasks, headings, and dates in this project — not something you typed as the name or description.";

export const COMPLEXITY_STYLES: Record<
  ProjectOverviewMode,
  { background: string; border: string; color: string }
> = {
  simple: {
    background: "color-mix(in oklab, var(--success) 8%, transparent)",
    border: "1px solid color-mix(in oklab, var(--success) 20%, transparent)",
    color: "var(--success)",
  },
  guided: {
    background: "color-mix(in oklab, var(--info) 8%, transparent)",
    border: "1px solid color-mix(in oklab, var(--info) 20%, transparent)",
    color: "var(--info)",
  },
  rich: {
    background: "color-mix(in oklab, var(--warning) 8%, transparent)",
    border: "1px solid color-mix(in oklab, var(--warning) 20%, transparent)",
    color: "var(--warning)",
  },
};

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
      label: "Backlog",
      todos: unplaced,
    });
  }

  return groups;
}

export function estimateTaskEffort(todo: Todo): { minutes: number; label: string } {
  if (!todo) {
    return { minutes: 0, label: "Unknown" };
  }

  // Base estimate from subtasks
  const subtaskCount = todo?.subtasks?.length ?? 0;
  let baseMinutes = 5 + subtaskCount * 3;

  // Adjust for priority
  if (todo?.priority === "urgent") {
    baseMinutes *= 1.5;
  } else if (todo?.priority === "high") {
    baseMinutes *= 1.2;
  }

  // Adjust for notes length (more notes = more complexity)
  const notesLength = (todo?.notes ?? "").length;
  if (notesLength > 200) {
    baseMinutes += 5;
  } else if (notesLength > 100) {
    baseMinutes += 2;
  }

  // Round to nearest 5 minutes
  const roundedMinutes = Math.round(baseMinutes / 5) * 5;

  // Format label
  let label: string;
  if (roundedMinutes <= 5) {
    label = "Quick win";
  } else if (roundedMinutes <= 15) {
    label = "Short";
  } else if (roundedMinutes <= 30) {
    label = "Medium";
  } else if (roundedMinutes <= 60) {
    label = "Long";
  } else {
    label = "Extended";
  }

  return { minutes: roundedMinutes, label };
}

export function getTaskNextReason(todo: Todo, projectTodos: Todo[]): string {
  if (!todo) return "next in queue";

  const reasons: string[] = [];

  // Priority
  if (todo?.priority === "urgent") {
    reasons.push("urgent priority");
  } else if (todo?.priority === "high") {
    reasons.push("high priority");
  }

  // Due date
  if (todo?.dueDate) {
    const dueDate = new Date(todo.dueDate);
    const today = startOfToday();
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilDue <= 1) {
      reasons.push("due soon");
    } else if (daysUntilDue <= 3) {
      reasons.push(`due in ${daysUntilDue} days`);
    }
  }

  // Blocking other tasks
  const blockedTodos = projectTodos.filter((t) =>
    t?.dependsOnTaskIds?.includes(todo.id),
  );
  if (blockedTodos.length > 0) {
    reasons.push(
      `unblocks ${blockedTodos.length} other task${blockedTodos.length > 1 ? "s" : ""}`,
    );
  }

  return reasons.length > 0 ? reasons[0] : "next in queue";
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

export function getEnhancedMetricsText(
  profile: ProjectOverviewProfile,
  project: Project,
  projectTodos: Todo[],
  now = new Date(),
): string {
  const parts: string[] = [];

  // Open tasks
  if (profile.openTasks === 1) {
    parts.push("1 open task");
  } else if (profile.openTasks > 1) {
    parts.push(`${profile.openTasks} open tasks`);
  }

  // Completion status
  if (profile.completedTasks === 0 && profile.openTasks > 0) {
    parts.push("Nothing completed yet");
  } else if (profile.completedTasks > 0) {
    const totalTasks = profile.openTasks + profile.completedTasks;
    const percent = totalTasks > 0
      ? Math.round((profile.completedTasks / totalTasks) * 100)
      : 0;
    parts.push(`${percent}% complete`);
  }

  // Next scheduled
  const nextScheduled = projectTodos
    .filter((todo) => !todo.completed && todo.dueDate)
    .sort((a, b) => {
      const dateA = new Date(a.dueDate ?? "").getTime();
      const dateB = new Date(b.dueDate ?? "").getTime();
      return dateA - dateB;
    })[0];

  if (nextScheduled?.dueDate) {
    const dueDate = new Date(nextScheduled.dueDate);
    const today = startOfToday(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    if (dueDate < today) {
      parts.push("Overdue task(s)");
    } else if (dueDate < tomorrow) {
      parts.push("Due today");
    } else if (dueDate < nextWeek) {
      const dayName = dueDate.toLocaleDateString("en-US", { weekday: "short" });
      parts.push(`Next: ${dayName}`);
    } else {
      const dateStr = dueDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      parts.push(`Next: ${dateStr}`);
    }
  }

  return parts.length > 0 ? parts.join(" · ") : "";
}

export function getEmptyStateGuidance(
  profile: ProjectOverviewProfile,
  project: Project,
): { title: string; body: string; showAdd: boolean } {
  // If no tasks at all
  if (profile.totalTasks === 0) {
    return {
      title: "Start with a concrete step",
      body: `You do not need a full plan yet. Add the next real action for "${project.name}" and let the project take shape from there.`,
      showAdd: true,
    };
  }

  // If simple project with few tasks
  if (profile.mode === "simple") {
    return {
      title: "Keep this project lightweight",
      body: "A small project does not need a dashboard. Add the next couple of steps and only introduce sections if the work starts to branch.",
      showAdd: true,
    };
  }

  // If guided project with unplaced tasks
  if (profile.mode === "guided" && profile.unplacedTasks > 0) {
    return {
      title: "Organize your work",
      body: `You have ${profile.unplacedTasks} task${profile.unplacedTasks > 1 ? "s" : ""} in the backlog. Move them into sections when the project grows.`,
      showAdd: false,
    };
  }

  // Default empty state
  return {
    title: "No tasks in this section",
    body: "Add a task to get started, or navigate to another section.",
    showAdd: true,
  };
}

export function buildSnapshotItemsEnhanced(
  profile: ProjectOverviewProfile,
  progress: number,
  project: Project,
  projectTodos: Todo[],
  now = new Date(),
) {
  const items: Array<{ label: string; value: string; actionable: boolean }> = [];

  // Open tasks - always actionable
  items.push({
    label: "Open",
    value: `${profile.openTasks} task${profile.openTasks === 1 ? "" : "s"}`,
    actionable: false,
  });

  // Progress - actionable if zero
  if (profile.completedTasks === 0 && profile.openTasks > 0) {
    items.push({
      label: "Progress",
      value: "Not started yet",
      actionable: false,
    });
  } else if (profile.completedTasks > 0) {
    items.push({
      label: "Progress",
      value: `${progress}% complete`,
      actionable: false,
    });
  }

  // Sections - actionable if project needs organization
  // Only show Backlog if it's not redundant with Open tasks
  if (profile.unplacedTasks > 1 && profile.unplacedTasks !== profile.openTasks && profile.mode !== "simple") {
    items.push({
      label: "Backlog",
      value: `${profile.unplacedTasks} item${profile.unplacedTasks > 1 ? "s" : ""}`,
      actionable: true,
    });
  } else if (profile.sectionsWithTasks > 0) {
    items.push({
      label: "Sections",
      value: `${profile.sectionsWithTasks} section${profile.sectionsWithTasks > 1 ? "s" : ""}`,
      actionable: false,
    });
  }

  // Target date - actionable if approaching or overdue
  if (project.targetDate) {
    const target = new Date(project.targetDate);
    const today = startOfToday(now);
    const daysUntilTarget = Math.ceil(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilTarget <= 0) {
      items.push({
        label: "Target",
        value: "Overdue",
        actionable: true,
      });
    } else if (daysUntilTarget <= 7) {
      items.push({
        label: "Target",
        value: `${daysUntilTarget}d left`,
        actionable: daysUntilTarget <= 3,
      });
    } else {
      items.push({
        label: "Target",
        value: formatProjectDate(project.targetDate) ?? "Set",
        actionable: false,
      });
    }
  } else if (profile.datedTasks > 0) {
    // Next scheduled
    const nextScheduled = projectTodos
      .filter((todo) => !todo.completed && todo.dueDate)
      .sort((a, b) => {
        const dateA = new Date(a.dueDate ?? "").getTime();
        const dateB = new Date(b.dueDate ?? "").getTime();
        return dateA - dateB;
      })[0];

    if (nextScheduled?.dueDate) {
      const dueDate = new Date(nextScheduled.dueDate);
      const today = startOfToday(now);
      if (dueDate < today) {
        items.push({
          label: "Next",
          value: "Overdue",
          actionable: true,
        });
      } else if (dueDate.getTime() === today.getTime()) {
        items.push({
          label: "Next",
          value: "Today",
          actionable: true,
        });
      } else {
        const daysUntil = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        let dateValue = "Set";
        if (daysUntil === 1) {
          dateValue = "Tomorrow";
        } else if (daysUntil < 7) {
          dateValue = dueDate.toLocaleDateString("en-US", { weekday: "short" });
        } else {
          dateValue = formatProjectDate(dueDate.toISOString()) ?? "Set";
        }
        items.push({
          label: "Next",
          value: dateValue,
          actionable: daysUntil <= 3,
        });
      }
    }
  }

  return items.slice(0, 4);
}

export function getTabDescription(
  workspaceMode: string,
  profile: ProjectOverviewProfile,
): string {
  switch (workspaceMode) {
    case "overview":
      if (profile.showStarter) {
        return "Best for getting started with your first step.";
      }
      if (profile.mode === "simple") {
        return "Best for quick wins without structure.";
      }
      return "Best for deciding what to do next.";

    case "sections":
      if (profile.mode === "simple") {
        return "Use sections when the project grows.";
      }
      if (profile.sectionsWithTasks >= 3 || profile.mode === "guided") {
        return "This project has distinct phases. Map them out here.";
      }
      return "Use sections as chapters, not filters.";

    case "tasks":
      if (profile.mode === "simple") {
        return "Keep it simple for now.";
      }
      if (profile.openTasks <= 8) {
        return "Ready for operational mode.";
      }
      return "Best for sorting, batching, and bulk edits.";

    default:
      return "";
  }
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
