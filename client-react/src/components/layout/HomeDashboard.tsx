import { useMemo, useState, useEffect, useCallback } from "react";
import type { Todo } from "../../types";
import * as aiApi from "../../api/ai";

interface Props {
  todos: Todo[];
  onTodoClick: (id: string) => void;
  onNavigate: (view: "today" | "upcoming" | "all") => void;
}

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate || todo.completed) return false;
  return new Date(todo.dueDate) < new Date(new Date().toDateString());
}

function isDueSoon(todo: Todo): boolean {
  if (!todo.dueDate || todo.completed) return false;
  const due = new Date(todo.dueDate);
  const now = new Date(new Date().toDateString());
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
}

function isStale(todo: Todo): boolean {
  if (todo.completed) return false;
  const updated = new Date(todo.updatedAt);
  const diff = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
  return diff > 14;
}

export function HomeDashboard({ todos, onTodoClick, onNavigate }: Props) {
  const activeTodos = useMemo(
    () => todos.filter((t) => !t.completed),
    [todos],
  );

  const overdue = useMemo(() => activeTodos.filter(isOverdue), [activeTodos]);
  const dueSoon = useMemo(() => activeTodos.filter(isDueSoon), [activeTodos]);
  const stale = useMemo(() => activeTodos.filter(isStale), [activeTodos]);
  const highPriority = useMemo(
    () =>
      activeTodos.filter(
        (t) => t.priority === "high" || t.priority === "urgent",
      ),
    [activeTodos],
  );

  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return todos.filter(
      (t) =>
        t.completed &&
        t.completedAt &&
        new Date(t.completedAt).toDateString() === today,
    ).length;
  }, [todos]);

  // Top Focus: highest-priority incomplete items
  const topFocus = useMemo(
    () =>
      activeTodos
        .filter((t) => t.priority === "urgent" || t.priority === "high")
        .slice(0, 3),
    [activeTodos],
  );

  return (
    <div data-testid="home-dashboard" className="home-dashboard">
      <h2 className="home-dashboard__greeting">{getGreeting()}</h2>

      <div className="home-dashboard__stats">
        <div className="home-stat">
          <span className="home-stat__number">{activeTodos.length}</span>
          <span className="home-stat__label">Open tasks</span>
        </div>
        <div className="home-stat">
          <span className="home-stat__number">{completedToday}</span>
          <span className="home-stat__label">Done today</span>
        </div>
        <div className="home-stat">
          <span className="home-stat__number">{overdue.length}</span>
          <span className="home-stat__label">Overdue</span>
        </div>
      </div>

      <div className="home-dashboard__tiles">
        {/* Top Focus tile — matches classic data-home-tile="top_focus" */}
        <HomeTile
          data-home-tile="top_focus"
          title="Top Focus"
          color="var(--accent)"
          items={topFocus}
          onItemClick={onTodoClick}
          onViewAll={() => onNavigate("today")}
          emptyText="No high-priority tasks right now."
        />

        {/* Priorities tile — matches classic data-home-tile="priorities" */}
        {overdue.length > 0 && (
          <HomeTile
            data-home-tile="priorities"
            title="Overdue"
            color="var(--danger)"
            items={overdue}
            onItemClick={onTodoClick}
            onViewAll={() => onNavigate("today")}
          />
        )}

        {/* Due Soon tile */}
        {dueSoon.length > 0 && (
          <HomeTile
            data-home-tile="due_soon"
            title="Due Soon"
            color="var(--warning)"
            items={dueSoon}
            onItemClick={onTodoClick}
            onViewAll={() => onNavigate("upcoming")}
          />
        )}

        {/* AI Insights tile — matches classic data-home-tile="insights" */}
        <AiInsightsTile />

        {/* Stale Risks tile — matches classic data-home-tile="stale_risks" */}
        {stale.length > 0 && (
          <HomeTile
            data-home-tile="stale_risks"
            title="Stale Risks"
            color="var(--muted)"
            items={stale}
            onItemClick={onTodoClick}
            onViewAll={() => onNavigate("all")}
          />
        )}
      </div>

      {activeTodos.length === 0 && (
        <div className="home-dashboard__empty">
          <p>All clear. Enjoy your day!</p>
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// --- Individual tiles ---

interface TileProps {
  title: string;
  color: string;
  items: Todo[];
  onItemClick: (id: string) => void;
  onViewAll: () => void;
  emptyText?: string;
  "data-home-tile"?: string;
}

function HomeTile({
  title,
  color,
  items,
  onItemClick,
  onViewAll,
  emptyText,
  ...rest
}: TileProps) {
  return (
    <div className="home-tile" {...rest}>
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <span className="home-tile__dot" style={{ background: color }} />
          <h3 className="home-tile__title">{title}</h3>
        </div>
        {items.length > 0 && (
          <span className="home-tile__count">{items.length}</span>
        )}
      </div>
      <div className="home-tile__body">
        {items.length === 0 && emptyText && (
          <div className="home-tile__empty">{emptyText}</div>
        )}
        {items.slice(0, 5).map((todo) => (
          <div
            key={todo.id}
            className="home-tile__item"
            onClick={() => onItemClick(todo.id)}
          >
            <span className="home-tile__item-title">{todo.title}</span>
            {todo.dueDate && (
              <span className="home-tile__item-date">
                {new Date(todo.dueDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        ))}
        {items.length > 5 && (
          <button className="mini-btn home-tile__see-all" onClick={onViewAll}>
            See all ({items.length})
          </button>
        )}
      </div>
    </div>
  );
}

// --- AI Insights tile (matches classic home-tile--insights) ---

function AiInsightsTile() {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    aiApi
      .getAiUsage()
      .then((usage) => {
        setInsights(
          `${usage.remaining} AI suggestions remaining today (${usage.used}/${usage.limit} used).`,
        );
      })
      .catch(() => {
        setInsights(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-tile home-tile--insights" data-home-tile="insights">
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <span className="home-tile__dot" style={{ background: "var(--accent)" }} />
          <h3 className="home-tile__title">AI Insights</h3>
        </div>
      </div>
      <div className="home-tile__body">
        {loading ? (
          <div className="home-tile__empty">Loading insights…</div>
        ) : insights ? (
          <p className="home-tile__insight-text">{insights}</p>
        ) : (
          <div className="home-tile__empty">AI insights unavailable.</div>
        )}
      </div>
    </div>
  );
}
