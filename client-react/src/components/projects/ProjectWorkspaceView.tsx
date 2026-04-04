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
  IconClock,
  IconFolder,
  IconList,
  IconMenu,
  IconPlus,
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
  buildSnapshotItemsEnhanced,
  classifyProjectOverview,
  COMPLEXITY_LABELS,
  COMPLEXITY_STYLES,
  daysUntil,
  estimateTaskEffort,
  formatProjectDate,
  getEmptyStateGuidance,
  getEnhancedMetricsText,
  getTabDescription,
  getTaskNextReason,
  isOverdue,
  pickTopTasks,
  type ProjectOverviewProfile,
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
  onDeferTask?: (todo: Todo) => Promise<void>;
  onReplaceNext?: () => void;
}

function formatSectionName(name: string) {
  const normalized = name.trim().toLowerCase();
  if (["first", "new section", "untitled", ""].includes(normalized)) {
    return "Phase 1";
  }
  return name;
}

function ProjectTaskPreview({
  todo,
  onClick,
  effort,
}: {
  todo: Todo;
  onClick: (id: string) => void;
  effort?: { minutes: number; label: string };
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
      {effort && (
        <span className="project-workspace-task-preview__effort">
          {effort.label}
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

function buildOverviewTone(profile: ProjectOverviewProfile) {
  if (profile.showStarter) {
    return "Start with one real step and let the project grow from there.";
  }
  if (profile.mode === "simple") {
    return "A light project should feel easy to resume.";
  }
  if (profile.mode === "guided") {
    return "You have enough structure here to move confidently without overthinking it.";
  }
  return "This project has moving parts, but the overview should still bring you back in gently.";
}

function buildSnapshotItems(
  profile: ProjectOverviewProfile,
  progress: number,
  project: Project,
) {
  const items: Array<{ label: string; value: string }> = [
    {
      label: "Open",
      value: pluralize(profile.openTasks, "task"),
    },
  ];

  if (profile.completedTasks > 0 || profile.mode !== "simple") {
    items.push({
      label: "Progress",
      value: `${progress}% complete`,
    });
  }

  if (profile.showSectionsPreview) {
    items.push({
      label: "Sections",
      value: pluralize(profile.sectionsWithTasks || profile.headingsCount, "section"),
    });
  }

  if (project.targetDate) {
    items.push({
      label: "Target",
      value:
        formatRelativeDate(project.targetDate) ??
        formatProjectDate(project.targetDate) ??
        "Set",
    });
  } else if (profile.datedTasks > 0) {
    items.push({
      label: "Dates",
      value: pluralize(profile.datedTasks, "scheduled step", "scheduled steps"),
    });
  }

  return items.slice(0, 4);
}

function buildStarterCopy(profile: ProjectOverviewProfile) {
  if (profile.totalTasks === 0) {
    return {
      title: "Start with the first concrete step",
      body: "You do not need a full plan yet. Add the next real action and let the project take shape from there.",
      cta: "Add first task",
    };
  }

  return {
    title: "Keep this project lightweight",
    body: "A small project does not need a dashboard. Add the next couple of steps and only introduce sections if the work starts to branch.",
    cta: "Add next task",
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
  onDeferTask,
  onReplaceNext,
}: Props) {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("overview");
  const [insightsOpen, setInsightsOpen] = useState(false);
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

  useEffect(() => {
    setInsightsOpen(false);
  }, [project.id]);

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
  const overviewProfile = useMemo(
    () => classifyProjectOverview(allProjectTodos, headings),
    [allProjectTodos, headings],
  );

  // Set default workspace mode based on project complexity
  useEffect(() => {
    const defaultMode =
      overviewProfile.mode === "simple"
        ? "overview"
        : overviewProfile.mode === "guided"
          ? "sections"
          : "tasks";
    setWorkspaceMode(defaultMode as WorkspaceMode);
  }, [project.id, overviewProfile.mode]);
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
  const targetSummary = project.targetDate
    ? `${formatProjectDate(project.targetDate)} · ${formatRelativeDate(project.targetDate)}`
    : null;
  const activeFilterCount =
    Number(activeFilters.dateFilter !== "all") +
    Number(Boolean(activeFilters.priority)) +
    Number(Boolean(activeFilters.status)) +
    Number(Boolean(searchQuery)) +
    Number(Boolean(activeTagFilter));
  const snapshotItems = useMemo(
    () => buildSnapshotItemsEnhanced(overviewProfile, progress, project, allProjectTodos),
    [overviewProfile, progress, project, allProjectTodos],
  );
  const enhancedMetricsText = useMemo(
    () => getEnhancedMetricsText(overviewProfile, project, allProjectTodos),
    [overviewProfile, project, allProjectTodos],
  );
  const tabDescription = useMemo(
    () => getTabDescription(workspaceMode, overviewProfile),
    [workspaceMode, overviewProfile],
  );
  const starterCopy = useMemo(() => buildStarterCopy(overviewProfile), [overviewProfile]);
  const primaryTasks = useMemo(() => {
    const featuredId = nextUp[0]?.id;
    const ranked = nextUp.length > 0 ? nextUp : openTodos.slice(0, 4);
    const trimmed = featuredId
      ? ranked.filter((todo) => todo.id !== featuredId)
      : ranked;
    return trimmed.length > 0 ? trimmed : ranked.slice(0, 1);
  }, [nextUp, openTodos]);
  const insightTasks = useMemo(() => {
    const ranked = [...openTodos].sort((a, b) => {
      const overdueDelta = Number(isOverdue(b)) - Number(isOverdue(a));
      if (overdueDelta !== 0) return overdueDelta;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return ranked.slice(0, 3);
  }, [openTodos]);
  const sectionPreviewGroups = useMemo(() => sectionGroups.slice(0, 4), [sectionGroups]);

  const handleDeferTask = async (todo: Todo) => {
    if (!onDeferTask) return;
    await onDeferTask(todo);
  };

  const handleReplaceNext = () => {
    if (!onReplaceNext) return;
    onReplaceNext();
  };

  const nextTask = nextUp[0] ?? null;
  const nextTaskEffort = nextTask
    ? estimateTaskEffort(nextTask)
    : { minutes: 0, label: "" };
  const nextTaskReason = nextTask
    ? getTaskNextReason(nextTask, allProjectTodos)
    : "";

  const emptyState = useMemo(
    () => getEmptyStateGuidance(overviewProfile, project),
    [overviewProfile, project],
  );

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

          <div className="project-workspace__hero-copy">
            <span className="project-workspace__eyebrow">Project</span>
            <div className="project-workspace__title-row">
              <h1 className="project-workspace__title">{project.name}</h1>
              <div
                className="project-complexity-badge"
                style={{
                  background: COMPLEXITY_STYLES[overviewProfile.mode].background,
                  border: COMPLEXITY_STYLES[overviewProfile.mode].border,
                  color: COMPLEXITY_STYLES[overviewProfile.mode].color,
                }}
              >
                <span
                  className="project-complexity-badge__icon"
                  aria-hidden="true"
                >
                  {COMPLEXITY_STYLES[overviewProfile.mode].icon}
                </span>
                <span className="project-complexity-badge__label">
                  {COMPLEXITY_LABELS[overviewProfile.mode]}
                </span>
              </div>
            </div>
            <p className="project-workspace__summary">
              {project.description?.trim() ||
                "A bounded personal outcome with just enough structure to keep you moving."}
            </p>
            <p className="project-workspace__hero-support">
              {buildOverviewTone(overviewProfile)}
            </p>
            <div className="project-workspace__meta">
              <span className="project-workspace__meta-pill">
                <IconFolder size={13} className="app-icon" />
                {titleCaseLabel(project.status)}
              </span>
              {project.area && (
                <span className="project-workspace__meta-pill">{project.area}</span>
              )}
              {targetSummary && (
                <span className="project-workspace__meta-pill">
                  <IconCalendar size={13} className="app-icon" />
                  {targetSummary}
                </span>
              )}
              {(project.priority === "high" || project.priority === "urgent") && (
                <span className="project-workspace__meta-pill">
                  {formatPriorityLabel(project.priority)}
                </span>
              )}
            </div>
          </div>

          <div className="project-workspace__snapshot">
            {snapshotItems.map((item) => (
              <div
                key={item.label}
                className={`project-workspace__snapshot-item${item.actionable ? " project-workspace__snapshot-item--actionable" : ""}`}
              >
                <span className="project-workspace__snapshot-label">{item.label}</span>
                <strong className="project-workspace__snapshot-value">{item.value}</strong>
              </div>
            ))}
          </div>
          {enhancedMetricsText && (
            <div className="project-workspace__metrics-text">
              {enhancedMetricsText}
            </div>
          )}
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
              {tabDescription}
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
          <div className="project-workspace__overview">
            <section className="project-workspace-card project-workspace-card--next">
              <div className="project-workspace-card__header">
                <div>
                  <span className="project-workspace-card__eyebrow">Next up</span>
                  <h2 className="project-workspace-card__title">
                    {overviewProfile.showStarter ? "Start here" : "Resume with this"}
                  </h2>
                </div>
                <div className="project-workspace-card__next-effort">
                  <span className="project-workspace-card__next-effort-label">Est. effort</span>
                  <span className="project-workspace-card__next-effort-value">
                    {nextTaskEffort.label}
                  </span>
                </div>
              </div>
              <p className="project-workspace-card__summary">
                {overviewProfile.showStarter
                  ? starterCopy.body
                  : "One clear next step is more useful than a wall of insight."}
              </p>
              <div className="project-workspace-card__body">
                {overviewProfile.showStarter ? (
                  <div className="project-workspace__starter">
                    <strong className="project-workspace__starter-title">
                      {starterCopy.title}
                    </strong>
                    <p className="project-workspace-card__empty">{starterCopy.body}</p>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={onNewTask}
                    >
                      <IconPlus /> {starterCopy.cta}
                    </button>
                  </div>
                ) : (
                  <>
                    {nextUp[0] ? (
                      <>
                        <ProjectTaskPreview
                          todo={nextUp[0]}
                          effort={nextTaskEffort}
                          onClick={onTaskClick}
                        />
                        {nextTaskReason && (
                          <p className="project-workspace-card__next-reason">
                            {nextTaskReason}
                          </p>
                        )}
                        <div className="project-workspace-card__next-actions">
                          <button
                            type="button"
                            className="mini-btn mini-btn--ghost"
                            onClick={() => handleDeferTask(nextUp[0])}
                          >
                            Defer
                          </button>
                          <button
                            type="button"
                            className="mini-btn mini-btn--ghost"
                            onClick={handleReplaceNext}
                          >
                            Pick another
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="project-workspace-card__empty">
                        Add the next actionable step to get this project moving.
                      </p>
                    )}
                    {nextUp.length > 1 && (
                      <div className="project-workspace__secondary-list">
                        <span className="project-workspace__secondary-label">
                          After that
                        </span>
                        {nextUp.slice(1, 3).map((todo) => (
                          <ProjectTaskPreview
                            key={todo.id}
                            todo={todo}
                            onClick={onTaskClick}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            <section className="project-workspace-card project-workspace-card--primary">
              <div className="project-workspace-card__header">
                <div>
                  <span className="project-workspace-card__eyebrow">
                    {overviewProfile.primaryContent === "sections" ? "Plan" : "Tasks"}
                  </span>
                  <h2 className="project-workspace-card__title">
                    {overviewProfile.primaryContent === "sections"
                      ? "Sections at a glance"
                      : "Open tasks"}
                  </h2>
                </div>
                {overviewProfile.primaryContent === "sections" ? (
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setWorkspaceMode("sections")}
                  >
                    Open sections
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setWorkspaceMode("tasks")}
                  >
                    Open tasks
                  </button>
                )}
              </div>
              <p className="project-workspace-card__summary">
                {overviewProfile.primaryContent === "sections"
                  ? "See the shape of the work without dropping into full task management."
                  : "A compact preview of the work that is still in motion."}
              </p>
              <div className="project-workspace-card__body">
                {overviewProfile.primaryContent === "sections" ? (
                  <div className="project-workspace-sections-grid project-workspace-sections-grid--overview">
                    {sectionPreviewGroups.map((group) => {
                      const stats = sectionStats.get(group.heading?.id ?? "__unplaced__");
                      const total = stats?.total ?? group.todos.length;
                      const complete = stats?.complete ?? 0;
                      const completion =
                        total > 0 ? Math.round((complete / total) * 100) : 0;
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
                              {formatSectionName(group.label)}
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
                            {nextTask
                              ? `Next: ${nextTask.title}`
                              : "No active tasks in this section."}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : primaryTasks.length === 0 ? (
                  <p className="project-workspace-card__empty">
                    No active tasks yet. Add the first step and keep it light.
                  </p>
                ) : (
                  primaryTasks.map((todo) => (
                    <ProjectTaskPreview
                      key={todo.id}
                      todo={todo}
                      onClick={onTaskClick}
                    />
                  ))
                )}
              </div>
            </section>

            {overviewProfile.showInsights && (
              <section className="project-workspace-card project-workspace-card--insights">
                <div className="project-workspace-card__header">
                  <div>
                    <span className="project-workspace-card__eyebrow">Insights</span>
                    <h2 className="project-workspace-card__title">
                      Only when they help
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setInsightsOpen((value) => !value)}
                  >
                    {insightsOpen ? "Hide insights" : "Show insights"}
                  </button>
                </div>
                <p className="project-workspace-card__summary">
                  Richer signals stay tucked away until the project is complex enough to need them.
                </p>
                {insightsOpen && (
                  <div className="project-workspace-insights-grid">
                    {overviewProfile.showRiskInsights && (
                      <section className="project-workspace-insight-card">
                        <div className="project-workspace-insight-card__header">
                          <span className="project-workspace-card__eyebrow">
                            Needs attention
                          </span>
                        </div>
                        <div className="project-workspace-risk-list">
                          {overviewProfile.overdueTasks > 0 && (
                            <div className="project-workspace-risk-item">
                              <span className="project-workspace-risk-item__icon">
                                <IconClock size={14} className="app-icon" />
                              </span>
                              <div>
                                <strong>{overviewProfile.overdueTasks}</strong> overdue
                              </div>
                            </div>
                          )}
                          {overviewProfile.waitingTasks > 0 && (
                            <div className="project-workspace-risk-item">
                              <span className="project-workspace-risk-item__icon">
                                <IconWaiting size={14} className="app-icon" />
                              </span>
                              <div>
                                <strong>{overviewProfile.waitingTasks}</strong> waiting
                              </div>
                            </div>
                          )}
                        </div>
                        {insightTasks
                          .filter((todo) => isOverdue(todo) || todo.status === "waiting")
                          .slice(0, 2)
                          .map((todo) => (
                            <ProjectTaskPreview
                              key={todo.id}
                              todo={todo}
                              onClick={onTaskClick}
                            />
                          ))}
                      </section>
                    )}

                    {overviewProfile.showUnplacedInsights && (
                      <section className="project-workspace-insight-card">
                        <div className="project-workspace-insight-card__header">
                          <span className="project-workspace-card__eyebrow">
                            Needs structure
                          </span>
                          <button
                            type="button"
                            className="mini-btn"
                            onClick={() => openSection(null)}
                          >
                            Open tasks
                          </button>
                        </div>
                        <p className="project-workspace-card__summary">
                          {pluralize(
                            overviewProfile.unplacedTasks,
                            "task",
                          )} still sit outside a section.
                        </p>
                        {unplacedTodos.slice(0, 3).map((todo) => (
                          <ProjectTaskPreview
                            key={todo.id}
                            todo={todo}
                            onClick={onTaskClick}
                          />
                        ))}
                      </section>
                    )}

                    {overviewProfile.showRecentInsights && (
                      <section className="project-workspace-insight-card">
                        <div className="project-workspace-insight-card__header">
                          <span className="project-workspace-card__eyebrow">
                            Recent movement
                          </span>
                        </div>
                        <p className="project-workspace-card__summary">
                          What has changed lately across the project.
                        </p>
                        {recentlyChanged.map((todo) => (
                          <ProjectTaskPreview
                            key={todo.id}
                            todo={todo}
                            onClick={onTaskClick}
                          />
                        ))}
                      </section>
                    )}
                  </div>
                )}
              </section>
            )}
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
                        <h2 className="project-workspace-card__title">
                          {formatSectionName(group.label)}
                        </h2>
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
                        <div className="project-workspace-card__empty-guidance">
                          {group.key === "__unplaced__" ? (
                            <>
                              <p className="project-workspace-card__empty-title">
                                {emptyState.title}
                              </p>
                              <p className="project-workspace-card__empty-body">
                                {emptyState.body}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="project-workspace-card__empty-body" style={{ marginBottom: "8px" }}>
                                Ready for tasks.
                              </p>
                              <button
                                type="button"
                                className="mini-btn mini-btn--ghost"
                                onClick={() => {
                                  onSelectHeading(group.key);
                                  onNewTask();
                                }}
                              >
                                + Add task
                              </button>
                            </>
                          )}
                        </div>
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
            {overviewProfile.mode !== "simple" && (
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
            )}

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
