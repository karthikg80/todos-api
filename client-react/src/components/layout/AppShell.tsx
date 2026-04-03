import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useTodosStore } from "../../store/useTodosStore";
import { useProjectsStore } from "../../store/useProjectsStore";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useDensity } from "../../hooks/useDensity";
import { useServiceWorker } from "../../hooks/useServiceWorker";
import { IconMoon, IconSun, IconMenu } from "../shared/Icons";
import { useIcsExport } from "../../hooks/useIcsExport";
import { captureInboxItem } from "../../api/inbox";
import { Sidebar, type WorkspaceView } from "../projects/Sidebar";
import { SortableTodoList } from "../todos/SortableTodoList";
import { TodoDrawer } from "../todos/TodoDrawer";
import { type SortField, type SortOrder } from "../todos/SortControl";
import { UndoToast } from "../shared/UndoToast";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { CommandPalette } from "../shared/CommandPalette";
import { ShortcutsOverlay } from "../shared/ShortcutsOverlay";
import { applyFilters, type ActiveFilters } from "../todos/FilterPanel";
import { ErrorBoundary } from "../shared/ErrorBoundary";
import { ComponentGalleryPage } from "./ComponentGalleryPage";
import { SettingsPage } from "./SettingsPage";
import { HomeDashboard } from "./HomeDashboard";
import { DeskView } from "../desk/DeskView";
import { TuneUpView } from "../tuneup/TuneUpView";
import { ProjectCrud } from "../projects/ProjectCrud";
import { OnboardingFlow } from "../shared/OnboardingFlow";
import { useTaskNavigation } from "../../hooks/useTaskNavigation";
import { useHashRoute } from "../../hooks/useHashRoute";
import { useViewTransition } from "../../hooks/useViewTransition";
import { TaskFullPage } from "../todos/TaskFullPage";
import { ViewRouter, ViewRoute } from "./ViewRouter";
import { ListViewHeader } from "./ListViewHeader";
import {
  focusGlobalSearchInput,
  triggerPrimaryNewTask,
} from "../../utils/focusTargets";
import { useOverlayFocusTrap } from "../shared/useOverlayFocusTrap";
import * as todosApi from "../../api/todos";

// Lazy-loaded heavy components (code splitting)
const BoardView = lazy(() =>
  import("../todos/BoardView").then((m) => ({ default: m.BoardView })),
);
const TaskComposer = lazy(() =>
  import("../todos/TaskComposer").then((m) => ({ default: m.TaskComposer })),
);
const AiWorkspace = lazy(() =>
  import("../ai/AiWorkspace").then((m) => ({ default: m.AiWorkspace })),
);
const AdminPage = lazy(() =>
  import("../admin/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const FeedbackForm = lazy(() =>
  import("../feedback/FeedbackForm").then((m) => ({ default: m.FeedbackForm })),
);
const WeeklyReview = lazy(() =>
  import("./WeeklyReview").then((m) => ({ default: m.WeeklyReview })),
);

type AppPage =
  | "todos"
  | "settings"
  | "components"
  | "ai"
  | "admin"
  | "feedback"
  | "review";
type ViewMode = "list" | "board";
type UiMode = "normal" | "simple";

interface UndoAction {
  message: string;
  onUndo?: () => void;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 700);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const { dark, toggle: toggleDarkMode } = useDarkMode();
  const { density, cycle: cycleDensity } = useDensity();
  const { startTransition } = useViewTransition();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const taskNav = useTaskNavigation();
  const hashRoute = useHashRoute();
  const activeTodoId = taskNav.activeTaskId;
  const expandedTodoId =
    taskNav.state.mode === "quickEdit" ? taskNav.state.taskId : null;
  const fullPageTaskId =
    taskNav.state.mode === "fullPage" ? taskNav.state.taskId : null;
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    dateFilter: "all",
    priority: "",
    status: "",
  });
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [page, setPage] = useState<AppPage>("todos");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [projectCrudMode, setProjectCrudMode] = useState<
    "create" | "rename" | null
  >(null);
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("order");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [activeTagFilter, setActiveTagFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [uiMode, setUiMode] = useState<UiMode>(
    () => (localStorage.getItem("todos:ui-mode") as UiMode) || "normal",
  );
  const exportIcs = useIcsExport();
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const appMainRef = useRef<HTMLDivElement>(null);
  const showOnboarding = Boolean(user && !user.onboardingCompletedAt);

  useOverlayFocusTrap({
    isOpen: isMobile && mobileNavOpen,
    containerRef: mobileSheetRef,
    onClose: () => setMobileNavOpen(false),
  });

  // Bulk selection
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    todos,
    loadState,
    errorMessage,
    loadTodos,
    addTodo,
    toggleTodo,
    editTodo,
    removeTodo,
  } = useTodosStore();

  const { projects, loadProjects } = useProjectsStore();

  // Build query params based on active view + project
  const queryParams = useMemo(() => {
    const params: Record<string, string | undefined> = {};
    if (selectedProjectId) {
      params.projectId = selectedProjectId;
    } else {
      switch (activeView) {
        case "home":
          // Focus dashboard fetches all active todos for tiles
          break;
        case "triage":
          // Desk: inbox-status todos needing organization
          params.status = "inbox";
          break;
        case "today":
          params.sortBy = "dueDate";
          params.sortOrder = "asc";
          break;
        case "completed":
          params.completed = "true";
          break;
        case "upcoming":
          params.sortBy = "dueDate";
          params.sortOrder = "asc";
          break;
      }
    }
    // User sort overrides view defaults
    if (sortBy !== "order") {
      params.sortBy = sortBy;
      params.sortOrder = sortOrder;
    }
    return params;
  }, [activeView, selectedProjectId, sortBy, sortOrder]);

  // Load data on mount and when filters change
  useEffect(() => {
    loadTodos(queryParams);
  }, [loadTodos, queryParams]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Hash route ↔ task navigation sync
  // On hash change (e.g. browser back), sync to nav state
  useEffect(() => {
    const taskId = hashRoute.taskId;
    if (taskId && taskNav.state.mode !== "fullPage") {
      taskNav.openFullPage(taskId);
    } else if (!taskId && taskNav.state.mode === "fullPage") {
      taskNav.collapse();
    }
  }, [hashRoute.taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When nav state enters fullPage, push hash
  useEffect(() => {
    if (fullPageTaskId && hashRoute.taskId !== fullPageTaskId) {
      hashRoute.navigateToTask(fullPageTaskId);
    } else if (!fullPageTaskId && hashRoute.taskId) {
      hashRoute.clearRoute();
    }
  }, [fullPageTaskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Service worker — offline sync
  useServiceWorker(
    useCallback((replayed: number, failed: number) => {
      if (replayed > 0) {
        setUndoAction({
          message: `Synced ${replayed} offline change${replayed > 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed)` : ""}`,
        });
      }
    }, []),
  );

  // Client-side filtering: date view + search
  const visibleTodos = useMemo(() => {
    let filtered = todos;

    if (!selectedProjectId) {
      const today = new Date().toISOString().split("T")[0];
      if (activeView === "today") {
        filtered = filtered.filter(
          (t) => !t.completed && t.dueDate && t.dueDate.split("T")[0] <= today,
        );
      } else if (activeView === "upcoming") {
        const upcomingEnd = new Date();
        upcomingEnd.setDate(upcomingEnd.getDate() + 14);
        const upcomingEndIso = upcomingEnd.toISOString().split("T")[0];
        filtered = filtered.filter(
          (t) =>
            !t.completed &&
            !!t.dueDate &&
            t.dueDate.split("T")[0] > today &&
            t.dueDate.split("T")[0] <= upcomingEndIso,
        );
      } else if (activeView === "waiting") {
        filtered = filtered.filter(
          (t) => !t.completed && t.status === "waiting",
        );
      } else if (activeView === "scheduled") {
        filtered = filtered.filter(
          (t) => !t.completed && t.status === "scheduled",
        );
      } else if (activeView === "someday") {
        filtered = filtered.filter(
          (t) => !t.completed && t.status === "someday",
        );
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    if (activeTagFilter) {
      filtered = filtered.filter((t) =>
        t.tags.some((tag) => tag === activeTagFilter),
      );
    }

    if (activeHeadingId && selectedProjectId) {
      filtered = filtered.filter((t) => t.headingId === activeHeadingId);
    }

    // Apply advanced filters
    if (
      activeFilters.dateFilter !== "all" ||
      activeFilters.priority ||
      activeFilters.status
    ) {
      filtered = applyFilters(filtered, activeFilters);
    }

    return filtered;
  }, [
    todos,
    activeView,
    selectedProjectId,
    searchQuery,
    activeTagFilter,
    activeHeadingId,
    activeFilters,
  ]);

  const drawerTaskId =
    taskNav.state.mode === "drawer" ? taskNav.state.taskId : null;
  const activeTodo = useMemo(
    () =>
      drawerTaskId ? (todos.find((t) => t.id === drawerTaskId) ?? null) : null,
    [todos, drawerTaskId],
  );
  const hasBlockingOverlay =
    mobileNavOpen ||
    paletteOpen ||
    shortcutsOpen ||
    composerOpen ||
    !!projectCrudMode ||
    !!deleteTarget ||
    !!activeTodo ||
    showOnboarding;

  useEffect(() => {
    for (const element of [sidebarRef.current, appMainRef.current]) {
      if (!element) continue;
      if (hasBlockingOverlay) {
        element.setAttribute("aria-hidden", "true");
        element.setAttribute("inert", "");
      } else {
        element.removeAttribute("aria-hidden");
        element.removeAttribute("inert");
      }
    }

    return () => {
      for (const element of [sidebarRef.current, appMainRef.current]) {
        element?.removeAttribute("aria-hidden");
        element?.removeAttribute("inert");
      }
    };
  }, [hasBlockingOverlay]);

  // Count badges for workspace views
  const viewCounts = useMemo(() => {
    const active = todos.filter((t) => !t.completed);
    const today = new Date().toISOString().split("T")[0];
    const upcomingEnd = new Date();
    upcomingEnd.setDate(upcomingEnd.getDate() + 14);
    const upcomingEndIso = upcomingEnd.toISOString().split("T")[0];
    return {
      triage: active.filter(
        (t) => t.status === "inbox" || (!t.projectId && !t.category),
      ).length,
      today: active.filter((t) => t.dueDate && t.dueDate.split("T")[0] <= today)
        .length,
      upcoming: active.filter(
        (t) =>
          !!t.dueDate &&
          t.dueDate.split("T")[0] > today &&
          t.dueDate.split("T")[0] <= upcomingEndIso,
      ).length,
      waiting: active.filter((t) => t.status === "waiting").length,
      scheduled: active.filter((t) => t.status === "scheduled").length,
      someday: active.filter((t) => t.status === "someday").length,
    };
  }, [todos]);

  // Context-aware quick entry placeholder
  const quickEntryPlaceholder = useMemo(() => {
    if (selectedProjectId) {
      const project = projects.find((p) => p.id === selectedProjectId);
      return project ? `Add a task to ${project.name}…` : "Add a task…";
    }
    switch (activeView) {
      case "home":
        return "What needs your focus today?";
      case "triage":
        return "Capture something to organize later…";
      case "today":
        return "Add a task for today…";
      case "waiting":
        return "Add something you’re waiting on…";
      case "scheduled":
        return "Add something planned for later…";
      case "someday":
        return "Capture something for later…";
      default:
        return "Add a task…";
    }
  }, [selectedProjectId, projects, activeView]);

  const focusSearchInput = useCallback(() => {
    startTransition(() => setPage("todos"));
    requestAnimationFrame(() => {
      focusGlobalSearchInput();
    });
  }, [startTransition]);

  const focusQuickEntryOrOpenComposer = useCallback(() => {
    startTransition(() => setPage("todos"));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (triggerPrimaryNewTask()) {
          return;
        }
        setComposerOpen(true);
      });
    });
  }, [startTransition]);

  // --- Handlers ---

  const handleQuickEdit = useCallback(
    (id: string) => {
      taskNav.openQuickEdit(id);
    },
    [taskNav],
  );

  const handleOpenDrawer = useCallback(
    (id: string) => {
      taskNav.openDrawer(id);
    },
    [taskNav],
  );

  const handleCloseDrawer = useCallback(() => {
    taskNav.deescalate();
  }, [taskNav]);

  const handleCaptureToDesk = useCallback(async (text: string) => {
    const ok = await captureInboxItem(text);
    if (!ok) {
      throw new Error("Failed to add capture");
    }
    setUndoAction({
      message: "Added to Desk",
    });
  }, []);

  const handleInlineEdit = useCallback(
    async (id: string, title: string) => {
      await editTodo(id, { title });
    },
    [editTodo],
  );

  const handleLifecycleAction = useCallback(
    async (id: string, action: string) => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      switch (action) {
        case "cancel":
          await editTodo(id, { status: "cancelled" as "cancelled" });
          setUndoAction({
            message: "Task cancelled",
            onUndo: () => editTodo(id, { status: "inbox" as "inbox" }),
          });
          break;
        case "reopen":
          await editTodo(id, { status: "inbox" as "inbox" });
          setUndoAction({ message: "Task reopened" });
          break;
        case "archive":
          await editTodo(id, { archived: true });
          setUndoAction({
            message: "Task archived",
            onUndo: () => editTodo(id, { archived: false }),
          });
          break;
        case "snooze-tomorrow":
          await editTodo(id, {
            scheduledDate: tomorrow.toISOString().split("T")[0],
            status: "scheduled" as "scheduled",
          });
          setUndoAction({ message: "Snoozed until tomorrow" });
          break;
        case "snooze-next-week":
          await editTodo(id, {
            scheduledDate: nextWeek.toISOString().split("T")[0],
            status: "scheduled" as "scheduled",
          });
          setUndoAction({ message: "Snoozed until next week" });
          break;
        case "snooze-next-month":
          await editTodo(id, {
            scheduledDate: nextMonth.toISOString().split("T")[0],
            status: "scheduled" as "scheduled",
          });
          setUndoAction({ message: "Snoozed until next month" });
          break;
      }
    },
    [editTodo],
  );

  const handleTagClick = useCallback((tag: string) => {
    setActiveTagFilter((prev) => (prev === tag ? "" : tag));
  }, []);

  const handleReorder = useCallback(
    async (activeId: string, overId: string) => {
      const oldIndex = visibleTodos.findIndex((t) => t.id === activeId);
      const newIndex = visibleTodos.findIndex((t) => t.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;

      // Build reorder payload
      const reordered = [...visibleTodos];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      const items = reordered.map((t, i) => ({ id: t.id, order: i }));

      try {
        await todosApi.reorderTodos(items);
        loadTodos(queryParams);
      } catch {
        // Refresh to get server state
        loadTodos(queryParams);
      }
    },
    [visibleTodos, loadTodos, queryParams],
  );

  const handleToggle = useCallback(
    async (id: string, completed: boolean) => {
      const todo = todos.find((t) => t.id === id);
      await toggleTodo(id, completed);
      if (todo) {
        setUndoAction({
          message: completed
            ? `"${todo.title}" completed`
            : `"${todo.title}" marked incomplete`,
          onUndo: () => toggleTodo(id, !completed),
        });
      }
    },
    [todos, toggleTodo],
  );

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const todo = todos.find((t) => t.id === deleteTarget);
    await removeTodo(deleteTarget);
    if (activeTodoId === deleteTarget) taskNav.collapse();
    setDeleteTarget(null);
    if (todo) {
      setUndoAction({
        message: `"${todo.title}" deleted`,
        onUndo: () => {
          // Re-create (best effort — server assigns new ID)
          addTodo({ title: todo.title, projectId: todo.projectId });
        },
      });
    }
  }, [deleteTarget, activeTodoId, todos, removeTodo, addTodo]);

  const handleSelectView = useCallback((view: WorkspaceView) => {
    setActiveView(view);
    taskNav.collapse();
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSelectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    taskNav.collapse();
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  // --- Bulk actions ---

  const handleBulkSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkMode(true);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === visibleTodos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleTodos.map((t) => t.id)));
    }
  }, [selectedIds.size, visibleTodos]);

  const handleBulkComplete = useCallback(async () => {
    const ids = [...selectedIds];
    await Promise.all(
      ids.map((id) => todosApi.updateTodo(id, { completed: true })),
    );
    setBulkMode(false);
    setSelectedIds(new Set());
    loadTodos(queryParams);
  }, [selectedIds, loadTodos, queryParams]);

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    await Promise.all(ids.map((id) => todosApi.deleteTodo(id)));
    setBulkMode(false);
    setSelectedIds(new Set());
    loadTodos(queryParams);
  }, [selectedIds, loadTodos, queryParams]);

  const handleCancelBulk = useCallback(() => {
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape: close palette, close drawer, cancel bulk, close mobile nav
      if (e.key === "Escape") {
        if (paletteOpen) {
          return;
        } else if (activeTodoId) {
          taskNav.deescalate();
        } else if (bulkMode) {
          handleCancelBulk();
        } else if (mobileNavOpen) {
          setMobileNavOpen(false);
        }
        return;
      }

      // Ctrl/Cmd+K: open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }

      const inInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT";

      if (inInput) return;

      // 'n': focus quick entry
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        focusQuickEntryOrOpenComposer();
        return;
      }

      // '/': focus search
      if (e.key === "/") {
        e.preventDefault();
        focusSearchInput();
        return;
      }

      // '?': toggle shortcuts overlay
      if (e.key === "?") {
        setShortcutsOpen((o) => !o);
        return;
      }

      // j/k: navigate between tasks
      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        const ids = visibleTodos.map((t) => t.id);
        if (ids.length === 0) return;
        const currentIdx = activeTodoId ? ids.indexOf(activeTodoId) : -1;
        let nextIdx: number;
        if (e.key === "j") {
          nextIdx = currentIdx < ids.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : ids.length - 1;
        }
        taskNav.openQuickEdit(ids[nextIdx]);
        // Scroll the item into view
        document
          .querySelector(`[data-todo-id="${ids[nextIdx]}"]`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      }

      // x: toggle completion of focused task
      if (e.key === "x" && activeTodoId) {
        e.preventDefault();
        const todo = visibleTodos.find((t) => t.id === activeTodoId);
        if (todo) handleToggle(activeTodoId, !todo.completed);
        return;
      }

      // e: open drawer for focused task
      if (e.key === "e" && activeTodoId) {
        e.preventDefault();
        handleOpenDrawer(activeTodoId);
        return;
      }

      // d: delete focused task
      if (e.key === "d" && activeTodoId) {
        e.preventDefault();
        setDeleteTarget(activeTodoId);
        return;
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    activeTodoId,
    bulkMode,
    mobileNavOpen,
    paletteOpen,
    handleCancelBulk,
    focusQuickEntryOrOpenComposer,
    focusSearchInput,
    handleOpenDrawer,
    handleToggle,
    taskNav,
    visibleTodos,
  ]);

  // --- Derived ---

  const VIEW_LABELS: Record<string, string> = {
    home: "Focus",
    triage: "Desk",
    all: "Everything",
    today: "Today",
    upcoming: "Upcoming",
    waiting: "Pending",
    scheduled: "Planned",
    someday: "Later",
    completed: "Completed",
    tuneup: "Tune-up",
  };

  const headerTitle = selectedProjectId
    ? (projects.find((p) => p.id === selectedProjectId)?.name ?? "Project")
    : (VIEW_LABELS[activeView] ?? activeView);

  // ViewRouter active key: projects get a dynamic composite key
  const activeViewKey = selectedProjectId
    ? `project:${selectedProjectId}`
    : activeView;

  // Dynamic page title
  useEffect(() => {
    const pageLabel =
      page === "settings"
        ? "Settings"
        : page === "components"
          ? "Component gallery"
          : page === "ai"
            ? "AI Workspace"
            : page === "admin"
              ? "Admin"
              : page === "feedback"
                ? "Feedback"
                : headerTitle;
    document.title = `${pageLabel} — Todos`;
  }, [page, headerTitle]);

  const handlePaletteNavigate = useCallback(
    (view: WorkspaceView) => {
      startTransition(() => setPage("todos"));
      handleSelectView(view);
      handleSelectProject(null);
    },
    [handleSelectView, handleSelectProject],
  );

  const sidebarContent = (
    <Sidebar
      projects={projects}
      activeView={activeView}
      selectedProjectId={selectedProjectId}
      viewCounts={viewCounts}
      onSelectView={(v) => {
        startTransition(() => setPage("todos"));
        handleSelectView(v);
        setMobileNavOpen(false);
      }}
      onSelectProject={(id) => {
        startTransition(() => setPage("todos"));
        handleSelectProject(id);
        setMobileNavOpen(false);
      }}
      onCreateProject={() => setProjectCrudMode("create")}
      onRenameProject={(id, name) => {
        setRenameTarget({ id, name });
        setProjectCrudMode("rename");
      }}
      onOpenSettings={() => {
        startTransition(() => setPage("settings"));
        setMobileNavOpen(false);
      }}
      onOpenFeedback={() => {
        startTransition(() => setPage("feedback"));
        setMobileNavOpen(false);
      }}
      onOpenComponentGallery={() => {
        startTransition(() => setPage("components"));
        setMobileNavOpen(false);
      }}
      onOpenAdmin={() => {
        startTransition(() => setPage("admin"));
        setMobileNavOpen(false);
      }}
      onToggleTheme={toggleDarkMode}
      onOpenShortcuts={() => setShortcutsOpen(true)}
      onOpenProfile={() => {
        startTransition(() => setPage("settings"));
        setMobileNavOpen(false);
      }}
      onLogout={logout}
      user={user}
      dark={dark}
      isAdmin={user?.role === "admin"}
      isCollapsed={sidebarCollapsed}
      onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onNewTask={() => setComposerOpen(true)}
      uiMode={uiMode}
      onRefreshProjects={loadProjects}
    />
  );

  return (
    <div
      className={`app-shell${bulkMode ? " is-bulk-selecting" : ""}${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
    >
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside
          ref={sidebarRef}
          className={`app-sidebar${sidebarCollapsed ? " app-sidebar--collapsed" : ""}`}
        >
          {sidebarContent}
        </aside>
      )}

      {/* Mobile nav sheet */}
      {isMobile && (
        <>
          <div
            id="projectsRailSheet"
            ref={mobileSheetRef}
            className="mobile-sheet"
            aria-hidden={!mobileNavOpen}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
          >
            {sidebarContent}
          </div>
          <div
            className="mobile-sheet-backdrop"
            aria-hidden={!mobileNavOpen}
            onClick={() => setMobileNavOpen(false)}
          />
        </>
      )}

      <div ref={appMainRef} className="app-main">
        {loadState === "loading" && (
          <div className="loading-bar" aria-label="Loading">
            <div className="loading-bar__fill" />
          </div>
        )}
        <ErrorBoundary>
          {page === "settings" ? (
            <SettingsPage
              dark={dark}
              onToggleDark={toggleDarkMode}
              uiMode={uiMode}
              onToggleUiMode={() => {
                const next = uiMode === "normal" ? "simple" : "normal";
                setUiMode(next);
                localStorage.setItem("todos:ui-mode", next);
              }}
              density={density}
              onCycleDensity={cycleDensity}
              onBack={() => startTransition(() => setPage("todos"))}
            />
          ) : page === "components" ? (
            <ComponentGalleryPage
              user={user}
              dark={dark}
              isAdmin={user?.role === "admin"}
              onBack={() => startTransition(() => setPage("todos"))}
              onOpenProfile={() => startTransition(() => setPage("settings"))}
              onOpenSettings={() => startTransition(() => setPage("settings"))}
              onToggleTheme={toggleDarkMode}
              onOpenShortcuts={() => setShortcutsOpen(true)}
              onOpenFeedback={() => startTransition(() => setPage("feedback"))}
              onOpenAdmin={() => startTransition(() => setPage("admin"))}
              onLogout={logout}
            />
          ) : page === "ai" ? (
            <>
              <header className="app-header">
                {isMobile && (
                  <button
                    className="mobile-header__menu-btn"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open navigation"
                  >
                    <IconMenu />
                  </button>
                )}
                <button
                  className="btn"
                  onClick={() => startTransition(() => setPage("todos"))}
                >
                  ← Back
                </button>
                <span className="app-header__title">AI Workspace</span>
              </header>
              <div className="app-content">
                <Suspense
                  fallback={
                    <div className="loading-skeleton loading">
                      <div className="loading-skeleton__row" />
                    </div>
                  }
                >
                  <AiWorkspace />
                </Suspense>
              </div>
            </>
          ) : page === "admin" ? (
            <Suspense
              fallback={
                <div className="loading-skeleton loading">
                  <div className="loading-skeleton__row" />
                </div>
              }
            >
              <AdminPage
                onBack={() => startTransition(() => setPage("todos"))}
              />
            </Suspense>
          ) : page === "feedback" ? (
            <Suspense
              fallback={
                <div className="loading-skeleton loading">
                  <div className="loading-skeleton__row" />
                </div>
              }
            >
              <FeedbackForm
                onBack={() => startTransition(() => setPage("todos"))}
              />
            </Suspense>
          ) : page === "review" ? (
            <Suspense
              fallback={
                <div className="loading-skeleton loading">
                  <div className="loading-skeleton__row" />
                </div>
              }
            >
              <WeeklyReview
                onBack={() => startTransition(() => setPage("todos"))}
                onApplied={() => {
                  void loadTodos(queryParams);
                  void loadProjects();
                }}
              />
            </Suspense>
          ) : (
            <ViewRouter activeViewKey={activeViewKey} capacity={3}>
              <ViewRoute viewKey="home">
                {!isMobile && (
                  <header className="app-header">
                    <span className="app-header__title">Focus</span>
                    <button
                      className="btn"
                      data-new-task-trigger="true"
                      onClick={() => setComposerOpen(true)}
                      id="topBarNewTaskCta"
                    >
                      + New Task
                    </button>
                    <button
                      className="btn"
                      onClick={toggleDarkMode}
                      aria-label="Toggle dark mode"
                      style={{ fontSize: "var(--fs-label)" }}
                    >
                      {dark ? <IconSun /> : <IconMoon />}
                    </button>
                    {user && (
                      <button
                        className="btn"
                        style={{ fontSize: "var(--fs-label)" }}
                        onClick={logout}
                      >
                        Logout
                      </button>
                    )}
                  </header>
                )}
                {isMobile && (
                  <div className="mobile-header">
                    <button
                      id="projectsRailMobileOpen"
                      className="mobile-header__menu-btn"
                      onClick={() => setMobileNavOpen(true)}
                      aria-label="Open navigation"
                    >
                      <IconMenu />
                    </button>
                    <span className="app-header__title">Focus</span>
                    <button
                      className="btn"
                      data-new-task-trigger="true"
                      onClick={() => setComposerOpen(true)}
                      style={{
                        marginLeft: "auto",
                        fontSize: "var(--fs-label)",
                      }}
                    >
                      + New
                    </button>
                  </div>
                )}
                <div className="app-content">
                  <HomeDashboard
                    todos={todos}
                    projects={projects}
                    onTodoClick={handleOpenDrawer}
                    onToggleTodo={handleToggle}
                    onEditTodo={(id, updates) => {
                      editTodo(id, updates);
                    }}
                    onNavigate={(v) => {
                      handleSelectView(v);
                      handleSelectProject(null);
                    }}
                    onSelectProject={(id) => {
                      handleSelectProject(id);
                      startTransition(() => setPage("todos"));
                    }}
                    onNavigateToTuneUp={() => handleSelectView("tuneup")}
                    onUndo={(action) =>
                      setUndoAction({
                        message: action.message,
                        onUndo: action.onUndo,
                      })
                    }
                  />
                </div>
              </ViewRoute>

              <ViewRoute viewKey="triage">
                {isMobile && (
                  <div className="mobile-header">
                    <button
                      id="projectsRailMobileOpen"
                      className="mobile-header__menu-btn"
                      onClick={() => setMobileNavOpen(true)}
                      aria-label="Open navigation"
                    >
                      <IconMenu />
                    </button>
                    <span className="app-header__title">Desk</span>
                  </div>
                )}
                <DeskView
                  todos={todos}
                  onTodoClick={handleOpenDrawer}
                  onToggleTodo={handleToggle}
                  onRefreshTodos={() => loadTodos(queryParams)}
                  onOpenComposer={() => setComposerOpen(true)}
                />
              </ViewRoute>

              <ViewRoute viewKey="tuneup">
                <div className="app-content">
                  <TuneUpView
                    onOpenTask={(taskId) => {
                      handleSelectView("all");
                      handleOpenDrawer(taskId);
                    }}
                    onUndo={(action) =>
                      setUndoAction({
                        message: action.message,
                        onUndo: action.onUndo,
                      })
                    }
                  />
                </div>
              </ViewRoute>

              {/* List views with shared header */}
              {(
                [
                  "all",
                  "today",
                  "upcoming",
                  "waiting",
                  "scheduled",
                  "someday",
                  "completed",
                ] as const
              ).map((view) => (
                <ViewRoute key={view} viewKey={view}>
                  <ListViewHeader
                    headerTitle={VIEW_LABELS[view] ?? view}
                    activeView={view}
                    selectedProjectId={null}
                    isMobile={isMobile}
                    visibleTodos={visibleTodos}
                    loadState={loadState}
                    filtersOpen={filtersOpen}
                    onToggleFilters={() => setFiltersOpen((o) => !o)}
                    activeFilters={activeFilters}
                    onFilterChange={setActiveFilters}
                    activeTagFilter={activeTagFilter}
                    onClearTagFilter={() => setActiveTagFilter("")}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={(f, o) => {
                      setSortBy(f);
                      setSortOrder(o);
                    }}
                    onOpenNav={() => setMobileNavOpen(true)}
                    onNewTask={() => setComposerOpen(true)}
                    onToggleDark={toggleDarkMode}
                    onLogout={logout}
                    onClearProject={() => handleSelectProject(null)}
                    viewLabels={VIEW_LABELS}
                    bulkMode={bulkMode}
                    selectedIds={selectedIds}
                    onSelectAll={handleSelectAll}
                    onBulkComplete={handleBulkComplete}
                    onBulkDelete={handleBulkDelete}
                    onCancelBulk={handleCancelBulk}
                    uiMode={uiMode}
                    onAddTodo={addTodo}
                    onCaptureToDesk={handleCaptureToDesk}
                    quickEntryPlaceholder={quickEntryPlaceholder}
                    activeHeadingId={null}
                    onSelectHeading={() => {}}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    todos={todos}
                    onExportIcs={exportIcs}
                    onExportMessage={(msg) => setUndoAction({ message: msg })}
                    user={user}
                    dark={dark}
                  />
                  <div className="app-content">
                    {viewMode === "board" ? (
                      <Suspense
                        fallback={
                          <div className="loading-skeleton loading">
                            <div className="loading-skeleton__row" />
                          </div>
                        }
                      >
                        <BoardView
                          todos={visibleTodos}
                          loadState={loadState}
                          onToggle={handleToggle}
                          onClick={handleOpenDrawer}
                          onStatusChange={editTodo}
                        />
                      </Suspense>
                    ) : (
                      <SortableTodoList
                        todos={visibleTodos}
                        loadState={loadState}
                        errorMessage={errorMessage}
                        activeTodoId={activeTodoId}
                        expandedTodoId={expandedTodoId}
                        isBulkMode={bulkMode}
                        selectedIds={selectedIds}
                        projects={projects}
                        headings={[]}
                        onToggle={handleToggle}
                        onClick={handleQuickEdit}
                        onKebab={handleOpenDrawer}
                        onRetry={() => loadTodos(queryParams)}
                        onSelect={handleBulkSelect}
                        onInlineEdit={handleInlineEdit}
                        onSave={editTodo}
                        onTagClick={handleTagClick}
                        onLifecycleAction={handleLifecycleAction}
                        onReorder={handleReorder}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSortChange={(f, o) => {
                          setSortBy(f);
                          setSortOrder(o);
                        }}
                      />
                    )}
                  </div>
                </ViewRoute>
              ))}

              {/* Dynamic project view */}
              {selectedProjectId && (
                <ViewRoute viewKey={`project:${selectedProjectId}`}>
                  <ListViewHeader
                    headerTitle={headerTitle}
                    activeView={activeView}
                    selectedProjectId={selectedProjectId}
                    isMobile={isMobile}
                    visibleTodos={visibleTodos}
                    loadState={loadState}
                    filtersOpen={filtersOpen}
                    onToggleFilters={() => setFiltersOpen((o) => !o)}
                    activeFilters={activeFilters}
                    onFilterChange={setActiveFilters}
                    activeTagFilter={activeTagFilter}
                    onClearTagFilter={() => setActiveTagFilter("")}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={(f, o) => {
                      setSortBy(f);
                      setSortOrder(o);
                    }}
                    onOpenNav={() => setMobileNavOpen(true)}
                    onNewTask={() => setComposerOpen(true)}
                    onToggleDark={toggleDarkMode}
                    onLogout={logout}
                    onClearProject={() => handleSelectProject(null)}
                    viewLabels={VIEW_LABELS}
                    bulkMode={bulkMode}
                    selectedIds={selectedIds}
                    onSelectAll={handleSelectAll}
                    onBulkComplete={handleBulkComplete}
                    onBulkDelete={handleBulkDelete}
                    onCancelBulk={handleCancelBulk}
                    uiMode={uiMode}
                    onAddTodo={addTodo}
                    onCaptureToDesk={handleCaptureToDesk}
                    quickEntryPlaceholder={quickEntryPlaceholder}
                    activeHeadingId={activeHeadingId}
                    onSelectHeading={setActiveHeadingId}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    todos={todos}
                    onExportIcs={exportIcs}
                    onExportMessage={(msg) => setUndoAction({ message: msg })}
                    user={user}
                    dark={dark}
                  />
                  <div className="app-content">
                    {viewMode === "board" ? (
                      <Suspense
                        fallback={
                          <div className="loading-skeleton loading">
                            <div className="loading-skeleton__row" />
                          </div>
                        }
                      >
                        <BoardView
                          todos={visibleTodos}
                          loadState={loadState}
                          onToggle={handleToggle}
                          onClick={handleOpenDrawer}
                          onStatusChange={editTodo}
                        />
                      </Suspense>
                    ) : (
                      <SortableTodoList
                        todos={visibleTodos}
                        loadState={loadState}
                        errorMessage={errorMessage}
                        activeTodoId={activeTodoId}
                        expandedTodoId={expandedTodoId}
                        isBulkMode={bulkMode}
                        selectedIds={selectedIds}
                        projects={projects}
                        headings={[]}
                        onToggle={handleToggle}
                        onClick={handleQuickEdit}
                        onKebab={handleOpenDrawer}
                        onRetry={() => loadTodos(queryParams)}
                        onSelect={handleBulkSelect}
                        onInlineEdit={handleInlineEdit}
                        onSave={editTodo}
                        onTagClick={handleTagClick}
                        onLifecycleAction={handleLifecycleAction}
                        onReorder={handleReorder}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSortChange={(f, o) => {
                          setSortBy(f);
                          setSortOrder(o);
                        }}
                      />
                    )}
                  </div>
                </ViewRoute>
              )}
            </ViewRouter>
          )}
        </ErrorBoundary>
      </div>

      {fullPageTaskId &&
        (() => {
          const fullPageTodo = todos.find((t) => t.id === fullPageTaskId);
          return fullPageTodo ? (
            <TaskFullPage
              todo={fullPageTodo}
              projects={projects}
              onSave={editTodo}
              onDelete={handleDeleteRequest}
              onBack={() => taskNav.deescalate()}
            />
          ) : null;
        })()}

      <TodoDrawer
        todo={activeTodo}
        projects={projects}
        onClose={handleCloseDrawer}
        onSave={editTodo}
        onDelete={handleDeleteRequest}
        onOpenFullPage={(id) => taskNav.openFullPage(id)}
      />

      {deleteTarget && (
        <ConfirmDialog
          title="Delete task"
          message="Are you sure you want to delete this task? This cannot be undone."
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={handlePaletteNavigate}
        onWeeklyReview={() => startTransition(() => setPage("review"))}
        onToggleDarkMode={toggleDarkMode}
        onOpenSettings={() => startTransition(() => setPage("settings"))}
        onOpenFeedback={() => startTransition(() => setPage("feedback"))}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onNewTask={focusQuickEntryOrOpenComposer}
        onFocusSearch={focusSearchInput}
        onExportCalendar={() => {
          const withDates = todos.filter((t) => t.dueDate);
          if (withDates.length === 0) {
            setUndoAction({ message: "No tasks with due dates to export" });
            return;
          }
          exportIcs(withDates);
          setUndoAction({
            message: `Exported ${withDates.length} tasks to .ics`,
          });
        }}
        onLogout={logout}
        projects={projects}
        todos={todos}
        onTodoClick={(id) => {
          taskNav.openDrawer(id);
          setPaletteOpen(false);
        }}
        onProjectOpen={(id) => {
          startTransition(() => setPage("todos"));
          handleSelectProject(id);
          setPaletteOpen(false);
        }}
      />

      {projectCrudMode && (
        <ProjectCrud
          mode={projectCrudMode}
          currentName={renameTarget?.name}
          projectId={renameTarget?.id}
          onDone={() => {
            setProjectCrudMode(null);
            setRenameTarget(null);
            loadProjects();
          }}
          onCancel={() => {
            setProjectCrudMode(null);
            setRenameTarget(null);
          }}
        />
      )}

      <ShortcutsOverlay
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <Suspense fallback={null}>
        <TaskComposer
          isOpen={composerOpen}
          projects={projects}
          defaultProjectId={selectedProjectId}
          workspaceView={activeView}
          onSubmitTask={async (dto) => {
            await addTodo(dto);
          }}
          onCaptureToDesk={handleCaptureToDesk}
          onClose={() => setComposerOpen(false)}
        />
      </Suspense>

      <UndoToast action={undoAction} onDismiss={() => setUndoAction(null)} />

      {showOnboarding && (
        <OnboardingFlow onComplete={() => {}} onAddTodo={addTodo} />
      )}
    </div>
  );
}
