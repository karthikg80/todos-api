import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useTodosStore } from "../store/useTodosStore";
import { useProjectsStore } from "../store/useProjectsStore";
import { useDarkMode } from "../hooks/useDarkMode";
import { useTabBar } from "./hooks/useTabBar";
import { useBottomSheet } from "./hooks/useBottomSheet";
import { TabBar } from "./components/TabBar";
import { BottomSheet } from "./components/BottomSheet";
import { QuickCapture } from "./components/QuickCapture";
import { ProfileSheet } from "./components/ProfileSheet";
import { FieldPicker } from "./components/FieldPicker";
import { PullToSearch } from "./components/PullToSearch";
import type { TodoStatus, Priority } from "../types";
import { FocusScreen } from "./screens/FocusScreen";
import { TodayScreen } from "./screens/TodayScreen";
import { ProjectsScreen } from "./screens/ProjectsScreen";
import { CustomScreen } from "./screens/CustomScreen";
import { apiCall } from "../api/client";
import "./mobile.css";

export function MobileShell() {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleDarkMode } = useDarkMode();
  const { todos, loadTodos, addTodo, toggleTodo, editTodo, removeTodo } = useTodosStore();
  const { projects, loadProjects } = useProjectsStore();
  const { activeTab, setActiveTab, customView, setCustomView } = useTabBar();
  const bottomSheet = useBottomSheet();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => { loadTodos({}); loadProjects(); }, [loadTodos, loadProjects]);

  const handleTodoClick = useCallback((id: string) => bottomSheet.openHalf(id), [bottomSheet]);
  const handleToggleTodo = useCallback((id: string, completed: boolean) => toggleTodo(id, completed), [toggleTodo]);
  const handleCreateTask = useCallback(async (dto: Parameters<typeof addTodo>[0]) => { await addTodo(dto); }, [addTodo]);
  const handleCreateProject = useCallback(async (name: string) => {
    await apiCall("/projects", { method: "POST", body: JSON.stringify({ name }) });
    await loadProjects();
  }, [loadProjects]);
  const handleAvatarClick = useCallback(() => { setProfileOpen(true); }, []);

  const sheetTodo = useMemo(
    () => (bottomSheet.taskId ? todos.find((t) => t.id === bottomSheet.taskId) ?? null : null),
    [bottomSheet.taskId, todos]);
  const sheetProject = useMemo(
    () => (sheetTodo?.projectId ? projects.find((p) => p.id === sheetTodo.projectId) ?? null : null),
    [sheetTodo, projects]);

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
            <div key={s.id} className={`m-sheet-half__subtask${s.completed ? " m-sheet-half__subtask--done" : ""}`}>{s.completed ? "☑" : "☐"} {s.title}</div>
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
        <div className="m-sheet-full__field"><div className="m-sheet-full__field-label">Status</div><div className="m-sheet-full__field-value">{sheetTodo.status}</div></div>
        <div className="m-sheet-full__field"><div className="m-sheet-full__field-label">Priority</div><div className={`m-sheet-full__field-value${sheetTodo.priority ? ` m-priority--${sheetTodo.priority}` : ""}`}>{sheetTodo.priority ?? "—"}</div></div>
        <div className="m-sheet-full__field"><div className="m-sheet-full__field-label">Due Date</div><div className="m-sheet-full__field-value">{sheetTodo.dueDate ? new Date(sheetTodo.dueDate).toLocaleDateString() : "—"}</div></div>
        <div className="m-sheet-full__field"><div className="m-sheet-full__field-label">Project</div><div className="m-sheet-full__field-value">{sheetProject?.name ?? "—"}</div></div>
        <div className="m-sheet-full__field"><div className="m-sheet-full__field-label">Energy</div><div className="m-sheet-full__field-value">{sheetTodo.energy ?? "—"}</div></div>
        <div className="m-sheet-full__field"><div className="m-sheet-full__field-label">Estimate</div><div className="m-sheet-full__field-value">{sheetTodo.estimateMinutes ? `${sheetTodo.estimateMinutes} min` : "—"}</div></div>
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
            <div key={s.id} className={`m-sheet-full__subtask${s.completed ? " m-sheet-full__subtask--done" : ""}`}>{s.completed ? "☑" : "☐"} {s.title}</div>
          ))}
        </div>
      )}
      {sheetTodo.notes && (
        <div className="m-sheet-full__notes">
          <div className="m-sheet-full__field-label">Notes</div>
          <div className="m-sheet-full__notes-text">{sheetTodo.notes}</div>
        </div>
      )}
      <div className="m-sheet-full__actions">
        <button className="m-sheet-full__action m-sheet-full__action--complete" onClick={() => { toggleTodo(sheetTodo.id, !sheetTodo.completed); bottomSheet.close(); }}>✓ Complete</button>
        <button className="m-sheet-full__action m-sheet-full__action--delete" onClick={() => { removeTodo(sheetTodo.id); bottomSheet.close(); }}>🗑 Delete</button>
      </div>
    </div>
  ) : null;

  const screenProps = { todos, projects, user, onTodoClick: handleTodoClick, onToggleTodo: handleToggleTodo, onAvatarClick: handleAvatarClick };

  return (
    <div className="m-shell" data-density="normal">
      <div className="m-shell__content">
        {activeTab === "focus" && <FocusScreen {...screenProps} />}
        {activeTab === "today" && <TodayScreen {...screenProps} />}
        {activeTab === "projects" && <ProjectsScreen {...screenProps} />}
        {activeTab === "custom" && <CustomScreen view={customView} {...screenProps} />}
      </div>
      <PullToSearch todos={todos} onSelectResult={handleTodoClick} />
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
      />
      <TabBar activeTab={activeTab} customView={customView} onTabChange={setActiveTab} onFabPress={() => setCaptureOpen(true)} />
    </div>
  );
}
