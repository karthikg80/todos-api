import type { Todo } from "../../types";
import { formatDueFriendly } from "./projectEditorModels";
import { SortableRow, RowMenu } from "./projectEditorRows";

interface ProjectTaskRowProps {
  todo: Todo;
  menuId: string;
  bulkMode: boolean;
  selectedIds: Set<string>;
  openMenuId: string | null;
  isDropTarget: boolean;
  nested?: boolean;
  onToggle: (id: string, completed: boolean) => void;
  onSelect: (id: string) => void;
  onTaskOpen: (id: string) => void;
  onRequestDeleteTodo: (id: string) => void;
  onSetOpenMenuId: (id: string | null) => void;
  onMoveToBacklog?: () => void;
}

export function ProjectTaskRow({
  todo,
  menuId,
  bulkMode,
  selectedIds,
  openMenuId,
  isDropTarget,
  nested = false,
  onToggle,
  onSelect,
  onTaskOpen,
  onRequestDeleteTodo,
  onSetOpenMenuId,
  onMoveToBacklog,
}: ProjectTaskRowProps) {
  const dueLabel = formatDueFriendly(todo.dueDate);
  const rowClass = nested
    ? "project-page__task-row project-page__task-row--nested"
    : "project-page__task-row";

  return (
    <SortableRow id={menuId} className={rowClass} isDropTarget={isDropTarget}>
      <label className="project-page__task-check">
        <input
          type="checkbox"
          checked={bulkMode ? selectedIds.has(todo.id) : todo.completed}
          onChange={() =>
            bulkMode ? onSelect(todo.id) : onToggle(todo.id, !todo.completed)
          }
          aria-label={
            bulkMode ? `Select ${todo.title}` : `Complete ${todo.title}`
          }
        />
      </label>
      <button
        type="button"
        className={`project-page__task-title${
          todo.completed ? " project-page__task-title--done" : ""
        }`}
        onClick={() => onTaskOpen(todo.id)}
      >
        {todo.title}
      </button>
      {todo.dueDate ? (
        <span className="project-page__task-meta">{dueLabel}</span>
      ) : null}
      <RowMenu
        label="Task actions"
        open={openMenuId === menuId}
        onClose={() => onSetOpenMenuId(null)}
        onToggle={() => onSetOpenMenuId(openMenuId === menuId ? null : menuId)}
      >
        <button
          type="button"
          onClick={() => {
            onSetOpenMenuId(null);
            onTaskOpen(todo.id);
          }}
        >
          Open
        </button>
        {onMoveToBacklog && (
          <button
            type="button"
            onClick={() => {
              onSetOpenMenuId(null);
              onMoveToBacklog();
            }}
          >
            Move to backlog
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onSetOpenMenuId(null);
            onRequestDeleteTodo(todo.id);
          }}
        >
          Delete
        </button>
      </RowMenu>
    </SortableRow>
  );
}
