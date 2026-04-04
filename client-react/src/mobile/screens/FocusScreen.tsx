import { useMemo, useState, useEffect } from "react";
import type { Todo, Project, User } from "../../types";
import { MobileHeader } from "../MobileHeader";
import { useCountUp } from "../hooks/useCountUp";
import { IllustrationCelebrate } from "../components/Illustrations";

interface Props {
  todos: Todo[];
  projects: Project[];
  user: User | null;
  onTodoClick: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onAvatarClick: () => void;
  onSnoozeTodo: (id: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date(new Date().toDateString());
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function FocusScreen({ todos, projects, user, onTodoClick, onToggleTodo, onAvatarClick }: Props) {
  const openTodos = useMemo(() => todos.filter((t) => !t.completed && !t.archived), [todos]);
  const todayCount = useMemo(
    () => openTodos.filter((t) => t.dueDate && daysUntil(t.dueDate) <= 0).length, [openTodos]);
  const overdueCount = useMemo(
    () => openTodos.filter((t) => t.dueDate && daysUntil(t.dueDate) < 0).length, [openTodos]);
  const completedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return todos.filter((t) => t.completed && t.completedAt && new Date(t.completedAt).getTime() > weekAgo).length;
  }, [todos]);
  const dueSoon = useMemo(
    () => openTodos.filter((t) => t.dueDate && daysUntil(t.dueDate) <= 3)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 5),
    [openTodos]);
  const topTask = useMemo(() => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return [...openTodos].sort((a, b) => {
      const ap = order[a.priority as keyof typeof order] ?? 4;
      const bp = order[b.priority as keyof typeof order] ?? 4;
      return ap - bp;
    })[0] ?? null;
  }, [openTodos]);

  const subtitle = `${todayCount} tasks today${overdueCount ? ` · ${overdueCount} overdue` : ""}`;
  const activeProjects = projects.filter((p) => p.status === "active").length;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const animDone = useCountUp(mounted ? completedThisWeek : 0, 800);
  const animOpen = useCountUp(mounted ? openTodos.length : 0, 800);
  const animProjects = useCountUp(mounted ? activeProjects : 0, 800);

  return (
    <div className="m-screen m-screen--focus">
      <MobileHeader title={getGreeting()} subtitle={subtitle} user={user} onAvatarClick={onAvatarClick} animated={mounted} />
      <div className="m-focus__content">
        {openTodos.length === 0 && (
          <div className="m-empty m-empty--celebrate">
            <div className="m-confetti" aria-hidden="true">
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className="m-confetti__piece" style={{
                  "--x": `${(Math.random() - 0.5) * 200}px`,
                  "--y": `${-Math.random() * 150 - 50}px`,
                  "--r": `${Math.random() * 360}deg`,
                  "--d": `${300 + Math.random() * 500}ms`,
                  background: ["var(--m-amber)", "var(--m-accent)", "var(--m-success)", "var(--m-danger)"][i % 4],
                } as React.CSSProperties} />
              ))}
            </div>
            <IllustrationCelebrate />
            <div className="m-empty__title m-empty__title--bounce">All clear! No tasks right now.</div>
          </div>
        )}
        {topTask && (
          <button className="m-focus__next-card" onClick={() => onTodoClick(topTask.id)}>
            <div className="m-focus__next-blob" aria-hidden="true" />
            <div className="m-focus__next-label">✦ What Next</div>
            <div className="m-focus__next-row">
              <span className={`m-focus__check${topTask.completed ? " m-focus__check--done" : ""}`}
                onClick={(e) => { e.stopPropagation(); onToggleTodo(topTask.id, !topTask.completed); }} />
              <div>
                <div className="m-focus__next-title">{topTask.title}</div>
                <div className="m-focus__next-meta">
                  {topTask.projectId && projects.find((p) => p.id === topTask.projectId)?.name}
                  {topTask.priority && <> · <span className={`m-priority--${topTask.priority}`}>{topTask.priority}</span></>}
                  {topTask.dueDate && <> · due {daysUntil(topTask.dueDate) === 0 ? "today" : daysUntil(topTask.dueDate) < 0 ? "overdue" : `in ${daysUntil(topTask.dueDate)}d`}</>}
                </div>
              </div>
            </div>
          </button>
        )}
        {dueSoon.length > 0 && (
          <section className="m-focus__section">
            <h2 className="m-focus__section-title">Due Soon</h2>
            <div className="m-focus__list">
              {dueSoon.map((t) => (
                <button key={t.id} className="m-focus__list-row" onClick={() => onTodoClick(t.id)}>
                  <span className={`m-focus__check${t.completed ? " m-focus__check--done" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onToggleTodo(t.id, !t.completed); }} />
                  <div className="m-focus__list-text">
                    <div className="m-focus__list-title">{t.title}</div>
                    <div className="m-focus__list-meta">
                      {t.projectId && projects.find((p) => p.id === t.projectId)?.name}
                      {t.dueDate && <> · {daysUntil(t.dueDate) < 0 ? <span className="m-overdue">overdue</span> : `due ${daysUntil(t.dueDate) === 0 ? "today" : new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}</>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="m-focus__stats">
          <div className="m-focus__stat">
            <div className="m-focus__stat-value m-focus__stat-value--success">{animDone}</div>
            <div className="m-focus__stat-label">done this week</div>
          </div>
          <div className="m-focus__stat">
            <div className="m-focus__stat-value m-focus__stat-value--warning">{animOpen}</div>
            <div className="m-focus__stat-label">open tasks</div>
          </div>
          <div className="m-focus__stat">
            <div className="m-focus__stat-value m-focus__stat-value--accent">{animProjects}</div>
            <div className="m-focus__stat-label">projects</div>
          </div>
        </div>
      </div>
    </div>
  );
}
