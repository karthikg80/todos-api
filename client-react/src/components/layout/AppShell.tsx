import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useTodosStore } from "../../store/useTodosStore";
import { useProjectsStore } from "../../store/useProjectsStore";
import { Sidebar, type DateView } from "../projects/Sidebar";
import { QuickEntry } from "../todos/QuickEntry";
import { TodoList } from "../todos/TodoList";
import { TodoDrawer } from "../todos/TodoDrawer";
import { ConfirmDialog } from "../shared/ConfirmDialog";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeView, setActiveView] = useState<DateView>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
        case "today": {
          const today = new Date().toISOString().split("T")[0];
          params.sortBy = "dueDate";
          params.sortOrder = "asc";
          // Server doesn't support date range filter — filter client-side
          break;
        }
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

  // Client-side date filtering for "today" view
  const visibleTodos = useMemo(() => {
    if (activeView === "today" && !selectedProjectId) {
      const today = new Date().toISOString().split("T")[0];
      return todos.filter(
        (t) =>
          !t.completed &&
          t.dueDate &&
          t.dueDate.split("T")[0] <= today,
      );
    }
    return todos;
  }, [todos, activeView, selectedProjectId]);

  const activeTodo = useMemo(
    () => todos.find((t) => t.id === activeTodoId) ?? null,
    [todos, activeTodoId],
  );

  const handleTodoClick = useCallback((id: string) => {
    setActiveTodoId(id);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setActiveTodoId(null);
  }, []);

  const handleDeleteRequest = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await removeTodo(deleteTarget);
    if (activeTodoId === deleteTarget) setActiveTodoId(null);
    setDeleteTarget(null);
  }, [deleteTarget, activeTodoId, removeTodo]);

  const handleSelectView = useCallback((view: DateView) => {
    setActiveView(view);
    setActiveTodoId(null);
  }, []);

  const handleSelectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id);
    setActiveTodoId(null);
  }, []);

  // Header title
  const headerTitle = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)?.name ?? "Project"
    : activeView === "all"
      ? "Everything"
      : activeView.charAt(0).toUpperCase() + activeView.slice(1);

  const sidebarContent = (
    <Sidebar
      projects={projects}
      activeView={activeView}
      selectedProjectId={selectedProjectId}
      onSelectView={(v) => {
        handleSelectView(v);
        setMobileNavOpen(false);
      }}
      onSelectProject={(id) => {
        handleSelectProject(id);
        setMobileNavOpen(false);
      }}
    />
  );

  return (
    <div className="app-shell">
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
            {user && (
              <button
                className="btn"
                style={{ marginLeft: "auto", fontSize: "var(--fs-label)" }}
                onClick={logout}
              >
                Logout
              </button>
            )}
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

        <QuickEntry
          projectId={selectedProjectId}
          onAdd={addTodo}
        />

        <div className="app-content">
          <TodoList
            todos={visibleTodos}
            loadState={loadState}
            errorMessage={errorMessage}
            activeTodoId={activeTodoId}
            onToggle={toggleTodo}
            onClick={handleTodoClick}
            onKebab={handleTodoClick}
            onRetry={() => loadTodos(queryParams)}
          />
        </div>
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
    </div>
  );
}
