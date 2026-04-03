import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type {
  CreateTodoDto,
  Project,
  Todo,
  UpdateTodoDto,
  User,
} from "../../types";
import { Breadcrumb } from "../shared/Breadcrumb";
import {
  IconBoard,
  IconCalendar,
  IconCheck,
  IconClock,
  IconFolder,
  IconLightning,
  IconList,
  IconMenu,
  IconPlus,
  IconRefresh,
  IconTarget,
  IconWaiting,
} from "../shared/Icons";
import { SegmentedControl } from "../shared/SegmentedControl";
import { SearchBar } from "../shared/SearchBar";
import { VerificationBanner } from "../shared/VerificationBanner";
import { QuickEntry } from "../todos/QuickEntry";
import { BulkToolbar } from "../todos/BulkToolbar";
import { FilterPanel, type ActiveFilters } from "../todos/FilterPanel";
import { ProjectHeadings } from "./ProjectHeadings";
import { SortableTodoList } from "../todos/SortableTodoList";
import { useProjectHeadings } from "../../hooks/useProjectHeadings";
import { useViewSnapshot } from "../../hooks/useViewSnapshot";
import type { LoadState } from "../../store/useTodosStore";
import type { SortField, SortOrder } from "../todos/SortControl";
import {
  buildSectionGroups,
  daysUntil,
  formatProjectDate,
  isOverdue,
  pickTopTasks,
} from "./projectWorkspaceModels";

const BoardView = lazy(() =>
  import("../todos/BoardView").then((m) => ({ default: m.BoardView })),
);

const WORKSPACE_MODES = [
  { value: "overview", label: "Overview" },
  { value: "sections", label: "Sections" },
  { value: "tasks", label: "Tasks" },
] as const;

type WorkspaceMode = (typeof WORKSPACE_MODES)[number]["value"];
type ViewMode = "list" | "board";
type UiMode = "normal" | "simple";
type PulseTone = "steady" | "focused" | "risk" | "done";

interface Props {
  project: Project;
  projectTodos: Todo[];
  visibleTodos: Todo[];
  loadState: LoadState;
  errorMessage: string;
  activeTodoId: string | null;
  expandedTodoId: string | null;
  selectedIds: Set<string>;
  activeHeadingId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenNav: () => void;
  onClearProject: () => void;
  viewLabels: Record<string, string>;
  activeView: string;
  onNewTask: () => void;
  user: User | null;
  uiMode: UiMode;
  quickEntryPlaceholder: string;
  onAddTodo: (dto: CreateTodoDto) => Promise<unknown>;
  onCaptureToDesk: (text: string) => Promise<unknown>;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
  activeTagFilter: string;
  onClearTagFilter: () => void;
  bulkMode: boolean;
  onSelectAll: () => void;
  onBulkComplete: () => void;
  onBulkDelete: () => void;
  onCancelBulk: () => void;
  onSelectHeading: (headingId: string | null) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onToggle: (id: string, completed: boolean) => void;
  onTaskClick: (id: string) => void;
  onTaskOpen: (id: string) => void;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onInlineEdit: (id: string, title: string) => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onTagClick: (tag: string) => void;
  onLifecycleAction: (id: string, action: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
}

function ProjectTaskPreview({
  todo,
  onClick,
}: {
  todo: Todo;
  onClick: (id: string) => void;
}) {
  const due = formatProjectDate(todo.dueDate);
  const bits = [
    todo.status.replace("_", " "),
    due ? (isOverdue(todo) ? `overdue ${due}` : `due ${due}`) : null,
    todo.waitingOn ? "waiting" : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className="project-workspace-task-preview"
      onClick={() => onClick(todo.id)}
    >
      <span className="project-workspace-task-preview__title">{todo.title}</span>
      {bits.length > 0 && (
        <span className="project-workspace-task-preview__meta">
          {bits.join(" · ")}
        </span>
      )}
    </button>
  );
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function titleCaseLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPriorityLabel(priority: Project["priority"] | Todo["priority"]) {
  if (!priority) return null;
  return `${titleCaseLabel(priority)} priority`;
}

function formatRelativeDate(date: string | null | undefined) {
  const delta = daysUntil(date);
  if (delta == null) return null;
  if (delta < 0) return `${Math.abs(delta)}d late`;
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `Due in ${delta}d`;
}

function formatRecentLabel(date: string | null | undefined) {
  const delta = daysUntil(date ? new Date(date).toISOString() : null);
  if (delta == null) return null;
  if (delta === 0) return "Updated today";
  if (delta === -1) return "Updated yesterday";
  if (delta < 0) return `Updated ${Math.abs(delta)}d ago`;
  return `Updated in ${delta}d`;
}

function buildPulse(
  openCount: number,
  overdueCount: number,
  waitingCount: number,
  unplacedCount: number,
  progress: number,
): { tone: PulseTone; title: string; detail: string } {
  if (progress === 100 && openCount === 0) {
    return {
      tone: "done",
      title: "Wrapped",
      detail: "Everything in this project is complete.",
    };
  }

  if (overdueCount > 0) {
    return {
      tone: "risk",
      title: "Needs intervention",
      detail: `${pluralize(overdueCount, "overdue task")} are setting the pace right now.`,
    };
  }

  if (unplacedCount > 0) {
    return {
      tone: "focused",
      title: "Needs shaping",
      detail: `${pluralize(unplacedCount, "task")} still need a section before the project will feel crisp.`,
    };
  }

  if (waitingCount > 0) {
    return {
      tone: "focused",
      title: "Waiting on input",
      detail: `${pluralize(waitingCount, "task")} depend on someone else or an external reply.`,
    };
  }

  return {
    tone: "steady",
    title: "Steady momentum",
    detail: "The project has a clear working shape and no immediate pressure points.",
  };
}

function formatSortLabel(sortBy: SortField, sortOrder: SortOrder) {
  const fieldLabel =
    sortBy === "order"
      ? "manual order"
      : sortBy === "dueDate"
        ? "due date"
        : sortBy === "createdAt"
          ? "created"
          : sortBy === "priority"
            ? "priority"
            : "title";
  return `${fieldLabel} · ${sortOrder}`;
}

export function ProjectWorkspaceView({
  project,
  projectTodos,
  visibleTodos,
  loadState,
  errorMessage,
  activeTodoId,
  expandedTodoId,
  selectedIds,
  activeHeadingId,
  searchQuery,
  onSearchChange,
  onOpenNav,
  onClearProject,
  viewLabels,
  activeView,
  onNewTask,
  user,
  uiMode,
  quickEntryPlaceholder,
  onAddTodo,
  onCaptureToDesk,
  filtersOpen,
  onToggleFilters,
  activeFilters,
  onFilterChange,
  activeTagFilter,
  onClearTagFilter,
  bulkMode,
  onSelectAll,
  onBulkComplete,
  onBulkDelete,
  onCancelBulk,
  onSelectHeading,
  viewMode,
  onViewModeChange,
  onToggle,
  onTaskClick,
  onTaskOpen,
  onRetry,
  onSelect,
  onInlineEdit,
  onSave,
  onTagClick,
  onLifecycleAction,
  onReorder,
  sortBy,
  sortOrder,
  onSortChange,
}: Props) {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("overview");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const workspaceModeRef = useRef<WorkspaceMode>(workspaceMode);
  workspaceModeRef.current = workspaceMode;

  useViewSnapshot({
    capture: () => ({
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
      workspaceMode: workspaceModeRef.current,
    }),
    restore: (snapshot) => {
      if (
        snapshot.workspaceMode === "overview" ||
        snapshot.workspaceMode === "sections" ||
        snapshot.workspaceMode === "tasks"
      ) {
        setWorkspaceMode(snapshot.workspaceMode);
      }
      if (snapshot.scrollTop != null && snapshot.scrollTop > 0) {
        requestAnimationFrame(() => {
          scrollContainerRef.current?.scrollTo(0, snapshot.scrollTop);
        });
      }
    },
    version: 1,
  });

  const { headings, loading: headingsLoading, addHeading } = useProjectHeadings(
    project.id,
  );

  useEffect(() => {
    if (workspaceMode !== "tasks" && activeHeadingId) {
      onSelectHeading(null);
    }
  }, [workspaceMode, activeHeadingId, onSelectHeading]);

  const allProjectTodos = useMemo(
    () => projectTodos.filter((todo) => !todo.archived),
    [projectTodos],
  );
  const openTodos = useMemo(
    () => allProjectTodos.filter((todo) => !todo.completed),
    [allProjectTodos],
  );
  const completeCount = allProjectTodos.length - openTodos.length;
  const overdueTodos = useMemo(
    () => openTodos.filter((todo) => isOverdue(todo)),
    [openTodos],
  );
  const waitingTodos = useMemo(
    () => openTodos.filter((todo) => todo.status === "waiting" || !!todo.waitingOn),
    [openTodos],
  );
  const blockedTodos = useMemo(
    () => openTodos.filter((todo) => (todo.dependsOnTaskIds?.length ?? 0) > 0),
    [openTodos],
  );
  const unplacedTodos = useMemo(
    () => openTodos.filter((todo) => !todo.headingId),
    [openTodos],
  );
  const nextUp = useMemo(() => pickTopTasks(allProjectTodos), [allProjectTodos]);
  const sectionGroups = useMemo(
    () => buildSectionGroups(openTodos, headings),
    [openTodos, headings],
  );
  const recentlyChanged = useMemo(
    () =>
      [...allProjectTodos]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 4),
    [allProjectTodos],
  );
  const progress =
    allProjectTodos.length > 0
      ? Math.round((completeCount / allProjectTodos.length) * 100)
      : 0;
  const activeViewLabel = viewLabels[activeView] ?? "Tasks";
  const activeHeading = headings.find((heading) => heading.id === activeHeadingId) ?? null;
  const sectionStats = useMemo(() => {
    const stats = new Map<
      string,
      { total: number; complete: number; open: number; overdue: number; nextTask: Todo | null }
    >();

    for (const todo of allProjectTodos) {
      const key = todo.headingId ?? "__unplaced__";
      const entry = stats.get(key) ?? {
        total: 0,
        complete: 0,
        open: 0,
        overdue: 0,
        nextTask: null,
      };
      entry.total += 1;
      if (todo.completed) {
        entry.complete += 1;
      } else {
        entry.open += 1;
        if (isOverdue(todo)) entry.overdue += 1;
        if (!entry.nextTask) entry.nextTask = todo;
      }
      stats.set(key, entry);
    }

    return stats;
  }, [allProjectTodos]);
  const pulse = buildPulse(
    openTodos.length,
    overdueTodos.length,
    waitingTodos.length,
    unplacedTodos.length,
    progress,
  );
  const targetSummary = project.targetDate
    ? `${formatProjectDate(project.targetDate)} · ${formatRelativeDate(project.targetDate)}`
    : "No target date set";
  const updatedSummary = formatRecentLabel(project.updatedAt) ?? "Recently updated";
  const activeFilterCount =
    Number(activeFilters.dateFilter !== "all") +
    Number(Boolean(activeFilters.priority)) +
    Number(Boolean(activeFilters.status)) +
    Number(Boolean(searchQuery)) +
    Number(Boolean(activeTagFilter));
  const topSection = sectionGroups
    .map((group) => ({
      group,
      stats: sectionStats.get(group.heading?.id ?? "__unplaced__") ?? {
        total: 0,
        complete: 0,
        open: group.todos.length,
        overdue: group.todos.filter((todo) => isOverdue(todo)).length,
        nextTask: group.todos[0] ?? null,
      },
    }))
    .sort((a, b) => {
      if (b.stats.overdue !== a.stats.overdue) {
        return b.stats.overdue - a.stats.overdue;
      }
      return b.stats.open - a.stats.open;
    })[0];

  const openSection = (headingId: string | null) => {
    onSelectHeading(headingId);
    setWorkspaceMode("tasks");
  };

  return (
    <>
      {user && !user.isVerified && (
        <VerificationBanner email={user.email} isVerified={!!user.isVerified} />
      )}

      <div ref={scrollContainerRef} className="app-content project-workspace">
        <section className="project-workspace__hero">
          <div className="project-workspace__hero-top">
            <div className="project-workspace__crumbs">
              <button
                type="button"
                id="projectsRailMobileOpen"
                className="project-workspace__mobile-nav"
                onClick={onOpenNav}
                aria-label="Open navigation"
              >
                <IconMenu />
              </button>
              <Breadcrumb
                items={[
                  { label: activeViewLabel, onClick: onClearProject },
                  { label: project.name },
                ]}
              />
            </div>
            <button
              type="button"
              className="btn btn--primary"
              data-new-task-trigger="true"
              onClick={onNewTask}
            >
              <IconPlus /> New task
            </button>
          </div>

          <div className="project-workspace__hero-layout">
            <div className="project-workspace__hero-main">
              <div className="project-workspace__hero-copy">
                <span className="project-workspace__eyebrow">Project workspace</span>
                <h1 className="project-workspace__title">{project.name}</h1>
                <p className="project-workspace__summary">
                  {project.description?.trim() ||
                    "A dedicated place to review the shape of the work before dropping into task management."}
                </p>
                <div className="project-workspace__meta">
                  <span className="project-workspace__meta-pill">
                    <IconFolder size={13} className="app-icon" />
                    {titleCaseLabel(project.status)}
                  </span>
                  {project.priority && (
                    <span className="project-workspace__meta-pill">
                      <IconLightning size={13} className="app-icon" />
                      {formatPriorityLabel(project.priority)}
                    </span>
                  )}
                  {project.area && (
                    <span className="project-workspace__meta-pill">{project.area}</span>
                  )}
                  {project.targetDate && (
                    <span className="project-workspace__meta-pill">
                      <IconCalendar size={13} className="app-icon" />
                      Target {formatProjectDate(project.targetDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="project-workspace__metrics">
                <div className="project-workspace-metric">
                  <span className="project-workspace-metric__value">{openTodos.length}</span>
                  <span className="project-workspace-metric__label">Open</span>
                </div>
                <div className="project-workspace-metric">
                  <span className="project-workspace-metric__value">{completeCount}</span>
                  <span className="project-workspace-metric__label">Complete</span>
                </div>
                <div className="project-workspace-metric">
                  <span className="project-workspace-metric__value">{overdueTodos.length}</span>
                  <span className="project-workspace-metric__label">Overdue</span>
                </div>
                <div className="project-workspace-metric">
                  <span className="project-workspace-metric__value">{unplacedTodos.length}</span>
                  <span className="project-workspace-metric__label">Unplaced</span>
                </div>
              </div>

              <div className="project-workspace__progress">
                <div className="project-workspace__progress-copy">
                  <span className="project-workspace__progress-label">
                    Project momentum
                  </span>
                  <span className="project-workspace__progress-value">
                    {progress}% complete
                  </span>
                </div>
                <div className="project-workspace__progress-bar" aria-hidden="true">
                  <div
                    className="project-workspace__progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <aside className="project-workspace__hero-panel">
              <div
                className={`project-workspace__pulse project-workspace__pulse--${pulse.tone}`}
              >
                <span className="project-workspace__pulse-label">Project pulse</span>
                <strong className="project-workspace__pulse-title">{pulse.title}</strong>
                <p className="project-workspace__pulse-detail">{pulse.detail}</p>
              </div>

              <div className="project-workspace__hero-facts">
                <div className="project-workspace__hero-fact">
                  <span className="project-workspace__hero-fact-label">Target window</span>
                  <strong>{targetSummary}</strong>
                </div>
                <div className="project-workspace__hero-fact">
                  <span className="project-workspace__hero-fact-label">Sections in play</span>
                  <strong>{pluralize(sectionGroups.length, "section")}</strong>
                </div>
                <div className="project-workspace__hero-fact">
                  <span className="project-workspace__hero-fact-label">Freshness</span>
                  <strong>{updatedSummary}</strong>
                </div>
              </div>

              {nextUp[0] && (
                <div className="project-workspace__hero-focus">
                  <span className="project-workspace__hero-fact-label">Best next move</span>
                  <ProjectTaskPreview todo={nextUp[0]} onClick={onTaskClick} />
                </div>
              )}
            </aside>
          </div>

          <div className="project-workspace__hero-note">
            <span className="project-workspace__hero-note-item">
              <IconCheck size={13} className="app-icon" />
              {pluralize(completeCount, "task")} complete
            </span>
            <span className="project-workspace__hero-note-item">
              <IconTarget size={13} className="app-icon" />
              {topSection
                ? `${topSection.group.label} is the busiest section`
                : "No sections yet"}
            </span>
            <span className="project-workspace__hero-note-item">
              <IconRefresh size={13} className="app-icon" />
              {updatedSummary}
            </span>
          </div>
        </section>

        <div className="project-workspace__controls">
          <div className="project-workspace__controls-main">
            <SegmentedControl
              value={workspaceMode}
              onChange={(value) => setWorkspaceMode(value as WorkspaceMode)}
              ariaLabel="Project workspace mode"
              className="project-workspace__mode-toggle"
              options={WORKSPACE_MODES.map((mode) => ({
                value: mode.value,
                label: mode.label,
                badge:
                  mode.value === "sections"
                    ? sectionGroups.length
                    : mode.value === "tasks"
                      ? openTodos.length
                      : undefined,
              }))}
            />
            <p className="project-workspace__controls-note">
              {workspaceMode === "overview"
                ? "Read the shape of the work first."
                : workspaceMode === "sections"
                  ? "Use sections as chapters, not filters."
                  : "Switch into operational mode for sorting, filtering, and bulk work."}
            </p>
          </div>
          <div className="project-workspace__search">
            <SearchBar
              inputId="projectWorkspaceSearch"
              value={searchQuery}
              onChange={onSearchChange}
              shortcutHint="/"
            />
          </div>
        </div>

        {uiMode === "normal" && (
          <QuickEntry
            projectId={project.id}
            workspaceView={activeView}
            onAddTask={onAddTodo}
            onCaptureToDesk={onCaptureToDesk}
            placeholder={quickEntryPlaceholder}
          />
        )}

        {activeTagFilter && (
          <div className="active-filter-bar">
            Filtered by tag: <strong>#{activeTagFilter}</strong>
            <button
              className="active-filter-bar__clear"
              onClick={onClearTagFilter}
            >
              ✕ Clear
            </button>
          </div>
        )}

        {workspaceMode === "overview" && (
          <div className="project-workspace__stack">
            <div className="project-workspace__overview-grid">
              <section className="project-workspace-card project-workspace-card--focus">
                <div className="project-workspace-card__header">
                  <div>
                    <span className="project-workspace-card__eyebrow">Next up</span>
                    <h2 className="project-workspace-card__title">Strongest moves</h2>
                  </div>
                  <span className="project-workspace-card__badge">{nextUp.length}</span>
                </div>
                <p className="project-workspace-card__summary">
                  The shortest path to moving the project instead of just touching it.
                </p>
                <div className="project-workspace-card__body">
                  {nextUp.length === 0 ? (
                    <p className="project-workspace-card__empty">No active tasks yet.</p>
                  ) : (
                    nextUp.map((todo) => (
                      <ProjectTaskPreview
                        key={todo.id}
                        todo={todo}
                        onClick={onTaskClick}
                      />
                    ))
                  )}
                </div>
              </section>

              <section className="project-workspace-card project-workspace-card--risk">
                <div className="project-workspace-card__header">
                  <div>
                    <span className="project-workspace-card__eyebrow">Risks</span>
                    <h2 className="project-workspace-card__title">Pressure points</h2>
                  </div>
                </div>
                <div className="project-workspace-risk-list">
                  <div className="project-workspace-risk-item">
                    <span className="project-workspace-risk-item__icon">
                      <IconClock size={14} className="app-icon" />
                    </span>
                    <div>
                      <strong>{overdueTodos.length}</strong> overdue tasks
                    </div>
                  </div>
                  <div className="project-workspace-risk-item">
                    <span className="project-workspace-risk-item__icon">
                      <IconWaiting size={14} className="app-icon" />
                    </span>
                    <div>
                      <strong>{waitingTodos.length}</strong> waiting or blocked by others
                    </div>
                  </div>
                  <div className="project-workspace-risk-item">
                    <span className="project-workspace-risk-item__icon">
                      <IconTarget size={14} className="app-icon" />
                    </span>
                    <div>
                      <strong>{blockedTodos.length}</strong> dependency-heavy tasks
                    </div>
                  </div>
                </div>
                {overdueTodos.slice(0, 2).map((todo) => (
                  <ProjectTaskPreview
                    key={todo.id}
                    todo={todo}
                    onClick={onTaskClick}
                  />
                ))}
              </section>

              <section className="project-workspace-card project-workspace-card--cleanup">
                <div className="project-workspace-card__header">
                  <div>
                    <span className="project-workspace-card__eyebrow">Loose ends</span>
                    <h2 className="project-workspace-card__title">Cleanup queue</h2>
                  </div>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => openSection(null)}
                  >
                    Open in tasks
                  </button>
                </div>
                <p className="project-workspace-card__summary">
                  Unplaced work is usually where projects start to feel mushy.
                </p>
                <div className="project-workspace-card__body">
                  {unplacedTodos.length === 0 ? (
                    <p className="project-workspace-card__empty">
                      Everything has a section right now.
                    </p>
                  ) : (
                    unplacedTodos.slice(0, 4).map((todo) => (
                      <ProjectTaskPreview
                        key={todo.id}
                        todo={todo}
                        onClick={onTaskClick}
                      />
                    ))
                  )}
                </div>
              </section>
            </div>

            <section className="project-workspace-card project-workspace-card--chapters">
              <div className="project-workspace-card__header">
                <div>
                  <span className="project-workspace-card__eyebrow">Sections</span>
                  <h2 className="project-workspace-card__title">Chapter view</h2>
                </div>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => setWorkspaceMode("sections")}
                >
                  Open sections
                </button>
              </div>
              <div className="project-workspace-sections-grid">
                {sectionGroups.map((group) => {
                  const stats = sectionStats.get(group.heading?.id ?? "__unplaced__");
                  const total = stats?.total ?? group.todos.length;
                  const complete = stats?.complete ?? 0;
                  const completion = total > 0 ? Math.round((complete / total) * 100) : 0;
                  const nextTask = stats?.nextTask ?? null;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      className="project-workspace-section-card"
                      onClick={() => openSection(group.heading?.id ?? null)}
                    >
                      <div className="project-workspace-section-card__topline">
                        <span className="project-workspace-section-card__title">
                          {group.label}
                        </span>
                        <span className="project-workspace-section-card__count">
                          {pluralize(group.todos.length, "open task")}
                        </span>
                      </div>
                      <span className="project-workspace-section-card__meta">
                        {completion}% complete
                        {stats && stats.overdue > 0
                          ? ` · ${pluralize(stats.overdue, "overdue task")}`
                          : ""}
                      </span>
                      <div
                        className="project-workspace-section-card__progress"
                        aria-hidden="true"
                      >
                        <span
                          className="project-workspace-section-card__progress-fill"
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      <span className="project-workspace-section-card__next">
                        {nextTask ? `Next: ${nextTask.title}` : "No active tasks in this section."}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="project-workspace-card project-workspace-card--recent">
              <div className="project-workspace-card__header">
                <div>
                  <span className="project-workspace-card__eyebrow">Recent movement</span>
                  <h2 className="project-workspace-card__title">What changed lately</h2>
                </div>
              </div>
              <div className="project-workspace-card__body">
                {recentlyChanged.length === 0 ? (
                  <p className="project-workspace-card__empty">
                    No task changes yet inside this project.
                  </p>
                ) : (
                  recentlyChanged.map((todo) => (
                    <ProjectTaskPreview
                      key={todo.id}
                      todo={todo}
                      onClick={onTaskClick}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {workspaceMode === "sections" && (
          <div className="project-workspace__stack">
            <div className="project-workspace-sections-grid project-workspace-sections-grid--full">
              {sectionGroups.map((group) => {
                const stats = sectionStats.get(group.heading?.id ?? "__unplaced__");
                const total = stats?.total ?? group.todos.length;
                const complete = stats?.complete ?? 0;
                const completion = total > 0 ? Math.round((complete / total) * 100) : 0;
                return (
                  <section
                    key={group.key}
                    className="project-workspace-card project-workspace-card--section project-workspace-card--section-detail"
                  >
                    <div className="project-workspace-card__header">
                      <div>
                        <span className="project-workspace-card__eyebrow">Section</span>
                        <h2 className="project-workspace-card__title">{group.label}</h2>
                      </div>
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => openSection(group.heading?.id ?? null)}
                      >
                        Open tasks
                      </button>
                    </div>
                    <div className="project-workspace-card__summary">
                      {pluralize(group.todos.length, "open task")}
                      {stats && stats.overdue > 0
                        ? ` · ${pluralize(stats.overdue, "overdue task")}`
                        : ""}
                    </div>
                    <div
                      className="project-workspace-section-card__progress"
                      aria-hidden="true"
                    >
                      <span
                        className="project-workspace-section-card__progress-fill"
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                    <div className="project-workspace-section-card__meta">
                      {completion}% complete across {pluralize(total, "task")}
                    </div>
                    <div className="project-workspace-card__body">
                      {group.todos.length === 0 ? (
                        <p className="project-workspace-card__empty">No active tasks here.</p>
                      ) : (
                        group.todos.slice(0, 5).map((todo) => (
                          <ProjectTaskPreview
                            key={todo.id}
                            todo={todo}
                            onClick={onTaskClick}
                          />
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {workspaceMode === "tasks" && (
          <div className="project-workspace__stack">
            <div className="project-workspace-tasks-toolbar">
              <div className="project-workspace-tasks-toolbar__left">
                <div className="project-workspace-tasks-toolbar__title-block">
                  <span className="project-workspace-tasks-toolbar__label">
                    {activeHeading
                      ? `Working in ${activeHeading.name}`
                      : `${visibleTodos.filter((todo) => !todo.completed).length} active tasks`}
                  </span>
                  <span className="project-workspace-tasks-toolbar__meta">
                    {formatSortLabel(sortBy, sortOrder)}
                    {activeFilterCount > 0
                      ? ` · ${pluralize(activeFilterCount, "active filter")}`
                      : ""}
                  </span>
                </div>
                {activeHeading && (
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => onSelectHeading(null)}
                  >
                    Back to all sections
                  </button>
                )}
                <button
                  type="button"
                  id="moreFiltersToggle"
                  className={`btn${filtersOpen ? " btn--active" : ""}`}
                  onClick={onToggleFilters}
                >
                  Filters
                </button>
              </div>
              <SegmentedControl
                value={viewMode}
                onChange={(value) => onViewModeChange(value as ViewMode)}
                ariaLabel="Project task mode"
                iconOnly
                options={[
                  { value: "list", ariaLabel: "List view", icon: <IconList /> },
                  { value: "board", ariaLabel: "Board view", icon: <IconBoard /> },
                ]}
              />
            </div>

            {(activeHeading || activeFilterCount > 0) && (
              <div className="project-workspace__task-context">
                {activeHeading && (
                  <span className="project-workspace__task-context-pill">
                    Section: {activeHeading.name}
                  </span>
                )}
                {activeTagFilter && (
                  <span className="project-workspace__task-context-pill">
                    Tag: #{activeTagFilter}
                  </span>
                )}
                {activeFilters.priority && (
                  <span className="project-workspace__task-context-pill">
                    {formatPriorityLabel(activeFilters.priority)}
                  </span>
                )}
                {activeFilters.status && (
                  <span className="project-workspace__task-context-pill">
                    Status: {titleCaseLabel(activeFilters.status)}
                  </span>
                )}
                {activeFilters.dateFilter !== "all" && (
                  <span className="project-workspace__task-context-pill">
                    Date: {titleCaseLabel(activeFilters.dateFilter)}
                  </span>
                )}
                {searchQuery && (
                  <span className="project-workspace__task-context-pill">
                    Search: {searchQuery}
                  </span>
                )}
              </div>
            )}

            {filtersOpen && (
              <FilterPanel
                filters={activeFilters}
                onChange={onFilterChange}
                onClose={onToggleFilters}
              />
            )}

            {bulkMode && (
              <BulkToolbar
                selectedCount={selectedIds.size}
                totalCount={visibleTodos.length}
                allSelected={
                  selectedIds.size === visibleTodos.length && visibleTodos.length > 0
                }
                onSelectAll={onSelectAll}
                onComplete={onBulkComplete}
                onDelete={onBulkDelete}
                onCancel={onCancelBulk}
              />
            )}

            <ProjectHeadings
              headings={headings}
              loading={headingsLoading}
              activeHeadingId={activeHeadingId}
              onSelectHeading={onSelectHeading}
              onAddHeading={addHeading}
            />

            {viewMode === "board" ? (
              <div className="project-workspace__board-shell">
                <div className="project-workspace__board-header">
                  <span className="project-workspace__board-title">Task board</span>
                  <span className="project-workspace__board-meta">
                    Operational mode for status changes and broad scans across the project.
                  </span>
                </div>
                <Suspense
                  fallback={
                    <div className="project-workspace-card">
                      <p className="project-workspace-card__empty">
                        Loading board…
                      </p>
                    </div>
                  }
                >
                  <BoardView
                    todos={visibleTodos}
                    loadState={loadState}
                    onToggle={onToggle}
                    onClick={onTaskOpen}
                    onStatusChange={onSave}
                  />
                </Suspense>
              </div>
            ) : (
              <SortableTodoList
                todos={visibleTodos}
                loadState={loadState}
                errorMessage={errorMessage}
                activeTodoId={activeTodoId}
                expandedTodoId={expandedTodoId}
                isBulkMode={bulkMode}
                selectedIds={selectedIds}
                projects={[project]}
                headings={headings}
                onToggle={onToggle}
                onClick={onTaskClick}
                onKebab={onTaskOpen}
                onRetry={onRetry}
                onSelect={onSelect}
                onInlineEdit={onInlineEdit}
                onSave={onSave}
                onTagClick={onTagClick}
                onLifecycleAction={onLifecycleAction}
                onReorder={onReorder}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={onSortChange}
                groupByOptions={["none", "status", "priority", "dueDate"]}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
