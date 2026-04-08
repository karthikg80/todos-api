import { useEffect, useState } from "react";
import type { CreateTodoDto, Heading, Todo, UpdateTodoDto } from "../../types";
import {
  PROJECT_RAIL_BACKLOG_SENTINEL,
  effortDisplayLabel,
  formatDueFriendly,
  todoStatusLabel,
} from "./projectEditorModels";

interface Props {
  index: number;
  todo: Todo;
  projectId: string;
  headings: Heading[];
  isBulkMode: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onAddTodo: (dto: CreateTodoDto) => Promise<unknown>;
  onRequestDeleteTodo: (id: string) => void;
}

export function ProjectInlineTaskRow({
  index,
  todo,
  projectId,
  headings,
  isBulkMode,
  selected,
  onSelect,
  onSave,
  onAddTodo,
  onRequestDeleteTodo,
}: Props) {
  const [titleDraft, setTitleDraft] = useState(todo.title);
  const [notesDraft, setNotesDraft] = useState(todo.notes ?? "");

  useEffect(() => {
    setTitleDraft(todo.title);
    setNotesDraft(todo.notes ?? "");
  }, [todo.id, todo.title, todo.notes]);

  const moveValue =
    todo.headingId ?? PROJECT_RAIL_BACKLOG_SENTINEL;

  return (
    <div className="project-editor__task-row" data-task-id={todo.id}>
      <div className="project-editor__task-row-inner">
        {isBulkMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(todo.id)}
            aria-label={`Select ${todo.title}`}
          />
        ) : null}
        <div className="project-editor__task-main">
          <div className="project-editor__task-title-row">
            <span className="project-editor__task-index">{index + 1}</span>
            <input
              className="project-editor__task-title-input"
              value={titleDraft}
              aria-label="Task title"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft !== todo.title) {
                  void onSave(todo.id, { title: titleDraft });
                }
              }}
            />
          </div>
          <div className="project-editor__mini-grid">
            <label className="project-editor__mini-field">
              <span className="project-editor__stat-label">Status</span>
              <select
                className="project-editor__select"
                style={{ marginTop: "0.25rem", border: "none", padding: 0 }}
                value={todo.status}
                onChange={(e) =>
                  void onSave(todo.id, {
                    status: e.target.value as Todo["status"],
                  })
                }
              >
                {(
                  [
                    "inbox",
                    "next",
                    "in_progress",
                    "waiting",
                    "scheduled",
                    "someday",
                    "done",
                    "cancelled",
                  ] as const
                ).map((s) => (
                  <option key={s} value={s}>
                    {todoStatusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="project-editor__mini-field">
              <span className="project-editor__stat-label">Effort</span>
              <span
                className="project-editor__stat-value"
                style={{ marginTop: "0.2rem", fontSize: "0.85rem" }}
              >
                {effortDisplayLabel(todo)}
              </span>
              <select
                className="project-editor__select"
                style={{ marginTop: "0.35rem" }}
                value={todo.energy ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  void onSave(todo.id, {
                    energy: v === "" ? null : (v as Todo["energy"]),
                  });
                }}
              >
                <option value="">(infer)</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <div className="project-editor__mini-field">
              <span className="project-editor__stat-label">Owner</span>
              <span
                className="project-editor__stat-value"
                style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}
              >
                Me
              </span>
            </div>
            <label className="project-editor__mini-field">
              <span className="project-editor__stat-label">Due</span>
              <span
                className="project-editor__stat-value"
                style={{ marginTop: "0.2rem", fontSize: "0.75rem" }}
              >
                {formatDueFriendly(todo.dueDate)}
              </span>
              <input
                type="date"
                className="project-editor__input"
                style={{ marginTop: "0.25rem" }}
                value={todo.dueDate ? todo.dueDate.split("T")[0] : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  void onSave(todo.id, {
                    dueDate: v ? `${v}T12:00:00.000Z` : null,
                  });
                }}
              />
            </label>
          </div>
          <textarea
            className="project-editor__desc-input"
            style={{ minHeight: "3.5rem" }}
            value={notesDraft}
            placeholder="Notes…"
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => {
              const next = notesDraft.trim() ? notesDraft : null;
              const prev = todo.notes ?? null;
              if (next !== prev) {
                void onSave(todo.id, { notes: next });
              }
            }}
          />
        </div>
        <div className="project-editor__task-side">
          <label className="project-editor__field-label" htmlFor={`move-${todo.id}`}>
            Section
          </label>
          <select
            id={`move-${todo.id}`}
            className="project-editor__select"
            value={moveValue}
            onChange={(e) => {
              const v = e.target.value;
              const headingId =
                v === PROJECT_RAIL_BACKLOG_SENTINEL ? null : v;
              void onSave(todo.id, { headingId });
            }}
          >
            <option value={PROJECT_RAIL_BACKLOG_SENTINEL}>Backlog</option>
            {headings.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn"
            onClick={() =>
              void onAddTodo({
                title: `${todo.title} (copy)`,
                projectId,
                headingId: todo.headingId ?? null,
              })
            }
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => onRequestDeleteTodo(todo.id)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
