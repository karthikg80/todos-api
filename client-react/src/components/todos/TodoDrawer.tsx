import { useState, useEffect, useRef, useCallback } from "react";
import { relativeTime } from "../../utils/relativeTime";
import { TaskPicker } from "../shared/TaskPicker";
import { TaskTimeline } from "./TaskTimeline";
import type {
  Todo,
  UpdateTodoDto,
  TodoStatus,
  Priority,
  RecurrenceType,
  Heading,
  Project,
} from "../../types";
import { SubtaskList } from "./SubtaskList";
import { AiDrawerAssist } from "../ai/AiDrawerAssist";
import { apiCall } from "../../api/client";

interface Props {
  todo: Todo | null;
  todos: Todo[];
  projects: Project[];
  onClose: () => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onDelete: (id: string) => void;
  onOpenFullPage?: (id: string) => void;
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

export function TodoDrawer({ todo, todos, projects, onClose, onSave, onDelete, onOpenFullPage }: Props) {
  const isOpen = todo !== null;
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TodoStatus>("inbox");
  const [priority, setPriority] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
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
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [headingId, setHeadingId] = useState("");
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const titleRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setStatus(todo.status);
      setPriority(todo.priority || "");
      setProjectId(todo.projectId || "");
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
      setRecurrenceType(todo.recurrence?.type || "none");
      setRecurrenceInterval(
        todo.recurrence?.interval != null
          ? String(todo.recurrence.interval)
          : "1",
      );
      setHeadingId(todo.headingId || "");
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

  // Load headings when project changes
  useEffect(() => {
    if (!projectId) {
      setHeadings([]);
      return;
    }
    apiCall(`/projects/${projectId}/headings`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHeadings(Array.isArray(data) ? data : []))
      .catch(() => setHeadings([]));
  }, [projectId]);

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
              {onOpenFullPage && (
                <button
                  className="todo-drawer__expand"
                  onClick={() => onOpenFullPage(todo.id)}
                  aria-label="Open full page"
                  title="Open full page"
                >
                  ⛶
                </button>
              )}
              <span id="drawerSaveStatus" className="todo-drawer__save-status">
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "Saved"
                    : saveState === "error"
                      ? "Error saving"
                      : todo.updatedAt
                        ? `Updated ${relativeTime(todo.updatedAt)}`
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
                  htmlFor="drawerProjectSelect"
                >
                  Project
                </label>
                <select
                  id="drawerProjectSelect"
                  className="todo-drawer__select"
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    save("projectId", e.target.value || null);
                  }}
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

              {/* Heading selector — only when project has headings */}
              {projectId && headings.length > 0 && (
                <div className="todo-drawer__field">
                  <label
                    className="todo-drawer__label"
                    htmlFor="drawerHeadingSelect"
                  >
                    Section
                  </label>
                  <select
                    id="drawerHeadingSelect"
                    className="todo-drawer__select"
                    value={headingId}
                    onChange={(e) => {
                      setHeadingId(e.target.value);
                      save("headingId", e.target.value || null);
                    }}
                  >
                    <option value="">None</option>
                    {headings.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

                  <div className="todo-drawer__row">
                    <div className="todo-drawer__field todo-drawer__field--half">
                      <label
                        className="todo-drawer__label"
                        htmlFor="drawerEffortSelect"
                      >
                        Effort
                      </label>
                      <select
                        id="drawerEffortSelect"
                        className="todo-drawer__select"
                        value={todo.effortScore != null ? String(todo.effortScore) : ""}
                        onChange={(e) => {
                          save("effortScore", e.target.value ? Number(e.target.value) : null);
                        }}
                      >
                        <option value="">None</option>
                        <option value="1">Low</option>
                        <option value="2">Medium</option>
                        <option value="3">High</option>
                      </select>
                    </div>
                    <div className="todo-drawer__field todo-drawer__field--half">
                      <label
                        className="todo-drawer__label"
                        htmlFor="drawerEmotionalStateSelect"
                      >
                        Feeling
                      </label>
                      <select
                        id="drawerEmotionalStateSelect"
                        className="todo-drawer__select"
                        value={todo.emotionalState || ""}
                        onChange={(e) => {
                          save("emotionalState", e.target.value || null);
                        }}
                      >
                        <option value="">None</option>
                        <option value="avoiding">Avoiding</option>
                        <option value="unclear">Unclear</option>
                        <option value="heavy">Heavy</option>
                        <option value="exciting">Exciting</option>
                        <option value="draining">Draining</option>
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

                  <div className="todo-drawer__row">
                    <div className="todo-drawer__field todo-drawer__field--half">
                      <label
                        className="todo-drawer__label"
                        htmlFor="drawerRecurrenceSelect"
                      >
                        Repeat
                      </label>
                      <select
                        id="drawerRecurrenceSelect"
                        className="todo-drawer__select"
                        value={recurrenceType}
                        onChange={(e) => {
                          const t = e.target.value as RecurrenceType;
                          setRecurrenceType(t);
                          save("recurrence", {
                            type: t,
                            interval: t === "none" ? null : Number(recurrenceInterval) || 1,
                          });
                        }}
                      >
                        <option value="none">Never</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    {recurrenceType !== "none" && (
                      <div className="todo-drawer__field todo-drawer__field--half">
                        <label
                          className="todo-drawer__label"
                          htmlFor="drawerRecurrenceInterval"
                        >
                          Every
                        </label>
                        <input
                          id="drawerRecurrenceInterval"
                          className="todo-drawer__input"
                          type="number"
                          min="1"
                          max="365"
                          value={recurrenceInterval}
                          onChange={(e) => setRecurrenceInterval(e.target.value)}
                          onBlur={() => {
                            const val = Number(recurrenceInterval) || 1;
                            save("recurrence", {
                              type: recurrenceType,
                              interval: val,
                            });
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Dependencies — full picker */}
                  <div className="todo-drawer__field">
                    <span className="todo-drawer__label">Depends on</span>
                    <TaskPicker
                      todos={todos}
                      excludeId={todo.id}
                      selectedIds={todo.dependsOnTaskIds || []}
                      onChange={(ids) => save("dependsOnTaskIds", ids)}
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

              <AiDrawerAssist todoId={todo.id} todoTitle={title} />

              <TaskTimeline todoId={todo.id} />
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
