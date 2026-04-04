import { useMemo, useState, useEffect, useRef } from "react";
import type { Todo, Project } from "../../types";
import { apiCall } from "../../api/client";
import { PrioritiesBriefTile } from "../ai/PrioritiesBriefTile";
import { IllustrationAllClear } from "../shared/Illustrations";
import { TuneUpTile } from "../tuneup/TuneUpTile";
import { WhatNextTile } from "../home/WhatNextTile";
import { useViewSnapshot } from "../../hooks/useViewSnapshot";

interface Props {
  todos: Todo[];
  projects: Project[];
  onTodoClick: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onEditTodo: (id: string, updates: Record<string, unknown>) => void;
  onNavigate: (view: "today" | "horizon" | "all") => void;
  onSelectProject: (id: string) => void;
  onUndo: (action: { message: string; onUndo: () => void }) => void;
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
  onEditTodo,
  onNavigate,
  onSelectProject,
  onUndo,
}: Props) {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [showMoreSections, setShowMoreSections] = useState(false);

  useEffect(() => {
    scrollContainerRef.current = document.querySelector<HTMLElement>(
      ".view-router__slot[data-active='true'] .app-content",
    );
  });

  useViewSnapshot({
    capture: () => ({
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
    }),
    restore: (snap) => {
      if (snap.scrollTop != null && snap.scrollTop > 0) {
        requestAnimationFrame(() => {
          scrollContainerRef.current?.scrollTo(0, snap.scrollTop);
        });
      }
    },
    version: 1,
  });

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
  const [rescueModeActive, setRescueModeActive] = useState(false);
  const [rescueModeSaving, setRescueModeSaving] = useState(false);

  const todaysPlannedTasks = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return active
      .filter((t) => {
        const due = t.dueDate?.split("T")[0];
        const scheduled = t.scheduledDate?.split("T")[0];
        const doDate = t.doDate?.split("T")[0];
        return due === today || scheduled === today || doDate === today;
      })
      .slice(0, 3);
  }, [active]);

  const moreSummary = useMemo(() => {
    const parts: string[] = [];
    if (dueSoonTotal > 0) parts.push(`${dueSoonTotal} due soon`);
    if (staleItems.length > 0) parts.push(`${staleItems.length} stale`);
    if (projectsToNudge.length > 0) parts.push(`${projectsToNudge.length} projects to nudge`);
    if (todaysPlannedTasks.length > 0) parts.push(`${todaysPlannedTasks.length} planned today`);
    return parts.slice(0, 3).join(" · ") || "Open supporting views only when you need more context.";
  }, [dueSoonTotal, staleItems.length, projectsToNudge.length, todaysPlannedTasks.length]);

  const handleStartRescueMode = async () => {
    setRescueModeSaving(true);
    try {
      const res = await apiCall("/agent/write/set_day_context", {
        method: "POST",
        body: JSON.stringify({ mode: "rescue" }),
      });
      if (!res.ok) throw new Error("Failed to start rescue mode");
      setRescueModeActive(true);
    } catch {
      setRescueModeActive(false);
    } finally {
      setRescueModeSaving(false);
    }
  };

  return (
    <div data-testid="home-dashboard" className="home-dashboard">
      <div className="home-dashboard__primary-stack">
        <section className="home-brief-card" data-testid="home-brief-card">
          <span className="home-brief-card__eyebrow">Daily brief</span>
          <h2 className="home-brief-card__title">Today's focus</h2>
          <p className="home-brief-card__summary">
            {active.length === 0
              ? "All clear — nothing on your plate."
              : focusTask
                ? `Start with ${focusTask.title}. ${
                    focusTask.dueDate && daysUntil(focusTask.dueDate) < 0
                      ? "It is still overdue"
                      : focusTask.priority === "urgent" || focusTask.priority === "high"
                        ? "It carries the most urgency"
                        : "It is the cleanest anchor for the day"
                  }.`
                : `${active.length} open task${active.length === 1 ? "" : "s"}${completedToday > 0 ? `, ${completedToday} finished today` : ""}.`}
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
        </section>

        {showRescue && (
          <section
            className="home-rescue-panel"
            data-testid="home-rescue-panel"
          >
            <span className="home-rescue-panel__eyebrow">Rescue mode</span>
            <h3 className="home-rescue-panel__title">
              {rescueModeActive ? "Rescue mode is on" : "Keep the day workable."}
            </h3>
            <p className="home-rescue-panel__desc">
              {rescueModeActive
                ? "The day context is now set to rescue so planning can stay narrow and defensive."
                : `You have ${active.length} open tasks and ${overdueCount} overdue. Narrow the day before adding anything else.`}
            </p>
            {!rescueModeActive && (
              <button
                className="btn btn--primary home-rescue-panel__action"
                onClick={() => void handleStartRescueMode()}
                disabled={rescueModeSaving}
              >
                {rescueModeSaving ? "Starting..." : "Start rescue mode"}
              </button>
            )}
          </section>
        )}

        <PrioritiesBriefTile />
      </div>

      {active.length > 0 && (
        <section className="home-dashboard__disclosure">
          <button
            type="button"
            className="home-dashboard__disclosure-toggle"
            aria-expanded={showMoreSections}
            onClick={() => setShowMoreSections((current) => !current)}
          >
            <span className="home-dashboard__disclosure-copy">
              <span className="home-dashboard__disclosure-title">
                {showMoreSections ? "Hide supporting views" : "Show more for today"}
              </span>
              <span className="home-dashboard__disclosure-summary">
                {moreSummary}
              </span>
            </span>
            <span className="home-dashboard__disclosure-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </span>
          </button>
        </section>
      )}

      {showMoreSections && (
        <div className="home-dashboard__progressive-stack">
          <HomePulseTile
            todos={todos}
            activeTodos={active}
            completedToday={completedToday}
            staleCount={staleItems.length}
            todaysPlannedTasks={todaysPlannedTasks}
            onTodoClick={onTodoClick}
          />

          {active.length > 0 && (
            <div className="home-dashboard__support-grid">
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
                            showActions
                            onAction={(id, action) => {
                              if (action === "smaller") onTodoClick(id);
                              else if (action === "later") {
                                const d = new Date();
                                d.setDate(d.getDate() + 3);
                                onEditTodo(id, { dueDate: d.toISOString().split("T")[0] });
                              } else if (action === "not-now") {
                                onEditTodo(id, { status: "someday" });
                              } else if (action === "drop") {
                                onEditTodo(id, { archived: true });
                              }
                            }}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <WhatNextTile onUndo={onUndo} />
            </div>
          )}

          <div className="home-dashboard__support-grid">
            {active.length > 0 && (
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
            )}
            <TuneUpTile />
          </div>

          {projectsToNudge.length > 0 && (
            <section
              className="home-tile home-tile--compact"
              data-home-tile="projects_to_nudge"
            >
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
              <div className="home-tile__subtitle">
                A short radar of projects that may slip without one quick touch.
              </div>
              <div className="home-tile__body">
                {projectsToNudge.slice(0, 4).map(({ project, open, overdue, waiting, dueSoon }) => (
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
        </div>
      )}

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
  onAction,
  meta,
  showActions = false,
}: {
  todo: Todo;
  onClick: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onAction?: (id: string, action: string) => void;
  meta?: string;
  showActions?: boolean;
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
      {showActions && onAction && (
        <div className="home-task-row__actions">
          <button
            className="home-action-chip"
            onClick={(e) => { e.stopPropagation(); onAction(todo.id, "smaller"); }}
            title="Break into smaller steps"
          >
            Start smaller
          </button>
          <button
            className="home-action-chip"
            onClick={(e) => { e.stopPropagation(); onAction(todo.id, "later"); }}
            title="Move to later date"
          >
            Move later
          </button>
          <button
            className="home-action-chip"
            onClick={(e) => { e.stopPropagation(); onAction(todo.id, "not-now"); }}
            title="Set to someday"
          >
            Not now
          </button>
          <button
            className="home-action-chip home-action-chip--danger"
            onClick={(e) => { e.stopPropagation(); onAction(todo.id, "drop"); }}
            title="Remove from list"
          >
            Drop
          </button>
        </div>
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

function HomePulseTile({
  todos,
  activeTodos,
  completedToday,
  staleCount,
  todaysPlannedTasks,
  onTodoClick,
}: {
  todos: Todo[];
  activeTodos: Todo[];
  completedToday: number;
  staleCount: number;
  todaysPlannedTasks: Todo[];
  onTodoClick: (id: string) => void;
}) {
  const completionRate = useMemo(() => {
    if (todos.length === 0) return 0;
    return Math.round((todos.filter((t) => t.completed).length / todos.length) * 100);
  }, [todos]);

  return (
    <section className="home-tile home-tile--pulse" data-home-tile="home_pulse">
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <h3 className="home-tile__title">Pulse</h3>
        </div>
      </div>
      <div className="home-tile__subtitle">
        Enough signal to orient the day, without turning focus into a report.
      </div>
      <div className="home-tile__body">
        <div className="home-pulse-grid">
          <InsightMetric label="Open" value={String(activeTodos.length)} />
          <InsightMetric label="Done today" value={String(completedToday)} />
          <InsightMetric label="Completion" value={`${completionRate}%`} />
          <InsightMetric label="Stale" value={String(staleCount)} />
        </div>
        {todaysPlannedTasks.length > 0 && (
          <div className="home-pulse-agenda">
            <div className="home-task-group__label">Scheduled today</div>
            {todaysPlannedTasks.map((todo) => (
              <button
                key={todo.id}
                className="home-pulse-agenda__item"
                onClick={() => onTodoClick(todo.id)}
              >
                <span className="home-pulse-agenda__title">{todo.title}</span>
                {todo.estimateMinutes && (
                  <span className="home-pulse-agenda__meta">
                    {todo.estimateMinutes}m
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
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
