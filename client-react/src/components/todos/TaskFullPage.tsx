import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { relativeTime } from "../../utils/relativeTime";
import type {
  Todo,
  UpdateTodoDto,
  RecurrenceType,
  Heading,
  Project,
} from "../../types";
import { SubtaskList } from "./SubtaskList";
import { AiDrawerAssist } from "../ai/AiDrawerAssist";
import { FieldRenderer } from "./FieldRenderer";
import { apiCall } from "../../api/client";
import { useFieldLayout } from "../../hooks/useFieldLayout";
import {
  FIELD_REGISTRY,
  FIELD_REGISTRY_BY_KEY,
  type FieldGroup,
} from "../../types/fieldLayout";

interface Props {
  todo: Todo;
  projects: Project[];
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onDelete: (id: string) => void;
  onBack: () => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** Fields rendered as hero content in the left column, not via FieldRenderer */
const HERO_FIELDS = new Set(["description", "notes", "firstStep"]);

/** Fields that need special compound rendering */
const SPECIAL_FIELDS = new Set(["recurrenceType", "recurrenceInterval", "headingId"]);

const SECTION_LABELS: Record<FieldGroup, string> = {
  status: "Status & Priority",
  dates: "Dates",
  project: "Project & Context",
  planning: "Planning",
  advanced: "Advanced",
};

const SECTION_ORDER: FieldGroup[] = ["status", "dates", "project", "planning", "advanced"];

export function TaskFullPage({ todo, projects, onSave, onDelete, onBack }: Props) {
  const layout = useFieldLayout();

  /* ─── Local state for hero fields ──────────────────────── */
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description || "");
  const [notes, setNotes] = useState(todo.notes || "");
  const [firstStep, setFirstStep] = useState(todo.firstStep || "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState(todo.projectId || "");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    todo.recurrence?.type || "none",
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(
    todo.recurrence?.interval != null ? String(todo.recurrence.interval) : "1",
  );
  const titleRef = useRef<HTMLInputElement>(null);

  /* ─── Sync from todo prop ──────────────────────────────── */
  useEffect(() => {
    setTitle(todo.title);
    setDescription(todo.description || "");
    setNotes(todo.notes || "");
    setFirstStep(todo.firstStep || "");
    setCurrentProjectId(todo.projectId || "");
    setRecurrenceType(todo.recurrence?.type || "none");
    setRecurrenceInterval(
      todo.recurrence?.interval != null ? String(todo.recurrence.interval) : "1",
    );
    setSaveState("idle");
  }, [todo]);

  /* ─── Load headings ────────────────────────────────────── */
  useEffect(() => {
    if (!currentProjectId) {
      setHeadings([]);
      return;
    }
    apiCall(`/projects/${currentProjectId}/headings`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHeadings(Array.isArray(data) ? data : []))
      .catch(() => setHeadings([]));
  }, [currentProjectId]);

  /* ─── Save callback ────────────────────────────────────── */
  const save = useCallback(
    async (field: string, value: unknown) => {
      setSaveState("saving");
      try {
        if (field === "projectId") setCurrentProjectId(String(value ?? ""));
        await onSave(todo.id, { [field]: value ?? null } as UpdateTodoDto);
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setSaveState("error");
      }
    },
    [todo.id, onSave],
  );

  const saveRecurrence = useCallback(
    (type: RecurrenceType, interval: string) => {
      save("recurrence", {
        type,
        interval: type === "none" ? null : Number(interval) || 1,
      });
    },
    [save],
  );

  /* ─── Hero field blur handlers ─────────────────────────── */
  const saveHeroField = useCallback(
    (field: string, value: string, original: string | null | undefined) => {
      const trimmed = value.trim();
      if (trimmed !== (original || "").trim()) {
        save(field, trimmed || null);
      }
    },
    [save],
  );

  /* ─── Group sidebar fields by section ──────────────────── */
  const sidebarSections = useMemo(() => {
    // All fields in the registry, excluding hero and special fields
    const allKeys = FIELD_REGISTRY.map((f) => f.key).filter(
      (k) => !HERO_FIELDS.has(k) && !SPECIAL_FIELDS.has(k),
    );

    const grouped: Record<FieldGroup, string[]> = {
      status: [],
      dates: [],
      project: [],
      planning: [],
      advanced: [],
    };

    for (const key of allKeys) {
      const def = FIELD_REGISTRY_BY_KEY[key];
      if (def) grouped[def.group].push(key);
    }

    return SECTION_ORDER.map((group) => ({
      group,
      label: SECTION_LABELS[group],
      fields: grouped[group],
    })).filter((s) => s.fields.length > 0);
  }, []);

  return (
    <div className="task-full-page">
      {/* ─── Top bar ─────────────────────────────────── */}
      <div className="task-full-page__topbar">
        <button
          className="task-full-page__back"
          onClick={onBack}
          aria-label="Back to list"
        >
          ← Back
        </button>
        <span className="task-full-page__save-status">
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
        <span className="task-full-page__meta">
          Created {relativeTime(todo.createdAt)}
        </span>
      </div>

      <div className="task-full-page__layout">
        {/* ─── Left column: hero content ─────────────── */}
        <div className="task-full-page__main">
          <input
            ref={titleRef}
            className="task-full-page__title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== todo.title)
                save("title", title.trim());
            }}
            placeholder="Task title"
          />

          <div className="task-full-page__field">
            <label className="task-full-page__label">Description</label>
            <textarea
              className="task-full-page__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => saveHeroField("description", description, todo.description)}
              placeholder="What needs to be done?"
            />
          </div>

          <div className="task-full-page__field">
            <label className="task-full-page__label">First step</label>
            <input
              className="task-full-page__input"
              type="text"
              value={firstStep}
              onChange={(e) => setFirstStep(e.target.value)}
              onBlur={() => saveHeroField("firstStep", firstStep, todo.firstStep)}
              placeholder="What's the very first action?"
            />
          </div>

          <div className="task-full-page__field">
            <label className="task-full-page__label">Notes</label>
            <textarea
              className="task-full-page__textarea task-full-page__textarea--tall"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => saveHeroField("notes", notes, todo.notes)}
              placeholder="Private notes, links, context…"
            />
          </div>

          <SubtaskList todoId={todo.id} />
          <AiDrawerAssist todoId={todo.id} todoTitle={title} />

          <div className="task-full-page__danger">
            <button
              className="btn btn--danger"
              onClick={() => onDelete(todo.id)}
            >
              Delete task
            </button>
          </div>
        </div>

        {/* ─── Right sidebar: all metadata fields ────── */}
        <div className="task-full-page__sidebar">
          {sidebarSections.map(({ group, label, fields }) => (
            <div key={group} className="task-full-page__section">
              <h3 className="task-full-page__section-title">{label}</h3>
              {fields.map((key) => {
                const def = FIELD_REGISTRY_BY_KEY[key];
                if (!def) return null;
                return (
                  <FieldRenderer
                    key={key}
                    fieldDef={def}
                    todo={todo}
                    projects={projects}
                    headings={headings}
                    onSave={save}
                  />
                );
              })}
            </div>
          ))}

          {/* Heading — conditional */}
          {currentProjectId && headings.length > 0 && (
            <FieldRenderer
              fieldDef={FIELD_REGISTRY_BY_KEY.headingId}
              todo={todo}
              headings={headings}
              onSave={save}
            />
          )}

          {/* Recurrence — compound */}
          <div className="task-full-page__section">
            <h3 className="task-full-page__section-title">Recurrence</h3>
            <div className="todo-drawer__row">
              <div className="todo-drawer__field todo-drawer__field--half">
                <label className="todo-drawer__label" htmlFor="fp-recurrenceType">
                  Repeat
                </label>
                <select
                  id="fp-recurrenceType"
                  className="todo-drawer__select"
                  value={recurrenceType}
                  onChange={(e) => {
                    const t = e.target.value as RecurrenceType;
                    setRecurrenceType(t);
                    saveRecurrence(t, recurrenceInterval);
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
                  <label className="todo-drawer__label" htmlFor="fp-recurrenceInterval">
                    Every
                  </label>
                  <input
                    id="fp-recurrenceInterval"
                    className="todo-drawer__input"
                    type="number"
                    min="1"
                    max="365"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(e.target.value)}
                    onBlur={() => saveRecurrence(recurrenceType, recurrenceInterval)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Dependencies — read-only */}
          {todo.dependsOnTaskIds && todo.dependsOnTaskIds.length > 0 && (
            <div className="task-full-page__section">
              <h3 className="task-full-page__section-title">Dependencies</h3>
              <div className="todo-drawer__deps">
                {todo.dependsOnTaskIds.map((depId) => (
                  <span key={depId} className="todo-chip todo-chip--project">
                    {depId.slice(0, 8)}…
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
