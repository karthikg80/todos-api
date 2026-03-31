import { useState, useRef, useEffect } from "react";
import type { Todo } from "../../types";
import { IconKebab } from "../shared/Icons";
import { relativeTime } from "../../utils/relativeTime";

interface Props {
  todo: Todo;
  isActive: boolean;
  isBulkMode: boolean;
  isSelected: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onClick: (id: string) => void;
  onKebab: (id: string) => void;
  onSelect: (id: string) => void;
  onInlineEdit: (id: string, title: string) => void;
  onTagClick?: (tag: string) => void;
  onLifecycleAction?: (id: string, action: string, payload?: string) => void;
}

function formatDueDate(due: string): { label: string; overdue: boolean } {
  const d = new Date(due);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0) return { label: `${-diff}d overdue`, overdue: true };
  if (diff === 0) return { label: "Today", overdue: false };
  if (diff === 1) return { label: "Tomorrow", overdue: false };
  return {
    label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    overdue: false,
  };
}

export function TodoRow({
  todo,
  isActive,
  isBulkMode,
  isSelected,
  onToggle,
  onClick,
  onKebab,
  onSelect,
  onInlineEdit,
  onTagClick,
  onLifecycleAction,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== todo.title) {
      onInlineEdit(todo.id, trimmed);
    }
    setEditing(false);
  };

  const titleClass = `todo-title${todo.completed ? " todo-title--completed" : ""}`;
  const rowClass = `todo-item${isActive ? " todo-item--active" : ""}${todo.completed ? " completed" : ""}${isSelected ? " todo-item--selected" : ""}`;

  return (
    <div
      className={rowClass}
      data-todo-id={todo.id}
      onClick={() => (isBulkMode ? onSelect(todo.id) : onClick(todo.id))}
    >
      {isBulkMode ? (
        <input
          type="checkbox"
          className="todo-checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(todo.id);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select "${todo.title}"`}
        />
      ) : (
        <input
          type="checkbox"
          className="todo-checkbox"
          checked={todo.completed}
          onChange={(e) => {
            e.stopPropagation();
            onToggle(todo.id, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Mark "${todo.title}" as ${todo.completed ? "incomplete" : "complete"}`}
        />
      )}

      {editing ? (
        <input
          ref={editRef}
          className="todo-title-edit"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") {
              setEditValue(todo.title);
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={titleClass}
          onDoubleClick={(e) => {
            if (isBulkMode) return;
            e.stopPropagation();
            setEditValue(todo.title);
            setEditing(true);
          }}
        >
          {todo.title}
        </span>
      )}

      <div className="todo-chips">
        {todo.dueDate && (
          <span
            className={`todo-chip todo-chip--due${formatDueDate(todo.dueDate).overdue ? " todo-chip--due-overdue" : ""}`}
          >
            {formatDueDate(todo.dueDate).label}
          </span>
        )}
        {todo.priority && todo.priority !== "low" && (
          <span className={`todo-chip todo-chip--priority ${todo.priority}`}>
            {todo.priority}
          </span>
        )}
        {todo.category && (
          <span className="todo-chip todo-chip--project">{todo.category}</span>
        )}
        {todo.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="todo-chip todo-chip--tag"
            onClick={(e) => {
              e.stopPropagation();
              onTagClick?.(tag);
            }}
          >
            #{tag}
          </span>
        ))}
        {todo.tags.length > 3 && (
          <span className="todo-chip todo-chip--tag">
            +{todo.tags.length - 3}
          </span>
        )}
      </div>

      <div className="todo-kebab-wrapper">
        <button
          className="todo-kebab"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label="More actions"
        >
          <IconKebab />
        </button>
        {menuOpen && onLifecycleAction && (
          <>
            <div
              className="context-backdrop"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
            />
            <div className="todo-kebab-menu" onClick={(e) => e.stopPropagation()}>
              <button
                className="todo-kebab-item"
                onClick={() => { setMenuOpen(false); onKebab(todo.id); }}
              >
                Open details
              </button>
              {todo.status === "cancelled" ? (
                <button
                  className="todo-kebab-item"
                  onClick={() => { setMenuOpen(false); onLifecycleAction(todo.id, "reopen"); }}
                >
                  Reopen
                </button>
              ) : (
                <button
                  className="todo-kebab-item todo-kebab-item--danger"
                  onClick={() => { setMenuOpen(false); onLifecycleAction(todo.id, "cancel"); }}
                >
                  Cancel task
                </button>
              )}
              {todo.completed && !todo.archived && (
                <button
                  className="todo-kebab-item"
                  onClick={() => { setMenuOpen(false); onLifecycleAction(todo.id, "archive"); }}
                >
                  Archive
                </button>
              )}
              {!todo.completed && todo.status !== "cancelled" && (
                <>
                  <div className="todo-kebab-divider" />
                  <button
                    className="todo-kebab-item"
                    onClick={() => { setMenuOpen(false); onLifecycleAction(todo.id, "snooze-tomorrow"); }}
                  >
                    Snooze → Tomorrow
                  </button>
                  <button
                    className="todo-kebab-item"
                    onClick={() => { setMenuOpen(false); onLifecycleAction(todo.id, "snooze-next-week"); }}
                  >
                    Snooze → Next week
                  </button>
                  <button
                    className="todo-kebab-item"
                    onClick={() => { setMenuOpen(false); onLifecycleAction(todo.id, "snooze-next-month"); }}
                  >
                    Snooze → Next month
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
