import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CreateTodoDto,
  Heading,
  Project,
  Todo,
  UpdateTodoDto,
  User,
} from "../../types";
import type { LoadState } from "../../store/useTodosStore";
import type { SortField, SortOrder, ViewMode } from "../../types/viewTypes";
import type { ActiveFilters } from "../todos/FilterPanel";
import { Breadcrumb } from "../shared/Breadcrumb";
import {
  IconGrip,
  IconKebab,
  IconMenu,
  IconPlus,
} from "../shared/Icons";
import { VerificationBanner } from "../shared/VerificationBanner";
import { BulkToolbar } from "../todos/BulkToolbar";
import { ProjectKebabMenu } from "./ProjectKebabMenu";
import { useProjectHeadings } from "../../hooks/useProjectHeadings";
import {
  formatDueFriendly,
  fromDateInputValue,
  projectStatusLabel,
  toDateInputValue,
} from "./projectEditorModels";
import "../../styles/project-editor.css";

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

type FlatItem =
  | {
      id: string;
      sortableId: string;
      kind: "heading";
      heading: Heading;
      parentHeadingId: string | null;
    }
  | {
      id: string;
      sortableId: string;
      kind: "todo";
      todo: Todo;
      parentHeadingId: string | null;
    };

function sortByOrder<T extends { order?: number; sortOrder?: number; createdAt?: string }>(
  items: T[],
  orderKey: "order" | "sortOrder",
) {
  return [...items].sort((a, b) => {
    const aOrder = orderKey === "order" ? (a.order ?? 0) : (a.sortOrder ?? 0);
    const bOrder = orderKey === "order" ? (b.order ?? 0) : (b.sortOrder ?? 0);
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
  });
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function buildFlatItems(headings: Heading[], todos: Todo[]) {
  const sortedHeadings = sortByOrder(headings, "sortOrder");
  const sortedTodos = sortByOrder(todos, "order");
  const todosByHeading = new Map<string | null, Todo[]>();

  for (const todo of sortedTodos) {
    const key = todo.headingId ?? null;
    const existing = todosByHeading.get(key) ?? [];
    existing.push(todo);
    todosByHeading.set(key, existing);
  }

  const flat: FlatItem[] = [];
  for (const todo of todosByHeading.get(null) ?? []) {
    flat.push({
      id: todo.id,
      sortableId: `todo:${todo.id}`,
      kind: "todo",
      todo,
      parentHeadingId: null,
    });
  }

  for (const heading of sortedHeadings) {
    flat.push({
      id: heading.id,
      sortableId: `heading:${heading.id}`,
      kind: "heading",
      heading,
      parentHeadingId: null,
    });

    for (const todo of todosByHeading.get(heading.id) ?? []) {
      flat.push({
        id: todo.id,
        sortableId: `todo:${todo.id}`,
        kind: "todo",
        todo,
        parentHeadingId: heading.id,
      });
    }
  }

  return {
    sortedHeadings,
    sortedTodos,
    flatItems: flat,
    backlogTodos: todosByHeading.get(null) ?? [],
    todosByHeading,
  };
}

function SortableRow({
  id,
  className,
  children,
}: {
  id: string;
  className: string;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        className="project-page__drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <IconGrip size={14} />
      </button>
      {children}
    </div>
  );
}

function RowMenu({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="project-page__menu">
      <button
        type="button"
        className="project-page__icon-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={onToggle}
      >
        <IconKebab size={14} />
      </button>
      {open ? <div className="project-page__menu-panel">{children}</div> : null}
    </div>
  );
}

export function ProjectEditorView({
  project,
  projectTodos,
  visibleTodos: _visibleTodos,
  loadState,
  errorMessage,
  selectedIds,
  onOpenNav,
  onClearProject,
  viewLabels,
  activeView,
  user,
  bulkMode,
  onSelectAll,
  onBulkComplete,
  onBulkDelete,
  onCancelBulk,
  onToggle,
  onTaskOpen,
  onRetry,
  onSelect,
  onSave,
  onReorder,
  onSaveProject,
  onArchiveProject,
  onDeleteProject,
  onRequestDeleteTodo,
  onAddTodo,
  activeTodoId: _activeTodoId,
  expandedTodoId: _expandedTodoId,
  activeHeadingId: _activeHeadingId,
  searchQuery: _searchQuery,
  onSearchChange: _onSearchChange,
  onNewTask: _onNewTask,
  uiMode: _uiMode,
  quickEntryPlaceholder: _quickEntryPlaceholder,
  onCaptureToDesk: _onCaptureToDesk,
  filtersOpen: _filtersOpen,
  onToggleFilters: _onToggleFilters,
  activeFilters: _activeFilters,
  onFilterChange: _onFilterChange,
  activeTagFilter: _activeTagFilter,
  onClearTagFilter: _onClearTagFilter,
  onSelectHeading: _onSelectHeading,
  viewMode: _viewMode,
  onViewModeChange: _onViewModeChange,
  onTaskClick: _onTaskClick,
  onInlineEdit: _onInlineEdit,
  onTagClick: _onTagClick,
  onLifecycleAction: _onLifecycleAction,
  sortBy: _sortBy,
  sortOrder: _sortOrder,
  onSortChange: _onSortChange,
  onDeferTask: _onDeferTask,
  onReplaceNext: _onReplaceNext,
}: Props) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const quickAddInputRef = useRef<HTMLInputElement>(null);
  const headingInputRef = useRef<HTMLInputElement>(null);

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
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [quickAddHeadingId, setQuickAddHeadingId] = useState<string | null>(
    null,
  );
  const [headingDraftOpen, setHeadingDraftOpen] = useState(false);
  const [headingDraft, setHeadingDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { headings, addHeading, reorderHeadings } = useProjectHeadings(project.id);

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
    setOpenMenuId(null);
    setHeadingDraftOpen(false);
    setQuickAddHeadingId(null);
  }, [project.id]);

  const projectDirty = useMemo(() => {
    const nextDescription = description.trim() || null;
    const nextGoal = goal.trim() || null;
    const previousDescription = project.description?.trim() || null;
    const previousGoal = project.goal?.trim() || null;

    return (
      name.trim() !== project.name.trim() ||
      nextDescription !== previousDescription ||
      nextGoal !== previousGoal ||
      targetDate !== toDateInputValue(project.targetDate) ||
      projectStatus !== project.status
    );
  }, [
    description,
    goal,
    name,
    project.description,
    project.goal,
    project.name,
    project.status,
    project.targetDate,
    projectStatus,
    targetDate,
  ]);

  const allProjectTodos = useMemo(
    () =>
      projectTodos.filter((todo) => !todo.archived && todo.projectId === project.id),
    [project.id, projectTodos],
  );

  const { sortedHeadings, sortedTodos, flatItems, backlogTodos, todosByHeading } =
    useMemo(() => buildFlatItems(headings, allProjectTodos), [allProjectTodos, headings]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeViewLabel = viewLabels[activeView] ?? "Projects";
  const showStandaloneTasksLabel = sortedHeadings.length === 0;
  const showBacklogLabel = backlogTodos.length > 0 && sortedHeadings.length > 0;

  const handleSaveProject = useCallback(async () => {
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
  }, [
    description,
    goal,
    name,
    onSaveProject,
    project.id,
    projectStatus,
    targetDate,
  ]);

  const handleQuickAdd = useCallback(async () => {
    const title = quickAddTitle.trim();
    if (!title) return;

    await onAddTodo({
      title,
      projectId: project.id,
      headingId: quickAddHeadingId,
    });

    setQuickAddTitle("");
  }, [onAddTodo, project.id, quickAddHeadingId, quickAddTitle]);

  const handleCreateHeading = useCallback(async () => {
    const nextName = headingDraft.trim();
    if (!nextName) return;

    const created = await addHeading(nextName);
    if (!created) return;

    setHeadingDraft("");
    setHeadingDraftOpen(false);
    setQuickAddHeadingId(created.id);
  }, [addHeading, headingDraft]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeItem = flatItems.find((item) => item.sortableId === active.id);
      const overItem = flatItems.find((item) => item.sortableId === over.id);
      if (!activeItem || !overItem) return;

      if (activeItem.kind === "heading") {
        const currentIndex = sortedHeadings.findIndex(
          (heading) => heading.id === activeItem.heading.id,
        );
        const targetHeadingId =
          overItem.kind === "heading" ? overItem.heading.id : overItem.parentHeadingId;

        if (!targetHeadingId) return;

        const targetIndex = sortedHeadings.findIndex(
          (heading) => heading.id === targetHeadingId,
        );

        if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) {
          return;
        }

        await reorderHeadings(moveItem(sortedHeadings, currentIndex, targetIndex));
        return;
      }

      const flatWithoutActive = flatItems.filter(
        (item) => item.sortableId !== activeItem.sortableId,
      );
      const overIndex = flatWithoutActive.findIndex(
        (item) => item.sortableId === overItem.sortableId,
      );

      if (overIndex < 0) return;

      const insertIndex =
        overItem.kind === "heading" ? overIndex + 1 : overIndex;
      const reorderedFlat = [
        ...flatWithoutActive.slice(0, insertIndex),
        activeItem,
        ...flatWithoutActive.slice(insertIndex),
      ];

      const nextHeading =
        [...reorderedFlat]
          .slice(0, reorderedFlat.findIndex((item) => item.id === activeItem.id))
          .reverse()
          .find((item) => item.kind === "heading") ?? null;

      const nextHeadingId =
        nextHeading && nextHeading.kind === "heading" ? nextHeading.heading.id : null;
      const oldTodoIds = sortedTodos.map((todo) => todo.id);
      const reorderedTodoIds = reorderedFlat
        .filter((item): item is Extract<FlatItem, { kind: "todo" }> => item.kind === "todo")
        .map((item) => item.todo.id);
      const previousIndex = oldTodoIds.indexOf(activeItem.todo.id);
      const nextIndex = reorderedTodoIds.indexOf(activeItem.todo.id);

      if (nextHeadingId !== (activeItem.todo.headingId ?? null)) {
        await onSave(activeItem.todo.id, { headingId: nextHeadingId });
      }

      if (previousIndex === nextIndex || nextIndex < 0) return;

      const overTodoId = oldTodoIds[nextIndex];
      if (!overTodoId || overTodoId === activeItem.todo.id) return;

      onReorder(activeItem.todo.id, overTodoId);
    },
    [flatItems, onReorder, onSave, reorderHeadings, sortedHeadings, sortedTodos],
  );

  if (loadState === "loading" && sortedTodos.length === 0) {
    return (
      <div className="app-content project-page">
        <div className="project-page__state">Loading project…</div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="app-content project-page">
        <div className="project-page__state">{errorMessage}</div>
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {user && !user.isVerified ? (
        <VerificationBanner email={user.email} isVerified={!!user.isVerified} />
      ) : null}

      <div className="app-content project-page">
        <div className="project-page__topbar">
          <div className="project-page__crumbs">
            <button
              type="button"
              id="projectsRailMobileOpen"
              className="project-page__icon-btn"
              onClick={onOpenNav}
              aria-label="Open navigation"
            >
              <IconMenu size={18} />
            </button>
            <Breadcrumb
              items={[
                { label: activeViewLabel, onClick: onClearProject },
                { label: project.name },
              ]}
            />
          </div>

          <div className="project-page__topbar-actions">
            <button
              type="button"
              className="project-page__icon-btn"
              aria-label="Project settings"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <IconMenu size={18} />
            </button>
            <ProjectKebabMenu
              onRename={() => titleInputRef.current?.focus()}
              onArchive={() => onArchiveProject(project.id)}
              onDelete={() => onDeleteProject(project.id)}
            />
          </div>
        </div>

        <header className="project-page__header">
          <input
            ref={titleInputRef}
            className="project-page__title"
            aria-label="Project name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (projectDirty) {
                void handleSaveProject();
              }
            }}
          />
          <div className="project-page__header-meta">
            <span className="project-page__meta-pill">
              {projectStatusLabel(projectStatus)}
            </span>
            {projectDirty ? (
              <span className="project-page__meta-pill project-page__meta-pill--accent">
                Unsaved
              </span>
            ) : null}
          </div>
        </header>

        {settingsOpen ? (
          <section className="project-page__settings">
            <label className="project-page__field">
              <span className="project-page__field-label">Description</span>
              <textarea
                className="project-page__textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this project is about"
              />
            </label>
            <label className="project-page__field">
              <span className="project-page__field-label">Goal</span>
              <textarea
                className="project-page__textarea"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="What done looks like"
              />
            </label>
            <label className="project-page__field">
              <span className="project-page__field-label">Target date</span>
              <input
                type="date"
                className="project-page__input"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </label>
            <label className="project-page__field">
              <span className="project-page__field-label">Status</span>
              <select
                className="project-page__input"
                value={projectStatus}
                onChange={(event) =>
                  setProjectStatus(event.target.value as Project["status"])
                }
              >
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <div className="project-page__settings-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void handleSaveProject()}
                disabled={!projectDirty || savingProject}
              >
                {savingProject ? "Saving…" : "Save project"}
              </button>
            </div>
          </section>
        ) : null}

        {bulkMode ? (
          <BulkToolbar
            selectedCount={selectedIds.size}
            totalCount={sortedTodos.length}
            allSelected={
              selectedIds.size === sortedTodos.length && sortedTodos.length > 0
            }
            onSelectAll={onSelectAll}
            onComplete={onBulkComplete}
            onDelete={onBulkDelete}
            onCancel={onCancelBulk}
          />
        ) : null}

        <section className="project-page__composer">
          <input
            ref={quickAddInputRef}
            type="text"
            className="project-page__quick-add"
            value={quickAddTitle}
            placeholder={
              quickAddHeadingId
                ? `Add a task to ${
                    headings.find((heading) => heading.id === quickAddHeadingId)?.name ??
                    "section"
                  }`
                : "Add a task"
            }
            onChange={(event) => setQuickAddTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleQuickAdd();
              }
            }}
          />
          <button
            type="button"
            className="project-page__icon-btn"
            aria-label="Add heading"
            onClick={() => {
              setHeadingDraftOpen((open) => !open);
              setOpenMenuId(null);
              requestAnimationFrame(() => headingInputRef.current?.focus());
            }}
          >
            <IconPlus size={16} />
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void handleQuickAdd()}
          >
            Add
          </button>
        </section>

        {headingDraftOpen ? (
          <section className="project-page__heading-draft">
            <input
              ref={headingInputRef}
              type="text"
              className="project-page__input"
              value={headingDraft}
              placeholder="New heading"
              onChange={(event) => setHeadingDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleCreateHeading();
                }
              }}
            />
            <button
              type="button"
              className="btn"
              onClick={() => void handleCreateHeading()}
            >
              Create heading
            </button>
          </section>
        ) : null}

        <section className="project-page__list-shell">
          {sortedTodos.length === 0 && sortedHeadings.length === 0 ? (
            <div className="project-page__empty">
              No headings or tasks yet. Start with a task or add a heading.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => void handleDragEnd(event)}
            >
              <SortableContext
                items={flatItems.map((item) => item.sortableId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="project-page__list">
                  {showStandaloneTasksLabel ? (
                    <div className="project-page__section-label">Tasks</div>
                  ) : null}

                  {showBacklogLabel ? (
                    <div className="project-page__section-label">Backlog</div>
                  ) : null}

                  {backlogTodos.map((todo) => {
                    const menuId = `todo:${todo.id}`;
                    const dueLabel = formatDueFriendly(todo.dueDate);

                    return (
                      <SortableRow
                        key={menuId}
                        id={menuId}
                        className="project-page__task-row"
                      >
                        <label className="project-page__task-check">
                          <input
                            type="checkbox"
                            checked={bulkMode ? selectedIds.has(todo.id) : todo.completed}
                            onChange={() =>
                              bulkMode
                                ? onSelect(todo.id)
                                : onToggle(todo.id, !todo.completed)
                            }
                            aria-label={
                              bulkMode ? `Select ${todo.title}` : `Complete ${todo.title}`
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className={`project-page__task-title${
                            todo.completed ? " project-page__task-title--done" : ""
                          }`}
                          onClick={() => onTaskOpen(todo.id)}
                        >
                          {todo.title}
                        </button>
                        {todo.dueDate ? (
                          <span className="project-page__task-meta">{dueLabel}</span>
                        ) : null}
                        <RowMenu
                          label="Task actions"
                          open={openMenuId === menuId}
                          onToggle={() =>
                            setOpenMenuId((current) => (current === menuId ? null : menuId))
                          }
                        >
                          <button type="button" onClick={() => onTaskOpen(todo.id)}>
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => onRequestDeleteTodo(todo.id)}
                          >
                            Delete
                          </button>
                        </RowMenu>
                      </SortableRow>
                    );
                  })}

                  {sortedHeadings.map((heading) => {
                    const headingTodos = todosByHeading.get(heading.id) ?? [];
                    const headingMenuId = `heading:${heading.id}`;

                    return (
                      <div key={heading.id} className="project-page__section">
                        <SortableRow
                          id={headingMenuId}
                          className="project-page__heading-row"
                        >
                          <div className="project-page__heading-copy">
                            <h2 className="project-page__heading-title">{heading.name}</h2>
                            <span className="project-page__heading-count">
                              {headingTodos.length}
                            </span>
                          </div>
                          <RowMenu
                            label="Heading actions"
                            open={openMenuId === headingMenuId}
                            onToggle={() =>
                              setOpenMenuId((current) =>
                                current === headingMenuId ? null : headingMenuId,
                              )
                            }
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setQuickAddHeadingId(heading.id);
                                setOpenMenuId(null);
                                quickAddInputRef.current?.focus();
                              }}
                            >
                              Add task here
                            </button>
                          </RowMenu>
                        </SortableRow>

                        {headingTodos.length === 0 ? (
                          <div className="project-page__section-empty">
                            Empty heading. Drop a task here or add one from the menu.
                          </div>
                        ) : null}

                        {headingTodos.map((todo) => {
                          const menuId = `todo:${todo.id}`;
                          const dueLabel = formatDueFriendly(todo.dueDate);

                          return (
                            <SortableRow
                              key={menuId}
                              id={menuId}
                              className="project-page__task-row project-page__task-row--nested"
                            >
                              <label className="project-page__task-check">
                                <input
                                  type="checkbox"
                                  checked={
                                    bulkMode ? selectedIds.has(todo.id) : todo.completed
                                  }
                                  onChange={() =>
                                    bulkMode
                                      ? onSelect(todo.id)
                                      : onToggle(todo.id, !todo.completed)
                                  }
                                  aria-label={
                                    bulkMode
                                      ? `Select ${todo.title}`
                                      : `Complete ${todo.title}`
                                  }
                                />
                              </label>
                              <button
                                type="button"
                                className={`project-page__task-title${
                                  todo.completed ? " project-page__task-title--done" : ""
                                }`}
                                onClick={() => onTaskOpen(todo.id)}
                              >
                                {todo.title}
                              </button>
                              {todo.dueDate ? (
                                <span className="project-page__task-meta">{dueLabel}</span>
                              ) : null}
                              <RowMenu
                                label="Task actions"
                                open={openMenuId === menuId}
                                onToggle={() =>
                                  setOpenMenuId((current) =>
                                    current === menuId ? null : menuId,
                                  )
                                }
                              >
                                <button type="button" onClick={() => onTaskOpen(todo.id)}>
                                  Open
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onSave(todo.id, { headingId: null })}
                                >
                                  Move to backlog
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRequestDeleteTodo(todo.id)}
                                >
                                  Delete
                                </button>
                              </RowMenu>
                            </SortableRow>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>
    </>
  );
}
