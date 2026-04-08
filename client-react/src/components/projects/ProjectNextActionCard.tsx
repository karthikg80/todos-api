import { useEffect, useState } from "react";
import type { Todo, UpdateTodoDto } from "../../types";
import {
  effortDisplayLabel,
  formatDueFriendly,
  todoStatusLabel,
} from "./projectEditorModels";
import { getTaskNextReason } from "./projectWorkspaceModels";

interface Props {
  nextTask: Todo | null;
  projectTodos: Todo[];
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onDeferTask?: (todo: Todo) => Promise<void>;
  onReplaceNext?: () => void;
}

export function ProjectNextActionCard({
  nextTask,
  projectTodos,
  onSave,
  onDeferTask,
  onReplaceNext,
}: Props) {
  const [titleDraft, setTitleDraft] = useState(nextTask?.title ?? "");
  const [notesDraft, setNotesDraft] = useState(nextTask?.notes ?? "");

  useEffect(() => {
    setTitleDraft(nextTask?.title ?? "");
    setNotesDraft(nextTask?.notes ?? "");
  }, [nextTask?.id, nextTask?.title, nextTask?.notes]);

  if (!nextTask) {
    return (
      <section className="project-editor__panel">
        <h2 className="project-editor__rail-title">Next action</h2>
        <p className="project-editor__field-label">
          Add a task to define a clear next step for this project.
        </p>
      </section>
    );
  }

  const reason = getTaskNextReason(nextTask, projectTodos);

  return (
    <section className="project-editor__panel">
      <div className="project-editor__toolbar">
        <div>
          <h2 className="project-editor__rail-title">Next action</h2>
          <p className="project-editor__field-label">
            {reason ? `${reason}.` : "Keep the best next step visible."}
          </p>
        </div>
        <div className="project-editor__toolbar-actions">
          <button
            type="button"
            className="btn"
            id="projectEditorDeferNext"
            onClick={() => void onDeferTask?.(nextTask)}
          >
            Defer
          </button>
          <button
            type="button"
            className="btn"
            id="projectEditorPickAnother"
            onClick={() => onReplaceNext?.()}
          >
            Pick another
          </button>
        </div>
      </div>

      <div className="project-editor__next-card">
        <input
          className="project-editor__next-title-input"
          value={titleDraft}
          aria-label="Next action title"
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            if (titleDraft !== nextTask.title) {
              void onSave(nextTask.id, { title: titleDraft });
            }
          }}
        />
        <div className="project-editor__mini-grid">
          <label className="project-editor__mini-field">
            <span className="project-editor__stat-label">Status</span>
            <select
              className="project-editor__select"
              value={nextTask.status}
              onChange={(e) =>
                void onSave(nextTask.id, {
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
          <div className="project-editor__mini-field">
            <span className="project-editor__stat-label">Effort</span>
            <span className="project-editor__stat-value">
              {effortDisplayLabel(nextTask)}
            </span>
          </div>
          <div className="project-editor__mini-field">
            <span className="project-editor__stat-label">Owner</span>
            <span className="project-editor__stat-value">Me</span>
          </div>
          <label className="project-editor__mini-field">
            <span className="project-editor__stat-label">Due</span>
            <span className="project-editor__stat-value">
              {formatDueFriendly(nextTask.dueDate)}
            </span>
            <input
              type="date"
              className="project-editor__input"
              value={nextTask.dueDate ? nextTask.dueDate.split("T")[0] : ""}
              onChange={(e) => {
                const v = e.target.value;
                void onSave(nextTask.id, {
                  dueDate: v ? `${v}T12:00:00.000Z` : null,
                });
              }}
            />
          </label>
        </div>
        <textarea
          className="project-editor__desc-input"
          value={notesDraft}
          placeholder="Notes…"
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => {
            const next = notesDraft.trim() ? notesDraft : null;
            const prev = nextTask.notes ?? null;
            if (next !== prev) {
              void onSave(nextTask.id, { notes: next });
            }
          }}
        />
      </div>
    </section>
  );
}
