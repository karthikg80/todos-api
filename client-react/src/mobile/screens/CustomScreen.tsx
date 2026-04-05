import { useMemo } from "react";
import type { Todo, Project, User } from "../../types";
import type { WorkspaceView } from "../../components/projects/Sidebar";
import { MobileHeader } from "../MobileHeader";
import { SwipeRow } from "../components/SwipeRow";
import { CUSTOM_TAB_OPTIONS } from "../hooks/useTabBar";
import { IllustrationWaves } from "../components/Illustrations";

function getEmptyMessage(view: WorkspaceView): string {
  switch (view) {
    case "horizon": return "No upcoming tasks on the horizon";
    case "completed": return "No completed tasks yet";
    case "all": return "No tasks at all";
    default: return "Nothing here. Nice work!";
  }
}

interface Props {
  view: WorkspaceView;
  todos: Todo[];
  projects: Project[];
  user: User | null;
  onTodoClick: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onAvatarClick: () => void;
  onSnoozeTodo: (id: string) => void;
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date(new Date().toDateString());
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function filterForView(todos: Todo[], view: WorkspaceView): Todo[] {
  switch (view) {
    case "horizon": return todos.filter((t) => !t.completed && !t.archived && t.dueDate && daysUntil(t.dueDate) > 0)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    case "all": return todos.filter((t) => !t.archived);
    case "completed": return todos.filter((t) => t.completed && !t.archived)
      .sort((a, b) => new Date(b.completedAt ?? b.updatedAt).getTime() - new Date(a.completedAt ?? a.updatedAt).getTime());
    default: return todos.filter((t) => !t.completed && !t.archived);
  }
}

export function CustomScreen({ view, todos, projects, user, onTodoClick, onToggleTodo, onAvatarClick, onSnoozeTodo }: Props) {
  const label = CUSTOM_TAB_OPTIONS.find((o) => o.key === view)?.label ?? "Tasks";
  const filteredTodos = useMemo(() => filterForView(todos, view), [todos, view]);
  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  return (
    <div className="m-screen m-screen--custom">
      <MobileHeader title={label} user={user} onAvatarClick={onAvatarClick} />
      <div className="m-custom__content">
        <div className="m-today__pull-hint">↓ pull to search</div>
        <div className="m-custom__list">
          {filteredTodos.map((t) => (
            <SwipeRow key={t.id} onSwipeRight={() => onToggleTodo(t.id, !t.completed)} onSwipeLeft={() => onSnoozeTodo(t.id)}>
              <button className="m-todo-row" onClick={() => onTodoClick(t.id)}>
                <span className={`m-todo-row__check${t.completed ? " m-todo-row__check--done" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onToggleTodo(t.id, !t.completed); }} />
                <div className="m-todo-row__text">
                  <div className="m-todo-row__title">{t.title}</div>
                  <div className="m-todo-row__meta">
                    {t.projectId && projectMap.get(t.projectId)?.name}
                    {t.priority && <> · <span className={`m-priority--${t.priority}`}>{t.priority}</span></>}
                  </div>
                </div>
              </button>
            </SwipeRow>
          ))}
          {filteredTodos.length === 0 && (
            <div className="m-empty">
              <IllustrationWaves />
              <div className="m-empty__title">{getEmptyMessage(view)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
