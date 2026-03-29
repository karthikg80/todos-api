import type { Todo } from "../../types";
import type { LoadState } from "../../store/useTodosStore";
import { TodoRow } from "./TodoRow";

interface Props {
  todos: Todo[];
  loadState: LoadState;
  errorMessage: string;
  activeTodoId: string | null;
  onToggle: (id: string, completed: boolean) => void;
  onClick: (id: string) => void;
  onKebab: (id: string) => void;
  onRetry: () => void;
}

export function TodoList({
  todos,
  loadState,
  errorMessage,
  activeTodoId,
  onToggle,
  onClick,
  onKebab,
  onRetry,
}: Props) {
  if (loadState === "loading") {
    return (
      <div className="loading-skeleton loading">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="loading-skeleton__row" />
        ))}
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div id="todosErrorState" className="error-state">
        <p>{errorMessage || "Something went wrong"}</p>
        <button
          id="todosRetryLoadButton"
          className="error-state__btn"
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loadState === "loaded" && todos.length === 0) {
    return (
      <div id="todosEmptyState" className="empty-state">
        <div className="empty-state__icon">✓</div>
        <p>No tasks yet. Add one above!</p>
      </div>
    );
  }

  return (
    <div id="todosList">
      {todos.map((todo) => (
        <TodoRow
          key={todo.id}
          todo={todo}
          isActive={todo.id === activeTodoId}
          onToggle={onToggle}
          onClick={onClick}
          onKebab={onKebab}
        />
      ))}
    </div>
  );
}
