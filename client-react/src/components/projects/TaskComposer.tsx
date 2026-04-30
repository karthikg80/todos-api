interface TaskComposerProps {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onOpen: () => void;
  onCancel: () => void;
}

export function TaskComposer({
  open,
  value,
  onChange,
  onAdd,
  onOpen,
  onCancel,
}: TaskComposerProps) {
  return (
    <div
      className={`project-page__task-composer${
        open ? " project-page__task-composer--open" : ""
      }`}
    >
      {open ? (
        <div className="project-page__task-composer-form">
          <input
            type="text"
            className="project-page__task-composer-input"
            value={value}
            placeholder="Type a task"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAdd();
              if (event.key === "Escape") onCancel();
            }}
            autoFocus
          />
          <div className="project-page__task-composer-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={onAdd}
              disabled={!value.trim()}
            >
              Add task
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="project-page__task-composer-trigger"
          onClick={onOpen}
        >
          <span className="project-page__task-composer-plus" aria-hidden="true">
            +
          </span>
          <span className="project-page__task-composer-label">Add task</span>
          <span className="project-page__heading-rule" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
