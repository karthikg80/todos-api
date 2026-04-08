/**
 * v1 project surface: single-page editor-first layout (replaces overview/sections/tasks tabs).
 * Tradeoffs: no drag-and-drop reorder in the inline list; board only when default view is "board" (localStorage).
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CreateTodoDto,
  Project,
  Todo,
  UpdateTodoDto,
  User,
} from "../../types";
import type { LoadState } from "../../store/useTodosStore";
import type { SortField, SortOrder, ViewMode } from "../../types/viewTypes";
import type { ActiveFilters } from "../todos/FilterPanel";
import { Breadcrumb } from "../shared/Breadcrumb";
import { IconMenu } from "../shared/Icons";
import { VerificationBanner } from "../shared/VerificationBanner";
import { SearchBar } from "../shared/SearchBar";
import { BulkToolbar } from "../todos/BulkToolbar";
import { FilterPanel } from "../todos/FilterPanel";
import { QuickEntry } from "../todos/QuickEntry";
import { useProjectHeadings } from "../../hooks/useProjectHeadings";
import { pickTopTasks } from "./projectWorkspaceModels";
import {
  buildProjectEditorStats,
  fromDateInputValue,
  readDefaultView,
  toDateInputValue,
  writeDefaultView,
  type ProjectEditorDefaultView,
} from "./projectEditorModels";
import { ProjectEditorHeader } from "./ProjectEditorHeader";
import { ProjectEditorSettingsCard } from "./ProjectEditorSettingsCard";
import { ProjectEditorRail } from "./ProjectEditorRail";
import { ProjectNextActionCard } from "./ProjectNextActionCard";
import { ProjectInlineTaskList } from "./ProjectInlineTaskList";
import "../../styles/project-editor.css";

const BoardView = lazy(() =>
  import("../todos/BoardView").then((m) => ({ default: m.BoardView })),
);

type UiMode = "normal" | "simple";

export interface ProjectSavePayload {
  name?: string;
  description?: string | null;
  goal?: string | null;
  targetDate?: string | null;
  status?: Project["status"];
}

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
  onSaveProject: (id: string, payload: ProjectSavePayload) => Promise<void>;
  onArchiveProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onRequestDeleteTodo: (id: string) => void;
}

function titleCaseLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ProjectEditorView({
  project,
  projectTodos,
  visibleTodos,
  loadState,
  errorMessage,
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
  viewMode: _viewMode,
  onViewModeChange: _onViewModeChange,
  onToggle,
  onTaskClick: _onTaskClick,
  onTaskOpen,
  onRetry,
  onSelect,
  onInlineEdit: _onInlineEdit,
  onSave,
  onTagClick: _onTagClick,
  onLifecycleAction: _onLifecycleAction,
  onReorder: _onReorder,
  sortBy: _sortBy,
  sortOrder: _sortOrder,
  onSortChange: _onSortChange,
  activeTodoId: _activeTodoId,
  expandedTodoId: _expandedTodoId,
  onDeferTask,
  onReplaceNext,
  onSaveProject,
  onArchiveProject,
  onDeleteProject,
  onRequestDeleteTodo,
}: Props) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [goal, setGoal] = useState(project.goal ?? "");
  const [targetDate, setTargetDate] = useState(
    toDateInputValue(project.targetDate),
  );
  const [projectStatus, setProjectStatus] = useState<Project["status"]>(
    project.status,
  );
  const [savingProject, setSavingProject] = useState(false);
  const [defaultView, setDefaultView] = useState<ProjectEditorDefaultView>(() =>
    readDefaultView(project.id),
  );
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddHeadingId, setQuickAddHeadingId] = useState<string | null>(
    null,
  );

  const { headings, addHeading } = useProjectHeadings(project.id);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setGoal(project.goal ?? "");
    setTargetDate(toDateInputValue(project.targetDate));
    setProjectStatus(project.status);
  }, [
    project.id,
    project.updatedAt,
    project.name,
    project.description,
    project.goal,
    project.targetDate,
    project.status,
  ]);

  useEffect(() => {
    setDefaultView(readDefaultView(project.id));
  }, [project.id]);

  const handleDefaultViewChange = useCallback(
    (v: ProjectEditorDefaultView) => {
      setDefaultView(v);
      writeDefaultView(project.id, v);
    },
    [project.id],
  );

  const projectDirty = useMemo(() => {
    const desc = description.trim() || null;
    const gl = goal.trim() || null;
    const prevDesc = project.description?.trim() || null;
    const prevGoal = project.goal?.trim() || null;
    return (
      name.trim() !== project.name.trim() ||
      desc !== prevDesc ||
      gl !== prevGoal ||
      targetDate !== toDateInputValue(project.targetDate) ||
      projectStatus !== project.status
    );
  }, [
    name,
    description,
    goal,
    targetDate,
    projectStatus,
    project.name,
    project.description,
    project.goal,
    project.targetDate,
    project.status,
  ]);

  const allProjectTodos = useMemo(
    () => projectTodos.filter((t) => !t.archived && t.projectId === project.id),
    [projectTodos, project.id],
  );

  const stats = useMemo(
    () => buildProjectEditorStats(allProjectTodos),
    [allProjectTodos],
  );

  const nextUp = useMemo(
    () => pickTopTasks(allProjectTodos),
    [allProjectTodos],
  );
  const nextTask = nextUp[0] ?? null;

  const handleSaveProject = async () => {
    setSavingProject(true);
    try {
      await onSaveProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        goal: goal.trim() || null,
        targetDate: fromDateInputValue(targetDate),
        status: projectStatus,
      });
    } finally {
      setSavingProject(false);
    }
  };

  const handleQuickAdd = async () => {
    const t = quickAddTitle.trim();
    if (!t) return;
    await onAddTodo({
      title: t,
      projectId: project.id,
      headingId: quickAddHeadingId,
    });
    setQuickAddTitle("");
  };

  const activeFilterCount =
    Number(activeFilters.dateFilter !== "all") +
    Number(Boolean(activeFilters.priority)) +
    Number(Boolean(activeFilters.status)) +
    Number(Boolean(searchQuery)) +
    Number(Boolean(activeTagFilter));

  const activeViewLabel = viewLabels[activeView] ?? "Tasks";

  const showBoard = defaultView === "board";

  if (loadState === "loading" && allProjectTodos.length === 0) {
    return (
      <div className="app-content project-editor">
        <div className="project-editor__load">Loading project…</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="app-content project-editor">
        <div className="project-editor__error">{errorMessage}</div>
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {user && !user.isVerified && (
        <VerificationBanner email={user.email} isVerified={!!user.isVerified} />
      )}

      <div className="app-content project-editor">
        <div className="project-editor__toolbar">
          <div
            className="project-workspace__crumbs"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
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
        </div>

        <section className="project-editor__header-card">
          <div className="project-editor__header-grid">
            <ProjectEditorHeader
              project={{
                ...project,
                name,
                description,
                goal,
                status: projectStatus,
              }}
              name={name}
              onNameChange={setName}
              description={description}
              onDescriptionChange={setDescription}
              stats={stats}
              titleInputRef={titleInputRef}
              onRenameMenu={() => titleInputRef.current?.focus()}
              onArchiveProject={() => onArchiveProject(project.id)}
              onDeleteProject={() => onDeleteProject(project.id)}
            />
            <ProjectEditorSettingsCard
              goal={goal}
              onGoalChange={setGoal}
              targetDate={targetDate}
              onTargetDateChange={setTargetDate}
              projectStatus={projectStatus}
              onProjectStatusChange={setProjectStatus}
              defaultView={defaultView}
              onDefaultViewChange={handleDefaultViewChange}
              projectDirty={projectDirty}
              saving={savingProject}
              onSaveProject={handleSaveProject}
              onArchiveProject={() => onArchiveProject(project.id)}
            />
          </div>
        </section>

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
              type="button"
              className="active-filter-bar__clear"
              onClick={onClearTagFilter}
            >
              ✕ Clear
            </button>
          </div>
        )}

        <div className="project-editor__toolbar">
          <div className="project-editor__toolbar-actions">
            <button
              type="button"
              id="projectEditorFiltersToggle"
              className={`btn${filtersOpen ? " btn--active" : ""}`}
              onClick={onToggleFilters}
            >
              Filters
            </button>
            <div
              className="project-editor__toolbar-meta"
              title="Preferred task layout for this project (local only)"
            >
              <IconMenu size={16} className="app-icon" aria-hidden />
              <span className="project-editor__field-label">Layout</span>
              <span className="project-editor__pill">
                {defaultView === "board"
                  ? "Board"
                  : defaultView === "list"
                    ? "List"
                    : "Editor"}
              </span>
            </div>
          </div>
        </div>

        {(activeHeadingId || activeFilterCount > 0) && (
          <div className="project-editor__context-bar">
            {activeHeadingId && (
              <span className="project-editor__context-pill">
                Section filter active
              </span>
            )}
            {activeTagFilter && (
              <span className="project-editor__context-pill">
                Tag: #{activeTagFilter}
              </span>
            )}
            {activeFilters.priority && (
              <span className="project-editor__context-pill">
                Priority: {activeFilters.priority}
              </span>
            )}
            {activeFilters.status && (
              <span className="project-editor__context-pill">
                Status: {titleCaseLabel(activeFilters.status)}
              </span>
            )}
            {activeFilters.dateFilter !== "all" && (
              <span className="project-editor__context-pill">
                Date: {titleCaseLabel(activeFilters.dateFilter)}
              </span>
            )}
            {searchQuery && (
              <span className="project-editor__context-pill">
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
              selectedIds.size === visibleTodos.length &&
              visibleTodos.length > 0
            }
            onSelectAll={onSelectAll}
            onComplete={onBulkComplete}
            onDelete={onBulkDelete}
            onCancel={onCancelBulk}
          />
        )}

        <div className="project-editor__body">
          <div className="project-editor__rail-stack">
            <ProjectEditorRail
              headings={headings}
              projectTodos={allProjectTodos}
              activeHeadingId={activeHeadingId}
              onSelectHeading={onSelectHeading}
              onAddHeading={addHeading}
            />
          </div>

          <div className="project-editor__main-stack">
            <ProjectNextActionCard
              nextTask={nextTask}
              projectTodos={allProjectTodos}
              onSave={onSave}
              onDeferTask={onDeferTask}
              onReplaceNext={onReplaceNext}
            />

            {showBoard ? (
              <section className="project-editor__panel">
                <div className="project-editor__toolbar">
                  <h2 className="project-editor__rail-title">Board</h2>
                  <p className="project-editor__field-label">
                    Status-focused view (v1: no inline edit grid here).
                  </p>
                </div>
                <Suspense
                  fallback={
                    <div className="project-editor__load">Loading board…</div>
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
              </section>
            ) : (
              <ProjectInlineTaskList
                projectId={project.id}
                headings={headings}
                visibleTodos={visibleTodos}
                searchQuery={searchQuery}
                onSearchChange={onSearchChange}
                onNewTask={onNewTask}
                selectedIds={selectedIds}
                isBulkMode={bulkMode}
                onSelect={onSelect}
                onSave={onSave}
                onAddTodo={onAddTodo}
                onRequestDeleteTodo={onRequestDeleteTodo}
                quickAddTitle={quickAddTitle}
                onQuickAddTitleChange={setQuickAddTitle}
                quickAddHeadingId={quickAddHeadingId}
                onQuickAddHeadingChange={setQuickAddHeadingId}
                onQuickAddSubmit={() => void handleQuickAdd()}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
