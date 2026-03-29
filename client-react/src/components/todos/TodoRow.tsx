import type { Todo } from "../../types";

interface Props {
  todo: Todo;
  isActive: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onClick: (id: string) => void;
  onKebab: (id: string) => void;
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

export function TodoRow({ todo, isActive, onToggle, onClick, onKebab }: Props) {
  const titleClass = `todo-title${todo.completed ? " todo-title--completed" : ""}`;
  const rowClass = `todo-item${isActive ? " todo-item--active" : ""}${todo.completed ? " completed" : ""}`;

  return (
    <div
      className={rowClass}
      data-todo-id={todo.id}
      onClick={() => onClick(todo.id)}
    >
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
      <span className={titleClass}>{todo.title}</span>
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
      <button
        className="todo-kebab"
        onClick={(e) => {
          e.stopPropagation();
          onKebab(todo.id);
        }}
        aria-label="More actions"
      >
        ⋮
      </button>
    </div>
  );
}
