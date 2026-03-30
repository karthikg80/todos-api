import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useTodosStore } from "../../store/useTodosStore";
import { useProjectsStore } from "../../store/useProjectsStore";
import { useDarkMode } from "../../hooks/useDarkMode";
import { Sidebar, type DateView } from "../projects/Sidebar";
import { QuickEntry } from "../todos/QuickEntry";
import { TodoList } from "../todos/TodoList";
import { TodoDrawer } from "../todos/TodoDrawer";
import { BulkToolbar } from "../todos/BulkToolbar";
import { SearchBar } from "../shared/SearchBar";
import { UndoToast } from "../shared/UndoToast";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { CommandPalette } from "../shared/CommandPalette";
import { SettingsPage } from "./SettingsPage";
import { ProjectCrud } from "../projects/ProjectCrud";
import * as todosApi from "../../api/todos";

type AppPage = "todos" | "settings";

interface UndoAction {
  message: string;
  onUndo: () => void;
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeView, setActiveView] = useState<DateView>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [page, setPage] = useState<AppPage>("todos");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [projectCrudMode, setProjectCrudMode] = useState<"create" | null>(null);

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
        case "today":
          params.sortBy = "dueDate";
          params.sortOrder = "asc";
          break;
        case "completed":
          params.completed = "true";
          break;
        case "waiting":
          params.status = "waiting";
          break;
        case "someday":
          params.status = "someday";
          break;
        case "upcoming":
          params.sortBy = "dueDate";
          params.sortOrder = "asc";
          break;
      }
    }
    return params;
  }, [activeView, selectedProjectId]);

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

    if (activeView === "today" && !selectedProjectId) {
      const today = new Date().toISOString().split("T")[0];
      filtered = filtered.filter(
        (t) => !t.completed && t.dueDate && t.dueDate.split("T")[0] <= today,
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }

    return filtered;
  }, [todos, activeView, selectedProjectId, searchQuery]);

  const activeTodo = useMemo(
    () => todos.find((t) => t.id === activeTodoId) ?? null,
    [todos, activeTodoId],
  );

  // --- Handlers ---

  const handleTodoClick = useCallback((id: string) => {
    setActiveTodoId(id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setActiveTodoId(null);
  }, []);

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

  const handleSelectView = useCallback((view: DateView) => {
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

      // 'n' when no input focused: focus quick entry
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        document.getElementById("todoInput")?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeTodoId, bulkMode, mobileNavOpen, paletteOpen, handleCancelBulk]);

  // --- Derived ---

  const headerTitle = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)?.name ?? "Project"
    : activeView === "all"
      ? "Everything"
      : activeView.charAt(0).toUpperCase() + activeView.slice(1);

  const handlePaletteNavigate = useCallback(
    (view: DateView) => {
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
      onOpenSettings={() => {
        setPage("settings");
        setMobileNavOpen(false);
      }}
    />
  );

  return (
    <div className={`app-shell${bulkMode ? " is-bulk-selecting" : ""}`}>
      {/* Desktop sidebar */}
      {!isMobile && <aside className="app-sidebar">{sidebarContent}</aside>}

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
        {page === "settings" ? (
          <SettingsPage
            dark={dark}
            onToggleDark={toggleDarkMode}
            onBack={() => setPage("todos")}
          />
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
                  ☰
                </button>
                <span className="app-header__title">{headerTitle}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: "var(--s-2)" }}>
                  <button
                    className="btn"
                    onClick={toggleDarkMode}
                    aria-label="Toggle dark mode"
                    style={{ fontSize: "var(--fs-label)" }}
                  >
                    {dark ? "☀️" : "🌙"}
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
                  {headerTitle}
                </span>
                <span id="todosListHeaderCount" className="app-header__count">
                  {loadState === "loaded"
                    ? `${visibleTodos.filter((t) => !t.completed).length} tasks`
                    : ""}
                </span>
                <SearchBar value={searchQuery} onChange={setSearchQuery} />
                <button
                  className="btn"
                  onClick={toggleDarkMode}
                  aria-label="Toggle dark mode"
                  style={{ fontSize: "var(--fs-label)" }}
                >
                  {dark ? "☀️" : "🌙"}
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

            <QuickEntry projectId={selectedProjectId} onAdd={addTodo} />

            {/* Mobile search */}
            {isMobile && (
              <div style={{ padding: "var(--s-2) var(--s-4)" }}>
                <SearchBar value={searchQuery} onChange={setSearchQuery} />
              </div>
            )}

            <div className="app-content">
              <TodoList
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
              />
            </div>
          </>
        )}
      </div>

      <TodoDrawer
        todo={activeTodo}
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
      />

      {projectCrudMode && (
        <ProjectCrud
          mode={projectCrudMode}
          onDone={() => {
            setProjectCrudMode(null);
            loadProjects();
          }}
          onCancel={() => setProjectCrudMode(null)}
        />
      )}

      <UndoToast action={undoAction} onDismiss={() => setUndoAction(null)} />
    </div>
  );
}
