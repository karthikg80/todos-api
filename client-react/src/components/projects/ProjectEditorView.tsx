import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
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
import { apiCall } from "../../api/client";
import { Breadcrumb } from "../shared/Breadcrumb";
import {
  IconGrip,
  IconKebab,
  IconMenu,
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
  area?: string | null;
  priority?: Project["priority"] | null;
}

interface Props {
  project: Project;
  isDraft?: boolean;
  projects: Project[];
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
  onOpenProject: (id: string) => void;
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
  isDropTarget = false,
  children,
}: {
  id: string;
  className: string;
  isDropTarget?: boolean;
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
      className={`${className}${isDragging ? " project-page__sortable-row--dragging" : ""}${
        isDropTarget ? " project-page__sortable-row--drop-target" : ""
      }`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 2 : undefined,
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
  onClose,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <div className="project-page__menu" ref={panelRef}>
      <button
        type="button"
        ref={triggerRef}
        className="project-page__icon-btn"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
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
  isDraft = false,
  projects,
  projectTodos,
  visibleTodos: _visibleTodos,
  loadState,
  errorMessage,
  selectedIds,
  onOpenNav,
  onClearProject,
  onOpenProject,
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

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [goal, setGoal] = useState(project.goal ?? "");
  const [projectArea, setProjectArea] = useState(project.area ?? "");
  const [projectPriority, setProjectPriority] = useState<Project["priority"]>(
    project.priority ?? null,
  );
  const [targetDate, setTargetDate] = useState(
    toDateInputValue(project.targetDate),
  );
  const [projectStatus, setProjectStatus] = useState<Project["status"]>(
    project.status,
  );
  const [savingProject, setSavingProject] = useState(false);
  const [activeTaskComposerScope, setActiveTaskComposerScope] = useState<string | null>(
    null,
  );
  const [taskComposerValue, setTaskComposerValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDropTargetId, setActiveDropTargetId] = useState<string | null>(null);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [headingComposerOpen, setHeadingComposerOpen] = useState(false);
  const [headingComposerValue, setHeadingComposerValue] = useState("");
  const [headingNameDrafts, setHeadingNameDrafts] = useState<Record<string, string>>({});
  const [moveTargetByHeadingId, setMoveTargetByHeadingId] = useState<
    Record<string, string>
  >({});

  const {
    headings,
    addHeading,
    updateHeading,
    deleteHeading,
    reorderHeadings,
  } = useProjectHeadings(project.id);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setGoal(project.goal ?? "");
    setProjectArea(project.area ?? "");
    setProjectPriority(project.priority ?? null);
    setTargetDate(toDateInputValue(project.targetDate));
    setProjectStatus(project.status);
  }, [
    project.id,
    project.updatedAt,
    project.name,
    project.description,
    project.goal,
    project.area,
    project.priority,
    project.targetDate,
    project.status,
  ]);

  useEffect(() => {
    setOpenMenuId(null);
    setActiveTaskComposerScope(null);
    setTaskComposerValue("");
    setActiveDropTargetId(null);
    setCollapsedHeadingIds(new Set());
    setHeadingComposerOpen(false);
    setHeadingComposerValue("");
  }, [project.id]);

  useEffect(() => {
    setHeadingNameDrafts(
      Object.fromEntries(headings.map((heading) => [heading.id, heading.name])),
    );
    setMoveTargetByHeadingId({});
    setCollapsedHeadingIds((current) => {
      const next = new Set<string>();
      for (const heading of headings) {
        if (current.has(heading.id)) next.add(heading.id);
      }
      return next;
    });
  }, [headings, project.id]);

  const projectDirty = useMemo(() => {
    const nextDescription = description.trim() || null;
    const nextGoal = goal.trim() || null;
    const nextArea = projectArea.trim() || null;
    const previousDescription = project.description?.trim() || null;
    const previousGoal = project.goal?.trim() || null;
    const previousArea = project.area?.trim() || null;

    if (isDraft) {
      return Boolean(
        name.trim() ||
          nextDescription ||
          nextGoal ||
          nextArea ||
          targetDate ||
          projectPriority !== null ||
          projectStatus !== "active",
      );
    }

    return (
      name.trim() !== project.name.trim() ||
      nextDescription !== previousDescription ||
      nextGoal !== previousGoal ||
      nextArea !== previousArea ||
      projectPriority !== (project.priority ?? null) ||
      targetDate !== toDateInputValue(project.targetDate) ||
      projectStatus !== project.status
    );
  }, [
    description,
    goal,
    name,
    project.area,
    project.description,
    project.goal,
    project.name,
    project.priority,
    project.status,
    project.targetDate,
    projectArea,
    projectPriority,
    projectStatus,
    targetDate,
    isDraft,
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
  const areaSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((candidate) => candidate.area?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [projects],
  );
  const displayedFlatItems = useMemo(
    () =>
      flatItems.filter((item) =>
        item.kind === "heading"
          ? true
          : !item.parentHeadingId || !collapsedHeadingIds.has(item.parentHeadingId),
      ),
    [collapsedHeadingIds, flatItems],
  );
  const activeDragItem = useMemo(
    () =>
      activeDragId
        ? displayedFlatItems.find((item) => item.sortableId === activeDragId) ?? null
        : null,
    [activeDragId, displayedFlatItems],
  );

  const buildDerivedProjectName = useCallback(
    (suffix: string) => {
      const base = project.name.trim() || "Untitled project";
      const root = `${base} ${suffix}`;
      const existingNames = new Set(
        projects.map((candidate) => candidate.name.trim().toLowerCase()),
      );
      let candidate = root;
      let index = 2;
      while (existingNames.has(candidate.trim().toLowerCase())) {
        candidate = `${root} ${index}`;
        index += 1;
      }
      return candidate;
    },
    [project.name, projects],
  );

  const cloneProjectStructure = useCallback(
    async (mode: "duplicate" | "repeat") => {
      const response = await apiCall("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: buildDerivedProjectName(mode === "duplicate" ? "Copy" : "Repeat"),
          description: description.trim() || null,
          goal: goal.trim() || null,
          area: projectArea.trim() || null,
          priority: projectPriority,
          status: "active",
          targetDate: mode === "duplicate" ? fromDateInputValue(targetDate) : null,
        }),
      });
      if (!response.ok) return;

      const created = (await response.json()) as Project;
      const headingMap = new Map<string, string>();

      for (const heading of sortedHeadings) {
        const headingResponse = await apiCall(`/projects/${created.id}/headings`, {
          method: "POST",
          body: JSON.stringify({ name: heading.name }),
        });
        if (!headingResponse.ok) continue;
        const createdHeading = (await headingResponse.json()) as Heading;
        headingMap.set(heading.id, createdHeading.id);
      }

      for (const todo of sortedTodos) {
        const nextHeadingId = todo.headingId
          ? (headingMap.get(todo.headingId) ?? null)
          : null;
        await apiCall("/todos", {
          method: "POST",
          body: JSON.stringify({
            title: todo.title,
            description: todo.description ?? null,
            notes: todo.notes ?? null,
            projectId: created.id,
            headingId: nextHeadingId,
            priority: todo.priority ?? null,
            tags: todo.tags,
            context: todo.context ?? null,
            energy: todo.energy ?? null,
            estimateMinutes: todo.estimateMinutes ?? null,
            waitingOn: todo.waitingOn ?? null,
            recurrence: todo.recurrence ?? undefined,
            firstStep: todo.firstStep ?? null,
            emotionalState: todo.emotionalState ?? null,
            effortScore: todo.effortScore ?? null,
            source: todo.source ?? null,
            status: mode === "duplicate" ? todo.status : "inbox",
            completed: mode === "duplicate" ? todo.completed : false,
            dueDate: mode === "duplicate" ? todo.dueDate ?? null : null,
            startDate: mode === "duplicate" ? todo.startDate ?? null : null,
            scheduledDate: mode === "duplicate" ? todo.scheduledDate ?? null : null,
            reviewDate: mode === "duplicate" ? todo.reviewDate ?? null : null,
            doDate: mode === "duplicate" ? todo.doDate ?? null : null,
          }),
        });
      }

      onOpenProject(created.id);
    },
    [
      buildDerivedProjectName,
      description,
      goal,
      onOpenProject,
      projectArea,
      projectPriority,
      sortedHeadings,
      sortedTodos,
      targetDate,
    ],
  );

  const handleCompleteProject = useCallback(async () => {
    await onSaveProject(project.id, { status: "completed" });
  }, [onSaveProject, project.id]);

  const handleSaveProject = useCallback(async () => {
    setSavingProject(true);
    try {
      await onSaveProject(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        goal: goal.trim() || null,
        area: projectArea.trim() || null,
        priority: projectPriority,
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
    projectArea,
    projectPriority,
    projectStatus,
    targetDate,
  ]);

  const handleAddTaskInline = useCallback(async () => {
    const title = taskComposerValue.trim();
    const headingId =
      activeTaskComposerScope && activeTaskComposerScope !== "backlog"
        ? activeTaskComposerScope
        : null;
    if (!title) return;

    await onAddTodo({
      title,
      projectId: project.id,
      headingId,
    });

    setTaskComposerValue("");
  }, [activeTaskComposerScope, onAddTodo, project.id, taskComposerValue]);

  const handleAddHeadingInline = useCallback(async () => {
    const name = headingComposerValue.trim();
    if (!name) return;
    const created = await addHeading(name);
    if (!created) return;
    setHeadingComposerValue("");
    setHeadingComposerOpen(false);
  }, [addHeading, headingComposerValue]);

  const renderTaskComposer = useCallback(
    (scope: string) => {
      const open = activeTaskComposerScope === scope;
      return (
        <div
          className={`project-page__task-composer${
            open ? " project-page__task-composer--open" : ""
          }`}
        >
          {open ? (
            <div className="project-page__task-composer-form">
              <input
                type="text"
                className="project-page__task-composer-input"
                value={taskComposerValue}
                placeholder="Type a task"
                onChange={(event) => setTaskComposerValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleAddTaskInline();
                  }
                  if (event.key === "Escape") {
                    setTaskComposerValue("");
                    setActiveTaskComposerScope(null);
                  }
                }}
                autoFocus
              />
              <div className="project-page__task-composer-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => void handleAddTaskInline()}
                  disabled={!taskComposerValue.trim()}
                >
                  Add task
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setTaskComposerValue("");
                    setActiveTaskComposerScope(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="project-page__task-composer-trigger"
              onClick={() => {
                setActiveTaskComposerScope(scope);
                setTaskComposerValue("");
              }}
            >
              <span className="project-page__task-composer-plus" aria-hidden="true">
                +
              </span>
              <span className="project-page__task-composer-label">Add task</span>
              <span className="project-page__heading-rule" aria-hidden="true" />
            </button>
          )}
        </div>
      );
    },
    [activeTaskComposerScope, handleAddTaskInline, taskComposerValue],
  );

  const handleSaveHeadingName = useCallback(
    async (heading: Heading) => {
      const nextName = (headingNameDrafts[heading.id] ?? heading.name).trim();
      if (!nextName) {
        setHeadingNameDrafts((current) => ({
          ...current,
          [heading.id]: heading.name,
        }));
        return;
      }
      if (nextName === heading.name) return;
      const updated = await updateHeading(heading.id, { name: nextName });
      if (!updated) {
        setHeadingNameDrafts((current) => ({
          ...current,
          [heading.id]: heading.name,
        }));
      }
    },
    [headingNameDrafts, updateHeading],
  );

  const handleArchiveHeading = useCallback(
    async (heading: Heading, headingTodos: Todo[]) => {
      await Promise.all(
        headingTodos.map((todo) => onSave(todo.id, { archived: true })),
      );
      await deleteHeading(heading.id);
      setOpenMenuId(null);
    },
    [deleteHeading, onSave],
  );

  const handleDeleteHeading = useCallback(
    async (heading: Heading) => {
      await deleteHeading(heading.id);
      setOpenMenuId(null);
    },
    [deleteHeading],
  );

  const handleMoveHeading = useCallback(
    async (heading: Heading, headingTodos: Todo[], targetProjectId: string) => {
      if (!targetProjectId || targetProjectId === project.id) return;
      const response = await apiCall(`/projects/${targetProjectId}/headings`, {
        method: "POST",
        body: JSON.stringify({ name: heading.name }),
      });
      if (!response.ok) return;
      const destinationHeading = (await response.json()) as Heading;
      await Promise.all(
        headingTodos.map((todo) =>
          onSave(todo.id, {
            projectId: targetProjectId,
            headingId: destinationHeading.id,
          }),
        ),
      );
      await deleteHeading(heading.id);
      setMoveTargetByHeadingId((current) => ({ ...current, [heading.id]: "" }));
      setOpenMenuId(null);
    },
    [deleteHeading, onSave, project.id],
  );

  const handleConvertHeadingToProject = useCallback(
    async (heading: Heading, headingTodos: Todo[]) => {
      const response = await apiCall("/projects", {
        method: "POST",
        body: JSON.stringify({ name: heading.name }),
      });
      if (!response.ok) return;
      const created = (await response.json()) as Project;
      await Promise.all(
        headingTodos.map((todo) =>
          onSave(todo.id, { projectId: created.id, headingId: null }),
        ),
      );
      await deleteHeading(heading.id);
      onOpenProject(created.id);
    },
    [deleteHeading, onOpenProject, onSave],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setActiveDropTargetId(null);
      if (!over || active.id === over.id) return;

      const activeItem = displayedFlatItems.find((item) => item.sortableId === active.id);
      const overItem = displayedFlatItems.find((item) => item.sortableId === over.id);
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

      if (overItem.kind === "heading" && collapsedHeadingIds.has(overItem.heading.id)) {
        const targetHeadingId = overItem.heading.id;
        const activeTodoId = activeItem.todo.id;
        const targetFlatIndex = flatItems.findIndex(
          (item) => item.kind === "heading" && item.heading.id === targetHeadingId,
        );
        const nextTodoAfterSection = flatItems
          .slice(targetFlatIndex + 1)
          .find((item): item is Extract<FlatItem, { kind: "todo" }> => {
            if (item.kind !== "todo") return false;
            return item.parentHeadingId !== targetHeadingId && item.todo.id !== activeTodoId;
          });

        if (nextTodoAfterSection) {
          await onSave(activeTodoId, { headingId: targetHeadingId });
          onReorder(activeTodoId, nextTodoAfterSection.todo.id);
          return;
        }

        await onSave(activeTodoId, {
          headingId: targetHeadingId,
          order: sortedTodos.reduce((max, todo) => Math.max(max, todo.order), -1) + 1,
        });
        return;
      }

      const flatWithoutActive = displayedFlatItems.filter(
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
    [
      collapsedHeadingIds,
      displayedFlatItems,
      flatItems,
      onReorder,
      onSave,
      reorderHeadings,
      sortedHeadings,
      sortedTodos,
    ],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    setActiveDropTargetId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setActiveDropTargetId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setActiveDropTargetId(null);
  }, []);

  const toggleHeadingCollapsed = useCallback((headingId: string) => {
    setCollapsedHeadingIds((current) => {
      const next = new Set(current);
      if (next.has(headingId)) {
        next.delete(headingId);
      } else {
        next.add(headingId);
      }
      return next;
    });
  }, []);

  const renderDragOverlay = useCallback(() => {
    if (!activeDragItem) return null;

    if (activeDragItem.kind === "heading") {
      const headingTodos = todosByHeading.get(activeDragItem.heading.id) ?? [];
      return (
        <div className="project-page__drag-overlay project-page__drag-overlay--heading">
          <div className="project-page__drag-handle project-page__drag-handle--overlay">
            <IconGrip size={14} />
          </div>
          <div className="project-page__heading-copy">
            <span className="project-page__heading-title">
              {activeDragItem.heading.name}
            </span>
            <span className="project-page__heading-count">{headingTodos.length}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="project-page__drag-overlay project-page__drag-overlay--task">
        <div className="project-page__drag-handle project-page__drag-handle--overlay">
          <IconGrip size={14} />
        </div>
        <label className="project-page__task-check">
          <input type="checkbox" checked={activeDragItem.todo.completed} readOnly />
        </label>
        <span
          className={`project-page__task-title${
            activeDragItem.todo.completed ? " project-page__task-title--done" : ""
          }`}
        >
          {activeDragItem.todo.title}
        </span>
        {activeDragItem.todo.dueDate ? (
          <span className="project-page__task-meta">
            {formatDueFriendly(activeDragItem.todo.dueDate)}
          </span>
        ) : null}
      </div>
    );
  }, [activeDragItem, todosByHeading]);

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
              className="project-page__icon-btn project-page__nav-trigger"
              onClick={onOpenNav}
              aria-label="Open navigation"
            >
              <IconMenu size={18} />
            </button>
            <Breadcrumb
              items={[
                { label: activeViewLabel, onClick: onClearProject },
                { label: project.name || "New Project" },
              ]}
            />
          </div>

          <div className="project-page__topbar-actions">
            {isDraft ? (
              <button
                type="button"
                className="project-page__icon-btn"
                aria-label={settingsOpen ? "Hide settings" : "Show settings"}
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <IconMenu size={18} />
              </button>
            ) : (
              <ProjectKebabMenu
                onToggleSettings={() => setSettingsOpen((open) => !open)}
                settingsOpen={settingsOpen}
                onRename={() => titleInputRef.current?.focus()}
                onDuplicate={() => {
                  void cloneProjectStructure("duplicate");
                }}
                onRepeat={() => {
                  void cloneProjectStructure("repeat");
                }}
                onComplete={() => {
                  void handleCompleteProject();
                }}
                onArchive={() => onArchiveProject(project.id)}
                onDelete={() => onDeleteProject(project.id)}
              />
            )}
          </div>
        </div>

        <header className="project-page__header">
          <input
            ref={titleInputRef}
            className="project-page__title"
            aria-label="Project name"
            value={name}
            placeholder="Untitled project"
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (projectDirty && !isDraft) {
                void handleSaveProject();
              }
            }}
          />
          <div className="project-page__header-meta">
            <span className="project-page__meta-pill">
              {projectStatusLabel(projectStatus)}
            </span>
            {isDraft ? (
              <span className="project-page__meta-pill project-page__meta-pill--accent">
                New
              </span>
            ) : null}
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
              <span className="project-page__field-label">Area</span>
              <input
                list="project-area-options"
                className="project-page__input"
                value={projectArea}
                onChange={(event) => setProjectArea(event.target.value)}
                placeholder="Home, Work, Health…"
              />
              <datalist id="project-area-options">
                {areaSuggestions.map((area) => (
                  <option key={area} value={area} />
                ))}
              </datalist>
            </label>
            <label className="project-page__field">
              <span className="project-page__field-label">Priority</span>
              <select
                className="project-page__input"
                value={projectPriority ?? ""}
                onChange={(event) =>
                  setProjectPriority(
                    event.target.value
                      ? (event.target.value as NonNullable<Project["priority"]>)
                      : null,
                  )
                }
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
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
                disabled={!projectDirty || savingProject || !name.trim()}
              >
                {savingProject ? "Saving…" : isDraft ? "Create project" : "Save project"}
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

        {isDraft ? (
          <section className="project-page__draft-hint">
            Save the project first, then add headings and tasks.
          </section>
        ) : null}

        <section className="project-page__list-shell">
          {isDraft ? (
            <div className="project-page__empty">
              Start with the project name and optional settings. Once you create it,
              headings and tasks will appear here.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragCancel={handleDragCancel}
              onDragEnd={(event) => void handleDragEnd(event)}
            >
              <SortableContext
                items={displayedFlatItems.map((item) => item.sortableId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="project-page__list">
                  {backlogTodos.length === 0 ? renderTaskComposer("backlog") : null}

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
                        isDropTarget={activeDropTargetId === menuId}
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
                          onClose={() => setOpenMenuId(null)}
                          onToggle={() =>
                            setOpenMenuId((current) => (current === menuId ? null : menuId))
                          }
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onTaskOpen(todo.id);
                            }}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              onRequestDeleteTodo(todo.id);
                            }}
                          >
                            Delete
                          </button>
                        </RowMenu>
                      </SortableRow>
                    );
                  })}

                  {backlogTodos.length > 0 ? renderTaskComposer("backlog") : null}

                  {sortedHeadings.map((heading) => {
                    const headingTodos = todosByHeading.get(heading.id) ?? [];
                    const headingMenuId = `heading:${heading.id}`;
                    const collapsed = collapsedHeadingIds.has(heading.id);

                    return (
                      <div
                        key={heading.id}
                        className={`project-page__section${
                          activeDropTargetId === headingMenuId
                            ? " project-page__section--drop-target"
                            : ""
                        }`}
                      >
                        <SortableRow
                          id={headingMenuId}
                          className="project-page__heading-row"
                          isDropTarget={activeDropTargetId === headingMenuId}
                        >
                          <div className="project-page__heading-copy">
                            <button
                              type="button"
                              className="project-page__collapse-toggle"
                              aria-label={`${collapsed ? "Expand" : "Collapse"} ${heading.name}`}
                              aria-expanded={!collapsed}
                              onClick={() => toggleHeadingCollapsed(heading.id)}
                            >
                              <span
                                className={`project-page__collapse-glyph${
                                  collapsed ? "" : " project-page__collapse-glyph--open"
                                }`}
                                aria-hidden="true"
                              >
                                ▾
                              </span>
                            </button>
                            <input
                              className="project-page__heading-input"
                              data-heading-input-id={heading.id}
                              aria-label={`Heading name: ${heading.name}`}
                              value={headingNameDrafts[heading.id] ?? heading.name}
                              onChange={(event) =>
                                setHeadingNameDrafts((current) => ({
                                  ...current,
                                  [heading.id]: event.target.value,
                                }))
                              }
                              onBlur={() => void handleSaveHeadingName(heading)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.currentTarget.blur();
                                }
                                if (event.key === "Escape") {
                                  setHeadingNameDrafts((current) => ({
                                    ...current,
                                    [heading.id]: heading.name,
                                  }));
                                  event.currentTarget.blur();
                                }
                              }}
                            />
                            <span className="project-page__heading-count">
                              {headingTodos.length}
                            </span>
                            <span className="project-page__heading-rule" aria-hidden="true" />
                          </div>
                          <RowMenu
                            label="Heading actions"
                            open={openMenuId === headingMenuId}
                            onClose={() => setOpenMenuId(null)}
                            onToggle={() =>
                              setOpenMenuId((current) =>
                                current === headingMenuId ? null : headingMenuId,
                              )
                            }
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                requestAnimationFrame(() =>
                                  document
                                    .querySelector<HTMLInputElement>(
                                      `[data-heading-input-id="${heading.id}"]`,
                                    )
                                    ?.focus(),
                                );
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleArchiveHeading(heading, headingTodos)}
                            >
                              Archive
                            </button>
                            <label className="project-page__menu-field">
                              <span>Move to project</span>
                              <select
                                className="project-page__menu-select"
                                value={moveTargetByHeadingId[heading.id] ?? ""}
                                onChange={(event) =>
                                  setMoveTargetByHeadingId((current) => ({
                                    ...current,
                                    [heading.id]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Select project</option>
                                {projects
                                  .filter(
                                    (candidate) =>
                                      !candidate.archived && candidate.id !== project.id,
                                  )
                                  .map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.name}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              type="button"
                              disabled={!moveTargetByHeadingId[heading.id]}
                              onClick={() =>
                                void handleMoveHeading(
                                  heading,
                                  headingTodos,
                                  moveTargetByHeadingId[heading.id] ?? "",
                                )
                              }
                            >
                              Move
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleConvertHeadingToProject(heading, headingTodos)
                              }
                            >
                              Convert to project
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteHeading(heading)}
                            >
                              Delete
                            </button>
                          </RowMenu>
                        </SortableRow>

                        <div
                          className={`project-page__section-tasks${
                            collapsed ? " project-page__section-tasks--collapsed" : ""
                          }`}
                        >
                          {!collapsed && headingTodos.length === 0 ? (
                            <div className="project-page__section-empty">
                              Empty heading. Drop a task here or add one from the menu.
                            </div>
                          ) : null}

                          {!collapsed
                            ? headingTodos.map((todo) => {
                            const menuId = `todo:${todo.id}`;
                            const dueLabel = formatDueFriendly(todo.dueDate);

                            return (
                              <SortableRow
                                key={menuId}
                                id={menuId}
                                className="project-page__task-row project-page__task-row--nested"
                                isDropTarget={activeDropTargetId === menuId}
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
                                  onClose={() => setOpenMenuId(null)}
                                  onToggle={() =>
                                    setOpenMenuId((current) =>
                                      current === menuId ? null : menuId,
                                    )
                                  }
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onTaskOpen(todo.id);
                                    }}
                                  >
                                    Open
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      void onSave(todo.id, { headingId: null });
                                    }}
                                  >
                                    Move to backlog
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onRequestDeleteTodo(todo.id);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </RowMenu>
                              </SortableRow>
                            );
                            })
                            : null}

                          {!collapsed ? renderTaskComposer(heading.id) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div
                    className={`project-page__heading-composer${
                      headingComposerOpen ? " project-page__heading-composer--open" : ""
                    }`}
                  >
                    {headingComposerOpen ? (
                      <>
                        <input
                          type="text"
                          className="project-page__heading-composer-input"
                          value={headingComposerValue}
                          placeholder="Type a heading and press Enter"
                          onChange={(event) => setHeadingComposerValue(event.target.value)}
                          onBlur={() => {
                            if (!headingComposerValue.trim()) {
                              setHeadingComposerOpen(false);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void handleAddHeadingInline();
                            }
                            if (event.key === "Escape") {
                              setHeadingComposerValue("");
                              setHeadingComposerOpen(false);
                            }
                          }}
                          autoFocus
                        />
                        <span className="project-page__heading-rule" aria-hidden="true" />
                      </>
                    ) : (
                      <button
                        type="button"
                        className="project-page__heading-composer-trigger"
                        onClick={() => setHeadingComposerOpen(true)}
                      >
                        <span className="project-page__heading-rule" aria-hidden="true" />
                        <span className="project-page__heading-composer-label">New heading</span>
                      </button>
                    )}
                  </div>
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {renderDragOverlay()}
              </DragOverlay>
            </DndContext>
          )}
        </section>
      </div>
    </>
  );
}
