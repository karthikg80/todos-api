import { useState, useEffect, useRef, useCallback } from "react";
import type { Todo, UpdateTodoDto, TodoStatus, Priority } from "../../types";
import { SubtaskList } from "./SubtaskList";

interface Props {
  todo: Todo | null;
  onClose: () => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onDelete: (id: string) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const STATUS_OPTIONS: TodoStatus[] = [
  "inbox",
  "next",
  "in_progress",
  "waiting",
  "scheduled",
  "someday",
  "done",
  "cancelled",
];
const PRIORITY_OPTIONS: (Priority | "")[] = ["", "low", "medium", "high", "urgent"];

export function TodoDrawer({ todo, onClose, onSave, onDelete }: Props) {
  const isOpen = todo !== null;
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TodoStatus>("inbox");
  const [priority, setPriority] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const titleRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Sync fields when todo changes
  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setStatus(todo.status);
      setPriority(todo.priority || "");
      setDueDate(todo.dueDate ? todo.dueDate.split("T")[0] : "");
      setDescription(todo.description || "");
      setNotes(todo.notes || "");
      setSaveState("idle");
      triggerRef.current = document.activeElement;
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [todo]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Restore focus on close
  useEffect(() => {
    if (!isOpen && triggerRef.current instanceof HTMLElement) {
      requestAnimationFrame(() =>
        (triggerRef.current as HTMLElement)?.focus(),
      );
    }
  }, [isOpen]);

  const save = useCallback(
    async (field: string, value: unknown) => {
      if (!todo) return;
      setSaveState("saving");
      try {
        await onSave(todo.id, { [field]: value || null } as UpdateTodoDto);
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setSaveState("error");
      }
    },
    [todo, onSave],
  );

  return (
    <>
      <div
        className="todo-drawer-backdrop"
        aria-hidden={!isOpen}
        onClick={onClose}
      />
      <div
        id="todoDetailsDrawer"
        className="todo-drawer"
        aria-hidden={!isOpen}
        role="dialog"
        aria-label="Task details"
      >
        {todo && (
          <>
            <div className="todo-drawer__header">
              <button
                id="todoDrawerClose"
                className="todo-drawer__close"
                onClick={onClose}
                aria-label="Close drawer"
              >
                ✕
              </button>
              <span id="drawerSaveStatus" className="todo-drawer__save-status">
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Saved"
                    : saveState === "error"
                      ? "Error saving"
                      : ""}
              </span>
            </div>
            <div className="todo-drawer__body">
              <input
                id="drawerTitleInput"
                className="todo-drawer__title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (title.trim() && title !== todo.title)
                    save("title", title.trim());
                }}
              />

              <div className="todo-drawer__field">
                <label className="todo-drawer__label" htmlFor="drawerStatusSelect">
                  Status
                </label>
                <select
                  id="drawerStatusSelect"
                  className="todo-drawer__select"
                  value={status}
                  onChange={(e) => {
                    const v = e.target.value as TodoStatus;
                    setStatus(v);
                    save("status", v);
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="todo-drawer__field">
                <label
                  className="todo-drawer__label"
                  htmlFor="drawerPrioritySelect"
                >
                  Priority
                </label>
                <select
                  id="drawerPrioritySelect"
                  className="todo-drawer__select"
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value);
                    save("priority", e.target.value || null);
                  }}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p ? p : "None"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="todo-drawer__field">
                <label className="todo-drawer__label" htmlFor="drawerDueDateInput">
                  Due date
                </label>
                <input
                  id="drawerDueDateInput"
                  className="todo-drawer__input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    save("dueDate", e.target.value || null);
                  }}
                />
              </div>

              <div className="todo-drawer__field">
                <label
                  className="todo-drawer__label"
                  htmlFor="drawerDescriptionTextarea"
                >
                  Description
                </label>
                <textarea
                  id="drawerDescriptionTextarea"
                  className="todo-drawer__textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => {
                    if (description !== (todo.description || ""))
                      save("description", description);
                  }}
                />
              </div>

              <div className="todo-drawer__field">
                <label className="todo-drawer__label" htmlFor="drawerNotesInput">
                  Notes
                </label>
                <textarea
                  id="drawerNotesInput"
                  className="todo-drawer__textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    if (notes !== (todo.notes || "")) save("notes", notes);
                  }}
                />
              </div>

              <SubtaskList todoId={todo.id} />
            </div>
            <div className="todo-drawer__footer">
              <button
                id="drawerDeleteTodoButton"
                className="btn btn--danger"
                onClick={() => onDelete(todo.id)}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
