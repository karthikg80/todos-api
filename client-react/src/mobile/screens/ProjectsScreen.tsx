import { useState, useMemo } from "react";
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

function groupProjectsByArea(projects: Project[]): { area: string; projects: Project[] }[] {
  const map = new Map<string, Project[]>();
  for (const p of projects) {
    if (p.status !== "active") continue;
    const area = p.area ?? "Uncategorized";
    const list = map.get(area) ?? [];
    list.push(p);
    map.set(area, list);
  }
  return Array.from(map.entries()).map(([area, projects]) => ({ area, projects }));
}

export function ProjectsScreen({ todos, projects, user, onTodoClick, onToggleTodo, onAvatarClick, onSnoozeTodo }: Props) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const groups = useMemo(() => groupProjectsByArea(projects), [projects]);
  const projectTodos = useMemo(() => {
    if (!selectedProject) return [];
    return todos.filter((t) => t.projectId === selectedProject.id && !t.completed && !t.archived);
  }, [selectedProject, todos]);

  if (selectedProject) {
    return (
      <div className="m-screen m-screen--projects">
        <header className="m-header">
          <button className="m-header__back" onClick={() => setSelectedProject(null)}>← Back</button>
          <div className="m-header__text">
            <h1 className="m-header__title">{selectedProject.name}</h1>
            <p className="m-header__subtitle">{projectTodos.length} open tasks</p>
          </div>
        </header>
        <div className="m-projects__task-list">
          {projectTodos.map((t) => (
            <SwipeRow key={t.id} onSwipeRight={() => onToggleTodo(t.id, true)} onSwipeLeft={() => onSnoozeTodo(t.id)}>
              <button className="m-todo-row" onClick={() => onTodoClick(t.id)}>
                <span className={`m-todo-row__check${t.completed ? " m-todo-row__check--done" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onToggleTodo(t.id, !t.completed); }} />
                <div className="m-todo-row__text">
                  <div className="m-todo-row__title">{t.title}</div>
                  <div className="m-todo-row__meta">
                    {t.priority && <span className={`m-priority--${t.priority}`}>{t.priority}</span>}
                  </div>
                </div>
              </button>
            </SwipeRow>
          ))}
          {projectTodos.length === 0 && <div className="m-projects__empty">All tasks complete!</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="m-screen m-screen--projects">
      <MobileHeader title="Projects" user={user} onAvatarClick={onAvatarClick} />
      <div className="m-projects__content">
        <div className="m-today__pull-hint">↓ pull to search</div>
        {groups.length === 0 && (
          <div className="m-empty">
            <div className="m-empty__title">No active projects yet</div>
            <div className="m-empty__hint">Tap + to create one</div>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.area} className="m-projects__area">
            <h2 className="m-projects__area-title">{g.area}</h2>
            <div className="m-projects__area-list">
              {g.projects.map((p) => {
                const open = p.openTodoCount ?? 0;
                const total = p.todoCount ?? 0;
                const done = total > 0 ? ((total - open) / total) * 100 : 0;
                return (
                  <button key={p.id} className="m-projects__row" onClick={() => setSelectedProject(p)}>
                    <div className="m-projects__row-text">
                      <div className="m-projects__row-name">{p.name}</div>
                      <div className="m-projects__row-counts">{open} open · {total - open} done</div>
                    </div>
                    <div className="m-projects__row-progress">
                      <div className="m-projects__progress-bar">
                        <div className="m-projects__progress-fill" style={{ width: `${done}%` }} />
                      </div>
                      <span className="m-projects__row-chevron">›</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
