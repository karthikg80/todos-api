import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useTodosStore } from "../store/useTodosStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { useDarkMode } from "../hooks/useDarkMode";
import { useTabBar } from "./hooks/useTabBar";
import { useScrollPersistence } from "./hooks/useScrollPersistence";
import { useBottomSheet } from "./hooks/useBottomSheet";
import { usePalette } from "./hooks/usePalette";
import { TabBar } from "./components/TabBar";
import { BottomSheet } from "./components/BottomSheet";
import { QuickCapture } from "./components/QuickCapture";
import { ProfileSheet } from "./components/ProfileSheet";
import { FieldPicker } from "./components/FieldPicker";
import { PullToSearch } from "./components/PullToSearch";
import { PullToRefresh } from "./components/PullToRefresh";
import { OfflineBanner } from "./components/OfflineBanner";
import { SnoozePicker } from "./components/SnoozePicker";
import { InstallBanner } from "./components/InstallBanner";
import { Onboarding } from "./components/Onboarding";
import type { TodoStatus, Priority } from "../types";
import { FocusScreen } from "./screens/FocusScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { CustomScreen } from "./screens/CustomScreen";
import { apiCall } from "../api/client";
import "./mobile.css";

const STATUS_OPTIONS: { key: TodoStatus; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "next", label: "Next" },
  { key: "in_progress", label: "In Progress" },
  { key: "waiting", label: "Waiting" },
  { key: "scheduled", label: "Scheduled" },
  { key: "someday", label: "Someday" },
];

const PRIORITY_OPTIONS: { key: Priority; label: string; color: string }[] = [
  { key: "low", label: "Low", color: "var(--muted)" },
  { key: "medium", label: "Medium", color: "var(--accent)" },
  { key: "high", label: "High", color: "var(--warning)" },
  { key: "urgent", label: "Urgent", color: "var(--danger)" },
];

const ENERGY_OPTIONS: { key: "low" | "medium" | "high"; label: string }[] = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

export function MobileShell() {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleDarkMode } = useDarkMode();
  const { todos, loadTodos, addTodo, toggleTodo, editTodo, removeTodo } = useTodosStore();
  const { projects, loadProjects } = useProjectsStore();
  const { activeTab, setActiveTab, customView, setCustomView } = useTabBar();
  const { save: saveScroll, restore: restoreScroll } = useScrollPersistence();
  const { palette, setPalette } = usePalette();
  const prevTabRef = useRef<string>(activeTab);
  const bottomSheet = useBottomSheet();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [snoozeTargetId, setSnoozeTargetId] = useState<string | null>(null);
  const [page, setPage] = useState<"todos" | "ai" | "review" | "admin">("todos");

  useEffect(() => { loadTodos({}); loadProjects(); }, [loadTodos, loadProjects]);

  useEffect(() => {
    const prev = prevTabRef.current as typeof activeTab;
    if (prev !== activeTab) {
      saveScroll(prev);
      prevTabRef.current = activeTab;
      // Restore after the new screen renders
      requestAnimationFrame(() => restoreScroll(activeTab));
    }
  }, [activeTab, saveScroll, restoreScroll]);

  const handleTodoClick = useCallback((id: string) => bottomSheet.openHalf(id), [bottomSheet]);
  const handleToggleTodo = useCallback((id: string, completed: boolean) => toggleTodo(id, completed), [toggleTodo]);
  const handleCreateTask = useCallback(async (dto: Parameters<typeof addTodo>[0]) => { await addTodo(dto); }, [addTodo]);
  const handleCreateProject = useCallback(async (name: string) => {
    await apiCall("/projects", { method: "POST", body: JSON.stringify({ name }) });
    await loadProjects();
  }, [loadProjects]);
  const handleAvatarClick = useCallback(() => { setProfileOpen(true); }, []);
  const handleRefresh = useCallback(async () => {
    await Promise.all([loadTodos({}), loadProjects()]);
  }, [loadTodos, loadProjects]);
  const handleSnoozeTodo = useCallback((id: string) => { setSnoozeTargetId(id); }, []);
  const handleSnoozeConfirm = useCallback((date: string) => {
    if (snoozeTargetId) editTodo(snoozeTargetId, { dueDate: date });
    setSnoozeTargetId(null);
  }, [snoozeTargetId, editTodo]);
  const handleSnoozeClose = useCallback(() => { setSnoozeTargetId(null); }, []);
  const handleToggleSubtask = useCallback(async (todoId: string, subtaskId: string, completed: boolean) => {
    await apiCall(`/todos/${todoId}/subtasks/${subtaskId}`, {
      method: "PUT",
      body: JSON.stringify({ completed }),
    });
    loadTodos({});
  }, [loadTodos]);

  const sheetTodo = useMemo(
    () => (bottomSheet.taskId ? todos.find((t) => t.id === bottomSheet.taskId) ?? null : null),
    [bottomSheet.taskId, todos]);
  const sheetProject = useMemo(
    () => (sheetTodo?.projectId ? projects.find((p) => p.id === sheetTodo.projectId) ?? null : null),
    [sheetTodo, projects]);

  const projectOptions = useMemo(
    () => projects.map((p) => ({ key: p.id, label: p.name })),
    [projects],
  );

  const halfContent = sheetTodo ? (
    <div className="m-sheet-half">
      <div className="m-sheet-half__header">
        <span className={`m-todo-row__check${sheetTodo.completed ? " m-todo-row__check--done" : ""}`} />
        <div>
          <div className="m-sheet-half__title">{sheetTodo.title}</div>
          {sheetTodo.description && <div className="m-sheet-half__desc">{sheetTodo.description}</div>}
        </div>
      </div>
      <div className="m-sheet-half__pills">
        {sheetTodo.priority && <span className={`m-pill m-priority--${sheetTodo.priority}`}>● {sheetTodo.priority}</span>}
        {sheetTodo.status && <span className="m-pill m-pill--status">{sheetTodo.status}</span>}
        {sheetTodo.dueDate && <span className="m-pill m-pill--due">due {new Date(sheetTodo.dueDate).toLocaleDateString()}</span>}
        {sheetProject && <span className="m-pill m-pill--project">{sheetProject.name}</span>}
      </div>
      {sheetTodo.subtasks && sheetTodo.subtasks.length > 0 && (
        <div className="m-sheet-half__subtasks">
          <div className="m-sheet-half__subtasks-label">Subtasks · {sheetTodo.subtasks.filter((s) => s.completed).length}/{sheetTodo.subtasks.length}</div>
          {sheetTodo.subtasks.map((s) => (
            <button
              key={s.id}
              className={`m-sheet-half__subtask${s.completed ? " m-sheet-half__subtask--done" : ""}`}
              onClick={() => handleToggleSubtask(sheetTodo.id, s.id, !s.completed)}
            >
              {s.completed ? "☑" : "☐"} {s.title}
            </button>
          ))}
        </div>
      )}
      <div className="m-sheet-half__actions">
        <button className="m-sheet-half__action m-sheet-half__action--complete" onClick={() => { toggleTodo(sheetTodo.id, !sheetTodo.completed); bottomSheet.close(); }}>✓ Complete</button>
        <button className="m-sheet-half__action" onClick={() => bottomSheet.expandFull()}>✎ Edit</button>
      </div>
    </div>
  ) : null;

  const fullContent = sheetTodo ? (
    <div className="m-sheet-full">
      <div className="m-sheet-full__header">
        <span className={`m-todo-row__check${sheetTodo.completed ? " m-todo-row__check--done" : ""}`} />
        <div className="m-sheet-full__title">{sheetTodo.title}</div>
      </div>
      {sheetTodo.description && <div className="m-sheet-full__desc">{sheetTodo.description}</div>}
      <div className="m-sheet-full__fields">
        <FieldPicker<TodoStatus>
          label="Status"
          value={sheetTodo.status}
          options={STATUS_OPTIONS}
          onChange={(v) => { if (v) editTodo(sheetTodo.id, { status: v }); }}
        />
        <FieldPicker<Priority>
          label="Priority"
          value={sheetTodo.priority ?? null}
          options={PRIORITY_OPTIONS}
          onChange={(v) => editTodo(sheetTodo.id, { priority: v })}
          allowClear
        />
        <div className="m-field-picker">
          <div className="m-field-picker__header m-field-picker__header--static">
            <div className="m-sheet-full__field-label">Due Date</div>
            <input
              type="date"
              className="m-field-picker__date"
              value={sheetTodo.dueDate ? sheetTodo.dueDate.slice(0, 10) : ""}
              onChange={(e) => editTodo(sheetTodo.id, { dueDate: e.target.value || null })}
            />
          </div>
        </div>
        <FieldPicker<string>
          label="Project"
          value={sheetTodo.projectId ?? null}
          options={projectOptions}
          onChange={(v) => editTodo(sheetTodo.id, { projectId: v })}
          allowClear
        />
        <FieldPicker<"low" | "medium" | "high">
          label="Energy"
          value={sheetTodo.energy ?? null}
          options={ENERGY_OPTIONS}
          onChange={(v) => editTodo(sheetTodo.id, { energy: v })}
          allowClear
        />
        <div className="m-sheet-full__field">
          <div className="m-sheet-full__field-label">Estimate</div>
          <div className="m-sheet-full__field-value">{sheetTodo.estimateMinutes ? `${sheetTodo.estimateMinutes} min` : "—"}</div>
        </div>
      </div>
      {sheetTodo.tags.length > 0 && (
        <div className="m-sheet-full__tags">
          <div className="m-sheet-full__field-label">Tags</div>
          <div className="m-sheet-full__tag-list">{sheetTodo.tags.map((tag) => <span key={tag} className="m-sheet-full__tag">{tag}</span>)}</div>
        </div>
      )}
      {sheetTodo.subtasks && sheetTodo.subtasks.length > 0 && (
        <div className="m-sheet-full__subtasks">
          <div className="m-sheet-full__field-label">Subtasks · {sheetTodo.subtasks.filter((s) => s.completed).length}/{sheetTodo.subtasks.length}</div>
          {sheetTodo.subtasks.map((s) => (
            <button
              key={s.id}
              className={`m-sheet-full__subtask${s.completed ? " m-sheet-full__subtask--done" : ""}`}
              onClick={() => handleToggleSubtask(sheetTodo.id, s.id, !s.completed)}
            >
              {s.completed ? "☑" : "☐"} {s.title}
            </button>
          ))}
        </div>
      )}
      <div className="m-sheet-full__notes">
        <div className="m-sheet-full__field-label">Notes</div>
        <textarea
          className="m-sheet-full__notes-input"
          value={sheetTodo.notes ?? ""}
          placeholder="Add notes..."
          onChange={(e) => editTodo(sheetTodo.id, { notes: e.target.value })}
          rows={3}
        />
      </div>
      <div className="m-sheet-full__actions">
        <button className="m-sheet-full__action m-sheet-full__action--complete" onClick={() => { toggleTodo(sheetTodo.id, !sheetTodo.completed); bottomSheet.close(); }}>✓ Complete</button>
        <button className="m-sheet-full__action m-sheet-full__action--delete" onClick={() => { removeTodo(sheetTodo.id); bottomSheet.close(); }}>🗑 Delete</button>
      </div>
    </div>
  ) : null;

  const screenProps = { todos, projects, user, onTodoClick: handleTodoClick, onToggleTodo: handleToggleTodo, onAvatarClick: handleAvatarClick, onSnoozeTodo: handleSnoozeTodo };

  return (
    <div className="m-shell" data-density="normal" data-palette={palette}>
      <OfflineBanner />
      <InstallBanner />
      <div className="m-shell__content">
        <PullToRefresh onRefresh={handleRefresh}>
          {activeTab === "focus" && <FocusScreen {...screenProps} />}
          {activeTab === "today" && <TodayScreen {...screenProps} />}
          {activeTab === "projects" && <ProjectsScreen {...screenProps} />}
          {activeTab === "custom" && <CustomScreen view={customView} {...screenProps} />}
        </PullToRefresh>
      </div>
      <PullToSearch todos={todos} projects={projects} onSelectResult={handleTodoClick} />
      <BottomSheet snap={bottomSheet.snap} onClose={bottomSheet.close} onExpandFull={bottomSheet.expandFull} halfContent={halfContent} fullContent={fullContent} />
      <QuickCapture open={captureOpen} projects={projects} onClose={() => setCaptureOpen(false)} onCreateTask={handleCreateTask} onCreateProject={handleCreateProject} />
      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        dark={dark}
        onToggleDark={toggleDarkMode}
        customView={customView}
        onChangeCustomView={setCustomView}
        onLogout={logout}
        onNavigate={(p) => setPage(p as "todos" | "ai" | "review" | "admin")}
        palette={palette}
        onChangePalette={setPalette}
      />
      <SnoozePicker open={!!snoozeTargetId} onClose={handleSnoozeClose} onSnooze={handleSnoozeConfirm} />
      <TabBar activeTab={activeTab} customView={customView} onTabChange={setActiveTab} onFabPress={() => setCaptureOpen(true)} />
      {page !== "todos" && (
        <div className="m-shell__page-overlay">
          <header className="m-header">
            <button className="m-header__back" onClick={() => setPage("todos")}>← Back</button>
            <div className="m-header__text">
              <h1 className="m-header__title">
                {page === "ai" ? "AI Workspace" : page === "review" ? "Weekly Review" : "Admin"}
              </h1>
            </div>
          </header>
          <div className="m-shell__page-content">
            <div className="m-empty">
              <div className="m-empty__icon">🚧</div>
              <div className="m-empty__title">Coming soon on mobile</div>
              <div className="m-empty__hint">Use the desktop app for full access</div>
            </div>
          </div>
        </div>
      )}
      <Onboarding />
    </div>
  );
}
