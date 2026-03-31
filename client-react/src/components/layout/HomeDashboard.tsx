import { useMemo, useState, useEffect } from "react";
import type { Todo, Project } from "../../types";
import { apiCall } from "../../api/client";
import { HomeFocusSuggestions } from "../ai/HomeFocusSuggestions";
import { PrioritiesBriefTile } from "../ai/PrioritiesBriefTile";
import { IllustrationAllClear } from "../shared/Illustrations";

interface Props {
  todos: Todo[];
  projects: Project[];
  onTodoClick: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onNavigate: (view: "today" | "upcoming" | "all") => void;
  onSelectProject: (id: string) => void;
}

// --- Helpers ---

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date(new Date().toDateString());
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function staleDays(todo: Todo): number {
  return Math.floor(
    (Date.now() - new Date(todo.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function isStale(todo: Todo): boolean {
  if (todo.completed) return false;
  const days = staleDays(todo);
  if (todo.priority === "high" || todo.priority === "urgent") return days > 7;
  if (!todo.projectId && !todo.category) return days > 7; // unsorted
  return days > 14;
}

// --- Main component ---

export function HomeDashboard({
  todos,
  projects,
  onTodoClick,
  onToggleTodo,
  onNavigate,
  onSelectProject,
}: Props) {
  const active = useMemo(() => todos.filter((t) => !t.completed), [todos]);

  // Strongest next action: highest-priority incomplete todo
  const focusTask = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...active]
      .sort(
        (a, b) =>
          (priorityOrder[a.priority || "medium"] ?? 2) -
          (priorityOrder[b.priority || "medium"] ?? 2),
      )
      [0] ?? null;
  }, [active]);

  // Due soon: grouped by overdue / today / tomorrow / next 3 days
  const dueSoonGroups = useMemo(() => {
    const groups: Array<{ label: string; items: Todo[] }> = [
      { label: "Still waiting", items: [] },
      { label: "Today", items: [] },
      { label: "Tomorrow", items: [] },
      { label: "Next 3 days", items: [] },
    ];
    for (const t of active) {
      if (!t.dueDate) continue;
      const d = daysUntil(t.dueDate);
      if (d < 0) groups[0].items.push(t);
      else if (d === 0) groups[1].items.push(t);
      else if (d === 1) groups[2].items.push(t);
      else if (d <= 3) groups[3].items.push(t);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [active]);

  const dueSoonTotal = useMemo(
    () => dueSoonGroups.reduce((n, g) => n + g.items.length, 0),
    [dueSoonGroups],
  );

  // Backlog hygiene: stale tasks scored by staleness
  const staleItems = useMemo(
    () =>
      active
        .filter(isStale)
        .sort((a, b) => staleDays(b) - staleDays(a))
        .slice(0, 3),
    [active],
  );

  // Needs attention count
  const needsAttention = useMemo(
    () =>
      active.filter(
        (t) =>
          t.status === "inbox" || (!t.projectId && !t.category),
      ).length,
    [active],
  );

  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return todos.filter(
      (t) =>
        t.completed &&
        t.completedAt &&
        new Date(t.completedAt).toDateString() === today,
    ).length;
  }, [todos]);

  // Projects to nudge: projects with overdue or waiting tasks
  const projectsToNudge = useMemo(() => {
    return projects
      .filter((p) => !p.archived)
      .map((p) => {
        const projectTodos = active.filter((t) => t.projectId === p.id);
        const overdue = projectTodos.filter(
          (t) => t.dueDate && daysUntil(t.dueDate) < 0,
        ).length;
        const waiting = projectTodos.filter(
          (t) => t.status === "waiting",
        ).length;
        const dueSoon = projectTodos.filter(
          (t) => t.dueDate && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 3,
        ).length;
        return { project: p, open: projectTodos.length, overdue, waiting, dueSoon };
      })
      .filter((p) => p.overdue > 0 || p.waiting > 0 || p.dueSoon > 0)
      .slice(0, 5);
  }, [projects, active]);

  // Rescue mode: show when overcommitted (more than 10 active + overdue tasks)
  const overdueCount = useMemo(
    () => active.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0).length,
    [active],
  );
  const showRescue = active.length > 10 && overdueCount > 3;

  return (
    <div data-testid="home-dashboard" className="home-dashboard">
      {/* Section 1: Daily Brief Card */}
      <section className="home-brief-card" data-testid="home-brief-card">
        <span className="home-brief-card__eyebrow">Daily brief</span>
        <h2 className="home-brief-card__title">Today's focus</h2>
        <p className="home-brief-card__summary">
          {active.length === 0
            ? "All clear — nothing on your plate."
            : `${active.length} open task${active.length === 1 ? "" : "s"}${completedToday > 0 ? `, ${completedToday} done today` : ""}.`}
        </p>
        <div className="home-brief-card__stats">
          <div className="home-brief-stat">
            <span className="home-brief-stat__number">{dueSoonTotal}</span>
            <span className="home-brief-stat__label">Due soon</span>
          </div>
          <div className="home-brief-stat">
            <span className="home-brief-stat__number">{needsAttention}</span>
            <span className="home-brief-stat__label">Needs attention</span>
          </div>
        </div>
        {focusTask && (
          <button
            className="home-brief-card__action"
            onClick={() => onTodoClick(focusTask.id)}
          >
            <span className="home-brief-card__action-label">
              Strongest next action
            </span>
            <span className="home-brief-card__action-title">
              {focusTask.title}
            </span>
          </button>
        )}

        {/* AI focus suggestions — up to 3 tasks with reasoning */}
        <HomeFocusSuggestions todos={todos} onTodoClick={onTodoClick} />
      </section>

      {/* AI Priorities Brief — LLM-generated HTML digest */}
      <PrioritiesBriefTile />

      {/* Rescue mode panel */}
      {showRescue && (
        <section className="home-rescue-panel">
          <span className="home-rescue-panel__eyebrow">Rescue mode</span>
          <h3 className="home-rescue-panel__title">
            Keep the day workable.
          </h3>
          <p className="home-rescue-panel__desc">
            You have {active.length} open tasks and {overdueCount} overdue.
            Consider deferring or completing a few to regain focus.
          </p>
        </section>
      )}

      {/* Section 2: Support Grid (2-column) */}
      {active.length > 0 && (
        <div className="home-dashboard__support-grid">
          {/* Due Soon tile */}
          <section className="home-tile" data-home-tile="due_soon">
            <div className="home-tile__header">
              <div className="home-tile__title-row">
                <svg
                  className="home-tile__icon"
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16.5 12" />
                </svg>
                <h3 className="home-tile__title">Due soon</h3>
              </div>
              {dueSoonTotal > 0 && (
                <button
                  className="mini-btn home-tile__see-all"
                  onClick={() => onNavigate("today")}
                >
                  See all
                </button>
              )}
            </div>
            <div className="home-tile__subtitle">
              Keep the horizon visible without turning it into a dashboard.
            </div>
            <div className="home-tile__body">
              {dueSoonGroups.length === 0 ? (
                <div className="home-tile__empty">
                  <DueSoonEmptyIllustration />
                  <p>Nothing urgent is coming up.</p>
                </div>
              ) : (
                dueSoonGroups.map((group) => (
                  <div key={group.label} className="home-task-group">
                    <div className="home-task-group__label">{group.label}</div>
                    {group.items.slice(0, 6).map((todo) => (
                      <HomeTaskRow
                        key={todo.id}
                        todo={todo}
                        onClick={onTodoClick}
                        onToggle={onToggleTodo}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Backlog Hygiene tile */}
          <section className="home-tile" data-home-tile="stale_risks">
            <div className="home-tile__header">
              <div className="home-tile__title-row">
                <h3 className="home-tile__title">Backlog hygiene</h3>
              </div>
              {staleItems.length > 0 && (
                <button
                  className="mini-btn home-tile__see-all"
                  onClick={() => onNavigate("all")}
                >
                  Review list
                </button>
              )}
            </div>
            <div className="home-tile__subtitle">
              A short list to keep the system feeling clean.
            </div>
            <div className="home-tile__body">
              {staleItems.length === 0 ? (
                <div className="home-tile__empty">
                  <BacklogCleanEmptyIllustration />
                  <p>Backlog looks calm right now.</p>
                </div>
              ) : (
                staleItems.map((todo) => (
                  <HomeTaskRow
                    key={todo.id}
                    todo={todo}
                    onClick={onTodoClick}
                    onToggle={onToggleTodo}
                    meta={`${staleDays(todo)}d untouched`}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Section 3: Insights Card */}
      <InsightsCard />

      {/* Section 4: Projects to Nudge */}
      {projectsToNudge.length > 0 && (
        <section className="home-tile" data-home-tile="projects_to_nudge">
          <div className="home-tile__header">
            <div className="home-tile__title-row">
              <svg
                className="home-tile__icon"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <h3 className="home-tile__title">Projects to nudge</h3>
            </div>
          </div>
          <div className="home-tile__body">
            {projectsToNudge.map(({ project, open, overdue, waiting, dueSoon }) => (
              <div
                key={project.id}
                className="home-project-row"
                onClick={() => onSelectProject(project.id)}
              >
                <span className="home-project-row__name">{project.name}</span>
                <span className="home-project-row__meta">
                  {open} open
                  {overdue > 0 && ` · ${overdue} overdue`}
                  {waiting > 0 && ` · ${waiting} waiting`}
                  {dueSoon > 0 && ` · ${dueSoon} due soon`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 5: Today's Plan */}
      <TodaysPlanTile todos={active} onTodoClick={onTodoClick} />

      {/* Empty state */}
      {active.length === 0 && (
        <div className="home-dashboard__empty">
          <IllustrationAllClear />
          <p>All clear. Enjoy your day!</p>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function HomeTaskRow({
  todo,
  onClick,
  onToggle,
  meta,
}: {
  todo: Todo;
  onClick: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  meta?: string;
}) {
  return (
    <div className="home-task-row" data-home-todo-id={todo.id}>
      <input
        type="checkbox"
        className="todo-checkbox"
        checked={todo.completed}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(todo.id, e.target.checked);
        }}
      />
      <button
        className="home-task-row__title"
        onClick={() => onClick(todo.id)}
      >
        {todo.title}
      </button>
      {todo.dueDate && (
        <span
          className={`home-task-row__badge${daysUntil(todo.dueDate) < 0 ? " home-task-row__badge--overdue" : ""}`}
        >
          {formatDueBadge(todo.dueDate)}
        </span>
      )}
      {meta && <span className="home-task-row__meta">{meta}</span>}
    </div>
  );
}

function formatDueBadge(dateStr: string): string {
  const d = daysUntil(dateStr);
  if (d < 0) return "Still waiting";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// --- Insights Card (async, matches classic home-tile--insights) ---

interface InsightsData {
  completionRate?: number;
  streak?: number;
  commitRatio?: number;
  staleTasks?: number;
}

function InsightsCard() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("/ai/insights?days=7")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null; // Don't show skeleton — inserted conditionally like classic
  if (!data) return null;

  return (
    <section
      className="home-tile home-tile--insights"
      data-home-tile="insights"
    >
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <svg
            className="home-tile__icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 14V6h3v8H2Zm4.5 0V2h3v12h-3ZM11 14V9h3v5h-3Z"
              fill="currentColor"
              opacity=".6"
            />
          </svg>
          <h3 className="home-tile__title">Your week</h3>
        </div>
      </div>
      <div className="home-tile__body">
        <div className="insights-grid">
          <InsightMetric
            label="Completion"
            value={
              data.completionRate != null
                ? `${Math.round(data.completionRate)}%`
                : "—"
            }
          />
          <InsightMetric
            label="Streak"
            value={
              data.streak != null ? `${data.streak}d` : "—"
            }
          />
          <InsightMetric
            label="Commit ratio"
            value={
              data.commitRatio != null
                ? `${Math.round(data.commitRatio)}%`
                : "—"
            }
            color={
              data.commitRatio != null
                ? data.commitRatio >= 70
                  ? "var(--success)"
                  : "var(--danger)"
                : undefined
            }
          />
          <InsightMetric
            label="Stale"
            value={
              data.staleTasks != null ? String(data.staleTasks) : "—"
            }
          />
        </div>
      </div>
    </section>
  );
}

// --- Today's Plan tile (matches classic data-home-tile="todays_plan") ---

function TodaysPlanTile({
  todos,
  onTodoClick,
}: {
  todos: Todo[];
  onTodoClick: (id: string) => void;
}) {
  // Show tasks scheduled for today or with today's due date
  const todaysTasks = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return todos
      .filter((t) => {
        const due = t.dueDate?.split("T")[0];
        const scheduled = t.scheduledDate?.split("T")[0];
        const doDate = t.doDate?.split("T")[0];
        return due === today || scheduled === today || doDate === today;
      })
      .sort((a, b) => {
        // Sort by scheduled time if available, then by order
        const aTime = a.scheduledDate || a.dueDate || "";
        const bTime = b.scheduledDate || b.dueDate || "";
        return aTime.localeCompare(bTime);
      });
  }, [todos]);

  if (todaysTasks.length === 0) return null;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="home-tile home-tile--plan" data-home-tile="todays_plan">
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <svg
            className="home-tile__icon"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          <h3 className="home-tile__title">Today's plan</h3>
        </div>
        <span className="home-tile__date-label">{todayLabel}</span>
      </div>
      <div className="home-tile__body">
        {todaysTasks.map((todo) => (
          <div key={todo.id} className="plan-slot">
            {todo.estimateMinutes && (
              <span className="plan-slot__effort">
                {todo.estimateMinutes}m
              </span>
            )}
            <button
              className="home-task-row__title"
              onClick={() => onTodoClick(todo.id)}
            >
              {todo.title}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="insight-metric">
      <span
        className="insight-metric__value"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      <span className="insight-metric__label">{label}</span>
    </div>
  );
}

// --- Empty state illustrations (theme-aware via CSS vars, matching classic) ---

function DueSoonEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="empty-state-illustration empty-state-illustration--tile"
      aria-hidden="true"
    >
      <circle
        cx="60"
        cy="40"
        r="28"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <circle cx="60" cy="15" r="1.5" fill="var(--border)" opacity="0.4" />
      <circle cx="85" cy="40" r="1.5" fill="var(--border)" opacity="0.4" />
      <circle cx="60" cy="65" r="1.5" fill="var(--border)" opacity="0.4" />
      <circle cx="35" cy="40" r="1.5" fill="var(--border)" opacity="0.4" />
      <line
        x1="60"
        y1="40"
        x2="50"
        y2="24"
        stroke="var(--border)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="60"
        y1="40"
        x2="60"
        y2="18"
        stroke="var(--border)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      <circle cx="60" cy="40" r="2.5" fill="var(--accent)" opacity="0.5" />
      <circle cx="96" cy="16" r="10" fill="var(--success)" opacity="0.08" />
      <circle
        cx="96"
        cy="16"
        r="10"
        fill="none"
        stroke="var(--success)"
        strokeWidth="1.2"
        opacity="0.4"
      />
      <path
        d="M91 16l3.5 3.5 7-7"
        stroke="var(--success)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  );
}

function BacklogCleanEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="empty-state-illustration empty-state-illustration--tile"
      aria-hidden="true"
    >
      <rect
        x="28"
        y="32"
        width="64"
        height="40"
        rx="6"
        fill="var(--border)"
        opacity="0.1"
        stroke="var(--border)"
        strokeWidth="1"
      />
      <rect
        x="24"
        y="26"
        width="64"
        height="40"
        rx="6"
        fill="var(--border)"
        opacity="0.06"
        stroke="var(--border)"
        strokeWidth="1"
      />
      <rect
        x="20"
        y="20"
        width="64"
        height="40"
        rx="6"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <path
        d="M32 34l3 3 6-6"
        stroke="var(--success)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />
      <rect
        x="46"
        y="33"
        width="28"
        height="2.5"
        rx="1.25"
        fill="var(--border)"
        opacity="0.25"
      />
      <path
        d="M32 46l3 3 6-6"
        stroke="var(--success)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <rect
        x="46"
        y="45"
        width="22"
        height="2.5"
        rx="1.25"
        fill="var(--border)"
        opacity="0.18"
      />
      <path
        d="M98 22l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"
        fill="var(--success)"
        opacity="0.4"
      />
    </svg>
  );
}
