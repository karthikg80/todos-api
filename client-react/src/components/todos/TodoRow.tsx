import { useState, useRef, useEffect } from "react";
import type { Todo, Project, Heading, UpdateTodoDto } from "../../types";
import type { Density } from "../../hooks/useDensity";
import { IconKebab, IconClock, IconArchive, IconXCircle, IconRefresh } from "../shared/Icons";
import { relativeTime } from "../../utils/relativeTime";
import { QuickEditPanel } from "./QuickEditPanel";
import { buildChips } from "../../utils/buildChips";

interface Props {
  todo: Todo;
  isActive: boolean;
  isExpanded: boolean;
  isBulkMode: boolean;
  isSelected: boolean;
  isEntering?: boolean;
  isExiting?: boolean;
  density: Density;
  projects: Project[];
  headings: Heading[];
  onToggle: (id: string, completed: boolean) => void;
  onClick: (id: string) => void;
  onKebab: (id: string) => void;
  onSelect: (id: string) => void;
  onInlineEdit: (id: string, title: string) => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
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
  isExpanded,
  isBulkMode,
  isSelected,
  isEntering,
  isExiting,
  density,
  projects,
  headings,
  onToggle,
  onClick,
  onKebab,
  onSelect,
  onInlineEdit,
  onSave,
  onTagClick,
  onLifecycleAction,
}: Props) {
  const chips = buildChips(todo, density);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const prevCompleted = useRef(todo.completed);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (todo.completed && !prevCompleted.current) {
      setJustCompleted(true);
      const timer = setTimeout(() => setJustCompleted(false), 400);
      prevCompleted.current = todo.completed;
      return () => clearTimeout(timer);
    }
    prevCompleted.current = todo.completed;
  }, [todo.completed]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== todo.title) {
      onInlineEdit(todo.id, trimmed);
    }
    setEditing(false);
  };

  const titleClass = `todo-title${todo.completed ? " todo-title--completed" : ""}`;
  const isOverdue = !todo.completed && !!todo.dueDate && new Date(todo.dueDate) < new Date(new Date().toDateString());
  const priorityBorder = (todo.priority === "urgent" || todo.priority === "high")
    ? " todo-item--border-high"
    : todo.priority === "medium"
      ? " todo-item--border-med"
      : "";
  const rowClass = `todo-item${isActive ? " todo-item--active" : ""}${isExpanded ? " todo-item--expanded" : ""}${todo.completed ? " completed" : ""}${isSelected ? " todo-item--selected" : ""}${priorityBorder}${isOverdue ? " todo-item--overdue" : ""}${isEntering ? " todo-item--entering" : ""}${isExiting ? " todo-item--exiting" : ""}${justCompleted ? " todo-item--just-completed" : ""}`;

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

      {chips.length > 0 && (
        <div className="todo-chips">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className={`todo-chip todo-chip--${chip.variant}`}
              onClick={chip.variant === "tag" ? (e) => { e.stopPropagation(); onTagClick?.(chip.label.slice(1)); } : undefined}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}

      {density === "spacious" && (
        <>
          {todo.description && (
            <div className="todo-description-preview">
              {todo.description.length > 120
                ? todo.description.slice(0, 120) + "..."
                : todo.description}
            </div>
          )}
          {todo.subtasks && todo.subtasks.length > 0 && (() => {
            const done = todo.subtasks.filter((s) => s.completed).length;
            const total = todo.subtasks.length;
            return (
              <div className="todo-subtask-bar">
                <div
                  className="todo-subtask-bar__track"
                  role="progressbar"
                  aria-valuenow={done}
                  aria-valuemax={total}
                  aria-label={`${done} of ${total} subtasks complete`}
                >
                  <div
                    className="todo-subtask-bar__fill"
                    style={{ width: `${(done / total) * 100}%` }}
                  />
                </div>
                <span className="todo-subtask-bar__label">{done} of {total}</span>
              </div>
            );
          })()}
          {todo.notes && (
            <div className="todo-notes-indicator">Has notes</div>
          )}
        </>
      )}

      {/* Inline hover actions (visible on row hover) */}
      {onLifecycleAction && !isBulkMode && (
        <div className="todo-inline-actions">
          {!todo.completed && todo.status !== "cancelled" && (
            <button
              className="todo-inline-action"
              title="Snooze → Tomorrow"
              onClick={(e) => { e.stopPropagation(); onLifecycleAction(todo.id, "snooze-tomorrow"); }}
            >
              <IconClock size={13} />
            </button>
          )}
          {todo.status === "cancelled" ? (
            <button
              className="todo-inline-action"
              title="Reopen task"
              onClick={(e) => { e.stopPropagation(); onLifecycleAction(todo.id, "reopen"); }}
            >
              <IconRefresh size={13} />
            </button>
          ) : (
            <button
              className="todo-inline-action todo-inline-action--danger"
              title="Cancel task"
              onClick={(e) => { e.stopPropagation(); onLifecycleAction(todo.id, "cancel"); }}
            >
              <IconXCircle size={13} />
            </button>
          )}
          {todo.completed && !todo.archived && (
            <button
              className="todo-inline-action"
              title="Archive"
              onClick={(e) => { e.stopPropagation(); onLifecycleAction(todo.id, "archive"); }}
            >
              <IconArchive size={13} />
            </button>
          )}
        </div>
      )}

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

      {isExpanded && (
        <QuickEditPanel
          todo={todo}
          projects={projects}
          headings={headings}
          onSave={onSave}
          onOpenDrawer={() => onKebab(todo.id)}
        />
      )}
    </div>
  );
}
