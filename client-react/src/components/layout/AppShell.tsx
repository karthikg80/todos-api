import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useTodosStore } from "../../store/useTodosStore";
import { useProjectsStore } from "../../store/useProjectsStore";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useDensity } from "../../hooks/useDensity";
import {
  IconMoon,
  IconSun,
  IconMenu,
  IconCalendar,
  IconList,
  IconBoard,
  IconPlus,
} from "../shared/Icons";
import { useIcsExport } from "../../hooks/useIcsExport";
import { Sidebar, type WorkspaceView } from "../projects/Sidebar";
import { QuickEntry } from "../todos/QuickEntry";
import { SortableTodoList } from "../todos/SortableTodoList";
import { TodoDrawer } from "../todos/TodoDrawer";
import { BulkToolbar } from "../todos/BulkToolbar";
import { SortControl, type SortField, type SortOrder } from "../todos/SortControl";
import { SearchBar } from "../shared/SearchBar";
import { UndoToast } from "../shared/UndoToast";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { CommandPalette } from "../shared/CommandPalette";
import { ShortcutsOverlay } from "../shared/ShortcutsOverlay";
import { Tooltip } from "../shared/Tooltip";
import { Breadcrumb } from "../shared/Breadcrumb";
import { AnimatedCount } from "../shared/AnimatedCount";
import { ErrorBoundary } from "../shared/ErrorBoundary";
import { SettingsPage } from "./SettingsPage";
import { HomeDashboard } from "./HomeDashboard";
import { DeskView } from "../desk/DeskView";
import { ProjectCrud } from "../projects/ProjectCrud";
import { VerificationBanner } from "../shared/VerificationBanner";
import { OnboardingFlow } from "../shared/OnboardingFlow";
import { ProjectHeadings } from "../projects/ProjectHeadings";
import * as todosApi from "../../api/todos";

// Lazy-loaded heavy components (code splitting)
const BoardView = lazy(() => import("../todos/BoardView").then((m) => ({ default: m.BoardView })));
const TaskComposer = lazy(() => import("../todos/TaskComposer").then((m) => ({ default: m.TaskComposer })));
const AiWorkspace = lazy(() => import("../ai/AiWorkspace").then((m) => ({ default: m.AiWorkspace })));
const AdminPage = lazy(() => import("../admin/AdminPage").then((m) => ({ default: m.AdminPage })));
const FeedbackForm = lazy(() => import("../feedback/FeedbackForm").then((m) => ({ default: m.FeedbackForm })));

type AppPage = "todos" | "settings" | "ai" | "admin" | "feedback";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("todos:onboarding-complete"),
  );
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [uiMode, setUiMode] = useState<UiMode>(
    () => (localStorage.getItem("todos:ui-mode") as UiMode) || "normal",
  );
  const exportIcs = useIcsExport();

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
        // Only future-dated incomplete tasks
        filtered = filtered.filter(
          (t) => !t.completed && t.dueDate && t.dueDate.split("T")[0] > today,
        );
      }
    }

    if (searchQuery.trim()) {
      // Search is global — searches all todos, not just current view
      const q = searchQuery.toLowerCase();
      filtered = todos.filter(
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

    return filtered;
  }, [todos, activeView, selectedProjectId, searchQuery, activeTagFilter, activeHeadingId]);

  const activeTodo = useMemo(
    () => todos.find((t) => t.id === activeTodoId) ?? null,
    [todos, activeTodoId],
  );

  // Count badges for workspace views
  const viewCounts = useMemo(() => {
    const active = todos.filter((t) => !t.completed);
    const today = new Date().toISOString().split("T")[0];
    return {
      triage: active.filter(
        (t) => t.status === "inbox" || (!t.projectId && !t.category),
      ).length,
      today: active.filter(
        (t) => t.dueDate && t.dueDate.split("T")[0] <= today,
      ).length,
      upcoming: active.filter(
        (t) => t.dueDate && t.dueDate.split("T")[0] > today,
      ).length,
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
      default:
        return "Add a task…";
    }
  }, [selectedProjectId, projects, activeView]);

  // --- Handlers ---

  const handleTodoClick = useCallback((id: string) => {
    setActiveTodoId(id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setActiveTodoId(null);
  }, []);

  const handleInlineEdit = useCallback(
    async (id: string, title: string) => {
      await editTodo(id, { title });
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
    if (activeTodoId === deleteTarget) setActiveTodoId(null);
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
    setActiveTodoId(null);
    setBulkMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSelectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    setActiveTodoId(null);
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
    await Promise.all(ids.map((id) => todosApi.updateTodo(id, { completed: true })));
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
          setPaletteOpen(false);
        } else if (activeTodoId) {
          setActiveTodoId(null);
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
        document.getElementById("todoInput")?.focus();
        return;
      }

      // '/': focus search
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("searchInput")?.focus();
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
        setActiveTodoId(ids[nextIdx]);
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
        handleTodoClick(activeTodoId);
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
  }, [activeTodoId, bulkMode, mobileNavOpen, paletteOpen, handleCancelBulk]);

  // --- Derived ---

  const VIEW_LABELS: Record<string, string> = {
    home: "Focus",
    triage: "Desk",
    all: "Everything",
    today: "Today",
    upcoming: "Upcoming",
    completed: "Completed",
  };

  const headerTitle = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)?.name ?? "Project"
    : VIEW_LABELS[activeView] ?? activeView;

  // Dynamic page title
  useEffect(() => {
    const pageLabel =
      page === "settings"
        ? "Settings"
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
      setPage("todos");
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
        setPage("todos");
        handleSelectView(v);
        setMobileNavOpen(false);
      }}
      onSelectProject={(id) => {
        setPage("todos");
        handleSelectProject(id);
        setMobileNavOpen(false);
      }}
      onCreateProject={() => setProjectCrudMode("create")}
      onRenameProject={(id, name) => {
        setRenameTarget({ id, name });
        setProjectCrudMode("rename");
      }}
      onOpenSettings={() => {
        setPage("settings");
        setMobileNavOpen(false);
      }}
      onOpenFeedback={() => {
        setPage("feedback");
        setMobileNavOpen(false);
      }}
      onOpenAdmin={() => {
        setPage("admin");
        setMobileNavOpen(false);
      }}
      onToggleTheme={toggleDarkMode}
      onOpenShortcuts={() => setShortcutsOpen(true)}
      onOpenProfile={() => {
        setPage("settings");
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
    <div className={`app-shell${bulkMode ? " is-bulk-selecting" : ""}${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className={`app-sidebar${sidebarCollapsed ? " app-sidebar--collapsed" : ""}`}>
          {sidebarContent}
        </aside>
      )}

      {/* Mobile nav sheet */}
      {isMobile && (
        <>
          <div
            id="projectsRailSheet"
            className="mobile-sheet"
            aria-hidden={!mobileNavOpen}
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

      <div className="app-main">
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
            onBack={() => setPage("todos")}
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
              <button className="btn" onClick={() => setPage("todos")}>
                ← Back
              </button>
              <span className="app-header__title">AI Workspace</span>
            </header>
            <div className="app-content">
              <Suspense fallback={<div className="loading-skeleton loading"><div className="loading-skeleton__row" /></div>}>
                <AiWorkspace />
              </Suspense>
            </div>
          </>
        ) : page === "admin" ? (
          <Suspense fallback={<div className="loading-skeleton loading"><div className="loading-skeleton__row" /></div>}>
            <AdminPage onBack={() => setPage("todos")} />
          </Suspense>
        ) : page === "feedback" ? (
          <Suspense fallback={<div className="loading-skeleton loading"><div className="loading-skeleton__row" /></div>}>
            <FeedbackForm onBack={() => setPage("todos")} />
          </Suspense>
        ) : activeView === "home" && !selectedProjectId ? (
          <>
            {!isMobile && (
              <header className="app-header">
                <span className="app-header__title">Focus</span>
                <button
                  className="btn"
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
                  onClick={() => setComposerOpen(true)}
                  style={{ marginLeft: "auto", fontSize: "var(--fs-label)" }}
                >
                  + New
                </button>
              </div>
            )}
            <div className="app-content">
              <HomeDashboard
                todos={todos}
                projects={projects}
                onTodoClick={handleTodoClick}
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
                  setPage("todos");
                }}
              />
            </div>
          </>
        ) : activeView === "triage" && !selectedProjectId ? (
          <>
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
              onTodoClick={handleTodoClick}
              onToggleTodo={handleToggle}
              onRefreshTodos={() => loadTodos(queryParams)}
              onOpenComposer={() => setComposerOpen(true)}
            />
          </>
        ) : (
          <>
            {/* Mobile header */}
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
                <span className="app-header__title">{headerTitle}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: "var(--s-2)" }}>
                  <button
                    className="btn"
                    onClick={() => setComposerOpen(true)}
                    style={{ fontSize: "var(--fs-label)" }}
                  >
                    + New
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
                </div>
              </div>
            )}

            {/* Desktop header */}
            {!isMobile && (
              <header className="app-header">
                <span id="todosListHeaderTitle" className="app-header__title">
                  <Breadcrumb
                    items={[
                      ...(selectedProjectId
                        ? [
                            {
                              label: VIEW_LABELS[activeView] ?? "Tasks",
                              onClick: () => handleSelectProject(null),
                            },
                            { label: headerTitle },
                          ]
                        : [{ label: headerTitle }]),
                    ]}
                  />
                  {!selectedProjectId && headerTitle}
                </span>
                <span id="todosListHeaderCount" className="app-header__count">
                  {loadState === "loaded" && (
                    <>
                      <AnimatedCount
                        value={visibleTodos.filter((t) => !t.completed).length}
                      />{" "}
                      tasks
                    </>
                  )}
                </span>
                <div className="view-toggle">
                  <button
                    className={`view-toggle__btn${viewMode === "list" ? " view-toggle__btn--active" : ""}`}
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                  >
                    <IconList />
                  </button>
                  <button
                    className={`view-toggle__btn${viewMode === "board" ? " view-toggle__btn--active" : ""}`}
                    onClick={() => setViewMode("board")}
                    aria-label="Board view"
                  >
                    <IconBoard />
                  </button>
                </div>
                {viewMode === "list" && (
                  <SortControl
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onChange={(f, o) => {
                      setSortBy(f);
                      setSortOrder(o);
                    }}
                  />
                )}
                <Tooltip content="New task" shortcut="n">
                  <button
                    className="btn"
                    onClick={() => setComposerOpen(true)}
                    style={{ fontSize: "var(--fs-label)" }}
                  >
                    <IconPlus /> New Task
                  </button>
                </Tooltip>
                <Tooltip content="Export calendar" shortcut=".ics">
                  <button
                    id="exportIcsButton"
                    className="btn"
                    onClick={() => {
                      const withDates = todos.filter((t) => t.dueDate);
                      if (withDates.length === 0) {
                        setUndoAction({ message: "No tasks with due dates to export" });
                        return;
                      }
                      exportIcs(withDates);
                      setUndoAction({ message: `Exported ${withDates.length} tasks to .ics` });
                    }}
                    aria-label="Export to calendar"
                    style={{ fontSize: "var(--fs-label)" }}
                  >
                    <IconCalendar />
                  </button>
                </Tooltip>
                <Tooltip content={dark ? "Light mode" : "Dark mode"}>
                  <button
                    className="btn"
                    onClick={toggleDarkMode}
                    aria-label="Toggle dark mode"
                    style={{ fontSize: "var(--fs-label)" }}
                  >
                    {dark ? <IconSun /> : <IconMoon />}
                  </button>
                </Tooltip>
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

            {user && !user.isVerified && (
              <VerificationBanner
                email={user.email}
                isVerified={!!user.isVerified}
              />
            )}

            {activeTagFilter && (
              <div className="active-filter-bar">
                Filtered by tag: <strong>#{activeTagFilter}</strong>
                <button
                  className="active-filter-bar__clear"
                  onClick={() => setActiveTagFilter("")}
                >
                  ✕ Clear
                </button>
              </div>
            )}

            {/* Today view coaching */}
            {activeView === "today" && !selectedProjectId && visibleTodos.length > 0 && (() => {
              const overdue = visibleTodos.filter(
                (t) => t.dueDate && t.dueDate.split("T")[0] < new Date().toISOString().split("T")[0],
              ).length;
              return overdue > 0 ? (
                <div className="today-coaching-banner">
                  <span>
                    {overdue === 1
                      ? "1 task rolled over."
                      : `${overdue} tasks rolled over.`}{" "}
                    Let's make the day smaller.
                  </span>
                </div>
              ) : null;
            })()}

            {/* Bulk actions toolbar */}
            {bulkMode && (
              <BulkToolbar
                selectedCount={selectedIds.size}
                totalCount={visibleTodos.length}
                allSelected={
                  selectedIds.size === visibleTodos.length &&
                  visibleTodos.length > 0
                }
                onSelectAll={handleSelectAll}
                onComplete={handleBulkComplete}
                onDelete={handleBulkDelete}
                onCancel={handleCancelBulk}
              />
            )}

            {uiMode === "normal" && (
              <QuickEntry
                projectId={selectedProjectId}
                onAdd={addTodo}
                placeholder={quickEntryPlaceholder}
              />
            )}

            {/* Project headings */}
            {selectedProjectId && uiMode === "normal" && (
              <ProjectHeadings
                projectId={selectedProjectId}
                activeHeadingId={activeHeadingId}
                onSelectHeading={setActiveHeadingId}
              />
            )}

            {/* Mobile search */}
            {isMobile && (
              <div style={{ padding: "var(--s-2) var(--s-4)" }}>
                <SearchBar value={searchQuery} onChange={setSearchQuery} />
              </div>
            )}

            <div className="app-content">
              {viewMode === "board" ? (
                <Suspense fallback={<div className="loading-skeleton loading"><div className="loading-skeleton__row" /></div>}>
                  <BoardView
                    todos={visibleTodos}
                    loadState={loadState}
                    onToggle={handleToggle}
                    onClick={handleTodoClick}
                    onStatusChange={editTodo}
                  />
                </Suspense>
              ) : (
                <SortableTodoList
                  todos={visibleTodos}
                  loadState={loadState}
                  errorMessage={errorMessage}
                  activeTodoId={activeTodoId}
                  isBulkMode={bulkMode}
                  selectedIds={selectedIds}
                  onToggle={handleToggle}
                  onClick={handleTodoClick}
                  onKebab={handleTodoClick}
                  onRetry={() => loadTodos(queryParams)}
                  onSelect={handleBulkSelect}
                  onInlineEdit={handleInlineEdit}
                  onTagClick={handleTagClick}
                  onReorder={handleReorder}
                />
              )}
            </div>
          </>
        )}
        </ErrorBoundary>
      </div>

      <TodoDrawer
        todo={activeTodo}
        projects={projects}
        onClose={handleCloseDrawer}
        onSave={editTodo}
        onDelete={handleDeleteRequest}
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
        onToggleDarkMode={toggleDarkMode}
        onLogout={logout}
        todos={todos}
        onTodoClick={(id) => {
          setActiveTodoId(id);
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
          onSubmit={async (dto) => {
            await addTodo(dto);
          }}
          onClose={() => setComposerOpen(false)}
        />
      </Suspense>

      <UndoToast action={undoAction} onDismiss={() => setUndoAction(null)} />

      {showOnboarding && (
        <OnboardingFlow
          onComplete={() => setShowOnboarding(false)}
          onAddTodo={addTodo}
        />
      )}
    </div>
  );
}
