import { useState, useEffect, useCallback, useMemo } from "react";
import type { Todo } from "../../types";
import { relativeTime } from "../../utils/relativeTime";
import { IllustrationDeskClear, IllustrationSorted } from "../shared/Illustrations";
import {
  fetchInboxItems,
  promoteCapture,
  discardCapture,
  type CaptureItem,
} from "../../api/inbox";

interface Props {
  todos: Todo[];
  onTodoClick: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onRefreshTodos: () => void;
  onOpenComposer: () => void;
}

// Use shared utility
const timeAgo = relativeTime;

export function DeskView({
  todos,
  onTodoClick,
  onToggleTodo,
  onRefreshTodos,
  onOpenComposer,
}: Props) {
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(true);
  const [triagingIds, setTriagingIds] = useState<Set<string>>(new Set());

  // Load inbox captures
  useEffect(() => {
    setCapturesLoading(true);
    fetchInboxItems()
      .then(setCaptures)
      .catch(() => {})
      .finally(() => setCapturesLoading(false));
  }, []);

  // Ready to organize: inbox status OR unsorted (no project/category)
  const readyToOrganize = useMemo(
    () =>
      todos.filter(
        (t) =>
          !t.completed &&
          (t.status === "inbox" || (!t.projectId && !t.category)),
      ),
    [todos],
  );

  const handlePromote = useCallback(
    async (id: string) => {
      setTriagingIds((prev) => new Set(prev).add(id));
      const ok = await promoteCapture(id);
      if (ok) {
        setCaptures((prev) => prev.filter((c) => c.id !== id));
        onRefreshTodos();
      }
      setTriagingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [onRefreshTodos],
  );

  const handleDiscard = useCallback(async (id: string) => {
    setTriagingIds((prev) => new Set(prev).add(id));
    const ok = await discardCapture(id);
    if (ok) {
      setCaptures((prev) => prev.filter((c) => c.id !== id));
    }
    setTriagingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setCapturesLoading(true);
    fetchInboxItems()
      .then(setCaptures)
      .catch(() => {})
      .finally(() => setCapturesLoading(false));
  }, []);

  return (
    <div className="triage-view">
      {/* Toolbar */}
      <div className="triage-view__toolbar">
        <div className="triage-view__summary">
          <p className="triage-view__eyebrow">Desk</p>
          <h2 className="triage-view__title">
            A calm place for new items before they're organized
          </h2>
          <p className="triage-view__copy">
            Capture first, organize when you're ready.
          </p>
        </div>
        <div className="triage-view__actions">
          <button className="btn" onClick={onOpenComposer}>
            + New task
          </button>
          <button className="btn" onClick={handleRefresh}>
            Refresh
          </button>
        </div>
      </div>

      <div className="triage-view__sections">
        {/* Section 1: On your desk (captures) */}
        <section className="triage-section" aria-labelledby="desk-captures-header">
          <div className="todo-group-header triage-section__header" id="desk-captures-header">
            On your desk
            <span className="triage-section__count">
              {capturesLoading ? "…" : `${captures.length} item${captures.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="triage-section__list">
            {capturesLoading && (
              <div className="triage-empty-state">Loading your desk…</div>
            )}
            {!capturesLoading && captures.length === 0 && (
              <div className="triage-empty-state">
                <IllustrationDeskClear />
                <p>
                  Your desk is clear. New items will appear here until you're
                  ready to organize them.
                </p>
              </div>
            )}
            {captures.map((item) => (
              <div
                key={item.id}
                className={`todo-item triage-capture-item${triagingIds.has(item.id) ? " triage-capture-item--processing" : ""}`}
                data-capture-id={item.id}
              >
                <div className="triage-capture-item__content">
                  <span className="todo-title">{item.title}</span>
                  <span className="triage-capture-item__status">New item</span>
                  <span className="triage-capture-item__age">
                    {timeAgo(item.createdAt)}
                  </span>
                </div>
                <div className="triage-capture-item__actions">
                  {triagingIds.has(item.id) ? (
                    <span className="triage-capture-item__spinner">
                      Processing…
                    </span>
                  ) : (
                    <>
                      <button
                        className="btn triage-capture-item__btn"
                        data-triage-action="promote"
                        onClick={() => handlePromote(item.id)}
                      >
                        Create task
                      </button>
                      <button
                        className="btn triage-capture-item__btn triage-capture-item__btn--discard"
                        data-triage-action="discard"
                        onClick={() => handleDiscard(item.id)}
                      >
                        Discard
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Ready to organize */}
        <section className="triage-section" aria-labelledby="desk-organize-header">
          <div
            className="todo-group-header triage-section__header"
            id="desk-organize-header"
          >
            Ready to organize
            <span className="triage-section__count">
              {readyToOrganize.length} task{readyToOrganize.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="triage-section__list">
            {readyToOrganize.length === 0 ? (
              <div className="triage-empty-state">
                <IllustrationSorted />
                <p>Nothing is waiting to be sorted.</p>
              </div>
            ) : (
              readyToOrganize.map((todo) => (
                <div
                  key={todo.id}
                  className="todo-item"
                  data-todo-id={todo.id}
                  onClick={() => onTodoClick(todo.id)}
                >
                  <input
                    type="checkbox"
                    className="todo-checkbox"
                    checked={todo.completed}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleTodo(todo.id, e.target.checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="todo-title">{todo.title}</span>
                  {todo.dueDate && (
                    <span className="todo-chip todo-chip--due">
                      {new Date(todo.dueDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  {todo.priority &&
                    todo.priority !== "low" &&
                    todo.priority !== "medium" && (
                      <span
                        className={`todo-chip todo-chip--priority ${todo.priority}`}
                      >
                        {todo.priority}
                      </span>
                    )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// Empty illustration: simple inbox tray
function DeskEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="empty-state-illustration empty-state-illustration--tile"
      aria-hidden="true"
    >
      <rect
        x="25"
        y="20"
        width="70"
        height="45"
        rx="6"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      <path
        d="M25 40h25l5 8h10l5-8h25"
        stroke="var(--border)"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="60" cy="32" r="2" fill="var(--accent)" opacity="0.4" />
      <path
        d="M55 32h-8"
        stroke="var(--border)"
        strokeWidth="1"
        opacity="0.3"
      />
      <path
        d="M73 32h-8"
        stroke="var(--border)"
        strokeWidth="1"
        opacity="0.3"
      />
    </svg>
  );
}
