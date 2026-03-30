import { useMemo, useCallback } from "react";
import type { Todo, TodoStatus, UpdateTodoDto } from "../../types";
import type { LoadState } from "../../store/useTodosStore";

interface Props {
  todos: Todo[];
  loadState: LoadState;
  onToggle: (id: string, completed: boolean) => void;
  onClick: (id: string) => void;
  onStatusChange: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
}

const BOARD_COLUMNS: { status: TodoStatus; label: string; color: string }[] = [
  { status: "inbox", label: "Inbox", color: "var(--muted)" },
  { status: "next", label: "Next", color: "var(--accent)" },
  { status: "in_progress", label: "In Progress", color: "var(--warning)" },
  { status: "waiting", label: "Waiting", color: "var(--muted)" },
  { status: "done", label: "Done", color: "var(--success)" },
];

export function BoardView({
  todos,
  loadState,
  onToggle,
  onClick,
  onStatusChange,
}: Props) {
  const columns = useMemo(() => {
    const map = new Map<TodoStatus, Todo[]>();
    for (const col of BOARD_COLUMNS) {
      map.set(col.status, []);
    }
    for (const todo of todos) {
      const list = map.get(todo.status);
      if (list) list.push(todo);
      else {
        // Statuses not in BOARD_COLUMNS go to inbox
        map.get("inbox")?.push(todo);
      }
    }
    return map;
  }, [todos]);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStatus: TodoStatus) => {
      e.preventDefault();
      const todoId = e.dataTransfer.getData("text/plain");
      if (todoId) {
        onStatusChange(todoId, { status: targetStatus });
      }
    },
    [onStatusChange],
  );

  if (loadState === "loading") {
    return (
      <div className="board loading">
        {BOARD_COLUMNS.map((col) => (
          <div key={col.status} className="board__column">
            <div className="board__column-header">{col.label}</div>
            <div className="loading-skeleton__row" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="board">
      {BOARD_COLUMNS.map((col) => {
        const items = columns.get(col.status) || [];
        return (
          <div
            key={col.status}
            className="board__column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            <div className="board__column-header">
              <span
                className="board__column-dot"
                style={{ background: col.color }}
              />
              {col.label}
              <span className="board__column-count">{items.length}</span>
            </div>
            <div className="board__column-body">
              {items.map((todo) => (
                <div
                  key={todo.id}
                  className={`board__card${todo.completed ? " board__card--done" : ""}`}
                  data-todo-id={todo.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", todo.id)
                  }
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
                  />
                  <div className="board__card-content">
                    <span className="board__card-title">{todo.title}</span>
                    {todo.dueDate && (
                      <span className="board__card-meta">
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
                </div>
              ))}
              {items.length === 0 && (
                <div className="board__empty">No tasks</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
