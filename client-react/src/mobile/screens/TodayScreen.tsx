import { useMemo } from "react";
import type { Todo, Project, User } from "../../types";
import { MobileHeader } from "../MobileHeader";
import { SwipeRow } from "../components/SwipeRow";

interface Props {
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

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function TodoRowInner({ todo, project, onClick, onToggle }: {
  todo: Todo; project?: Project; onClick: () => void; onToggle: () => void;
}) {
  return (
    <button className="m-todo-row" onClick={onClick}>
      <span className={`m-todo-row__check${todo.completed ? " m-todo-row__check--done" : ""}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }} />
      <div className="m-todo-row__text">
        <div className="m-todo-row__title">{todo.title}</div>
        <div className="m-todo-row__meta">
          {project?.name}
          {todo.priority && <> · <span className={`m-priority--${todo.priority}`}>{todo.priority}</span></>}
        </div>
      </div>
    </button>
  );
}

export function TodayScreen({ todos, projects, user, onTodoClick, onToggleTodo, onAvatarClick, onSnoozeTodo }: Props) {
  const openTodos = useMemo(() => todos.filter((t) => !t.completed && !t.archived), [todos]);
  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const groups = useMemo(() => {
    const overdue: Todo[] = [];
    const dueToday: Todo[] = [];
    const scheduled: Todo[] = [];
    for (const t of openTodos) {
      if (t.dueDate) {
        const days = daysUntil(t.dueDate);
        if (days < 0) overdue.push(t);
        else if (days === 0) dueToday.push(t);
        else scheduled.push(t);
      } else if (t.status === "next" || t.status === "in_progress") {
        dueToday.push(t);
      }
    }
    return { overdue, dueToday, scheduled };
  }, [openTodos]);

  const renderGroup = (label: string, items: Todo[], className?: string) => {
    if (items.length === 0) return null;
    return (
      <section className="m-today__group">
        <h2 className={`m-today__group-title${className ? ` ${className}` : ""}`}>{label}</h2>
        <div className="m-today__group-list">
          {items.map((t) => (
            <SwipeRow key={t.id} onSwipeRight={() => onToggleTodo(t.id, true)} onSwipeLeft={() => onSnoozeTodo(t.id)}>
              <TodoRowInner todo={t} project={t.projectId ? projectMap.get(t.projectId) : undefined}
                onClick={() => onTodoClick(t.id)} onToggle={() => onToggleTodo(t.id, !t.completed)} />
            </SwipeRow>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="m-screen m-screen--today">
      <MobileHeader title="Today" subtitle={formatDate()} user={user} onAvatarClick={onAvatarClick} />
      <div className="m-today__content">
        <div className="m-today__pull-hint">↓ pull to search</div>
        {renderGroup("Overdue", groups.overdue, "m-today__group-title--overdue")}
        {renderGroup("Due Today", groups.dueToday)}
        {renderGroup("Scheduled", groups.scheduled)}
        {openTodos.length === 0 && (
          <div className="m-today__empty"><p>Nothing due today. Enjoy your day!</p></div>
        )}
      </div>
    </div>
  );
}
