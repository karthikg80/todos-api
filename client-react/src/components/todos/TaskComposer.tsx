import { useState, useEffect, useRef, useCallback } from "react";
import type { CreateTodoDto, TodoStatus, Priority, Project } from "../../types";
import { AiOnCreateAssist } from "../ai/AiOnCreateAssist";

interface Props {
  isOpen: boolean;
  projects: Project[];
  defaultProjectId?: string | null;
  onSubmit: (dto: CreateTodoDto) => Promise<unknown>;
  onClose: () => void;
}

const STATUS_OPTIONS: TodoStatus[] = [
  "inbox",
  "next",
  "in_progress",
  "waiting",
  "scheduled",
  "someday",
];
const PRIORITY_OPTIONS: (Priority | "")[] = [
  "",
  "low",
  "medium",
  "high",
  "urgent",
];

export function TaskComposer({
  isOpen,
  projects,
  defaultProjectId,
  onSubmit,
  onClose,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TodoStatus>("inbox");
  const [priority, setPriority] = useState<string>("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setStatus("inbox");
      setPriority("");
      setProjectId(defaultProjectId || "");
      setDueDate("");
      setTags("");
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [isOpen, defaultProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const dto: CreateTodoDto = {
        title: trimmed,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(status !== "inbox" ? { status } : {}),
        ...(priority ? { priority: priority as Priority } : {}),
        ...(projectId ? { projectId } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(tags.trim()
          ? {
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }
          : {}),
      };
      await onSubmit(dto);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="composer-overlay" onClick={onClose}>
      <div
        className="composer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="New task"
      >
        <div className="composer__header">
          <h3 className="composer__title">New Task</h3>
          <button className="todo-drawer__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="composer__body">
          <input
            ref={titleRef}
            className="composer__input composer__input--title"
            type="text"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <textarea
            className="composer__textarea"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <div className="composer__row">
            <div className="composer__field">
              <label className="todo-drawer__label">Status</label>
              <select
                id="todoStatusSelect"
                className="todo-drawer__select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TodoStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="composer__field">
              <label className="todo-drawer__label">Priority</label>
              <select
                id="todoPrioritySelect"
                className="todo-drawer__select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p || "None"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="composer__row">
            <div className="composer__field">
              <label className="todo-drawer__label">Project</label>
              <select
                id="todoProjectSelect"
                className="todo-drawer__select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects
                  .filter((p) => !p.archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="composer__field">
              <label className="todo-drawer__label">Due date</label>
              <input
                id="todoDueDateInput"
                className="todo-drawer__input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="composer__field">
            <label className="todo-drawer__label">
              Tags (comma-separated)
            </label>
            <input
              id="todoTagsInput"
              className="todo-drawer__input"
              type="text"
              placeholder="e.g. work, important"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <AiOnCreateAssist
            title={title}
            onApplySuggestion={(field, value) => {
              if (field === "priority") setPriority(value);
              else if (field === "status") setStatus(value as TodoStatus);
              else if (field === "projectId") setProjectId(value);
              else if (field === "dueDate") setDueDate(value);
            }}
          />
        </div>
        <div className="composer__footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderColor: "var(--accent)",
            }}
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting ? "Creating…" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
