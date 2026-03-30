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
const PRIORITY_OPTIONS: (Priority | "")[] = [
  "",
  "low",
  "medium",
  "high",
  "urgent",
];
const ENERGY_OPTIONS = ["", "low", "medium", "high"];

export function TodoDrawer({ todo, onClose, onSave, onDelete }: Props) {
  const isOpen = todo !== null;
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TodoStatus>("inbox");
  const [priority, setPriority] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [energy, setEnergy] = useState("");
  const [context, setContext] = useState("");
  const [waitingOn, setWaitingOn] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const titleRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setStatus(todo.status);
      setPriority(todo.priority || "");
      setDueDate(todo.dueDate ? todo.dueDate.split("T")[0] : "");
      setStartDate(todo.startDate ? todo.startDate.split("T")[0] : "");
      setScheduledDate(
        todo.scheduledDate ? todo.scheduledDate.split("T")[0] : "",
      );
      setReviewDate(todo.reviewDate ? todo.reviewDate.split("T")[0] : "");
      setDescription(todo.description || "");
      setNotes(todo.notes || "");
      setEnergy(todo.energy || "");
      setContext(todo.context || "");
      setWaitingOn(todo.waitingOn || "");
      setFirstStep(todo.firstStep || "");
      setEstimateMinutes(
        todo.estimateMinutes != null ? String(todo.estimateMinutes) : "",
      );
      setSaveState("idle");
      setDetailsOpen(false);
      triggerRef.current = document.activeElement;
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [todo]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

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
        setTimeout(
          () => setSaveState((s) => (s === "saved" ? "idle" : s)),
          2000,
        );
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

              {/* Core fields — always visible */}
              <div className="todo-drawer__row">
                <div className="todo-drawer__field todo-drawer__field--half">
                  <label
                    className="todo-drawer__label"
                    htmlFor="drawerStatusSelect"
                  >
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
                <div className="todo-drawer__field todo-drawer__field--half">
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
                        {p || "None"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="todo-drawer__field">
                <label
                  className="todo-drawer__label"
                  htmlFor="drawerDueDateInput"
                >
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

              {/* Expandable details section */}
              <button
                id="drawerDetailsToggle"
                className="todo-drawer__details-toggle"
                onClick={() => setDetailsOpen((o) => !o)}
                aria-expanded={detailsOpen}
              >
                {detailsOpen ? "▾" : "▸"} More details
              </button>

              {detailsOpen && (
                <div id="drawerDetailsPanel" className="todo-drawer__details">
                  <div className="todo-drawer__row">
                    <div className="todo-drawer__field todo-drawer__field--half">
                      <label
                        className="todo-drawer__label"
                        htmlFor="drawerStartDateInput"
                      >
                        Start date
                      </label>
                      <input
                        id="drawerStartDateInput"
                        className="todo-drawer__input"
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          save("startDate", e.target.value || null);
                        }}
                      />
                    </div>
                    <div className="todo-drawer__field todo-drawer__field--half">
                      <label
                        className="todo-drawer__label"
                        htmlFor="drawerScheduledDateInput"
                      >
                        Scheduled
                      </label>
                      <input
                        id="drawerScheduledDateInput"
                        className="todo-drawer__input"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => {
                          setScheduledDate(e.target.value);
                          save("scheduledDate", e.target.value || null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="todo-drawer__row">
                    <div className="todo-drawer__field todo-drawer__field--half">
                      <label
                        className="todo-drawer__label"
                        htmlFor="drawerReviewDateInput"
                      >
                        Review date
                      </label>
                      <input
                        id="drawerReviewDateInput"
                        className="todo-drawer__input"
                        type="date"
                        value={reviewDate}
                        onChange={(e) => {
                          setReviewDate(e.target.value);
                          save("reviewDate", e.target.value || null);
                        }}
                      />
                    </div>
                    <div className="todo-drawer__field todo-drawer__field--half">
                      <label
                        className="todo-drawer__label"
                        htmlFor="drawerEnergySelect"
                      >
                        Energy
                      </label>
                      <select
                        id="drawerEnergySelect"
                        className="todo-drawer__select"
                        value={energy}
                        onChange={(e) => {
                          setEnergy(e.target.value);
                          save("energy", e.target.value || null);
                        }}
                      >
                        {ENERGY_OPTIONS.map((e) => (
                          <option key={e} value={e}>
                            {e || "None"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="todo-drawer__field">
                    <label
                      className="todo-drawer__label"
                      htmlFor="drawerContextInput"
                    >
                      Context
                    </label>
                    <input
                      id="drawerContextInput"
                      className="todo-drawer__input"
                      type="text"
                      placeholder="e.g. @home, @office"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      onBlur={() => {
                        if (context !== (todo.context || ""))
                          save("context", context);
                      }}
                    />
                  </div>

                  <div className="todo-drawer__field">
                    <label
                      className="todo-drawer__label"
                      htmlFor="drawerWaitingOnInput"
                    >
                      Waiting on
                    </label>
                    <input
                      id="drawerWaitingOnInput"
                      className="todo-drawer__input"
                      type="text"
                      placeholder="Who or what are you waiting for?"
                      value={waitingOn}
                      onChange={(e) => setWaitingOn(e.target.value)}
                      onBlur={() => {
                        if (waitingOn !== (todo.waitingOn || ""))
                          save("waitingOn", waitingOn);
                      }}
                    />
                  </div>

                  <div className="todo-drawer__field">
                    <label
                      className="todo-drawer__label"
                      htmlFor="drawerFirstStepInput"
                    >
                      First step
                    </label>
                    <input
                      id="drawerFirstStepInput"
                      className="todo-drawer__input"
                      type="text"
                      placeholder="What's the very first action?"
                      value={firstStep}
                      onChange={(e) => setFirstStep(e.target.value)}
                      onBlur={() => {
                        if (firstStep !== (todo.firstStep || ""))
                          save("firstStep", firstStep);
                      }}
                    />
                  </div>

                  <div className="todo-drawer__field">
                    <label
                      className="todo-drawer__label"
                      htmlFor="drawerEstimateInput"
                    >
                      Estimate (minutes)
                    </label>
                    <input
                      id="drawerEstimateInput"
                      className="todo-drawer__input"
                      type="number"
                      min="0"
                      value={estimateMinutes}
                      onChange={(e) => setEstimateMinutes(e.target.value)}
                      onBlur={() => {
                        const val = estimateMinutes
                          ? Number(estimateMinutes)
                          : null;
                        if (val !== (todo.estimateMinutes ?? null))
                          save("estimateMinutes", val);
                      }}
                    />
                  </div>

                  <div className="todo-drawer__field">
                    <label
                      className="todo-drawer__label"
                      htmlFor="drawerNotesInput"
                    >
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
                </div>
              )}

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
