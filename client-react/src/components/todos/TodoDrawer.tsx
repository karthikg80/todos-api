import { useState, useEffect, useRef, useCallback } from "react";
import { relativeTime } from "../../utils/relativeTime";
import { TaskTimeline } from "./TaskTimeline";
import type {
  Todo,
  UpdateTodoDto,
  Heading,
  Project,
} from "../../types";
import { SubtaskList } from "./SubtaskList";
import { FieldRenderer } from "./FieldRenderer";
import { useFieldLayout } from "../../hooks/useFieldLayout";
import { FIELD_REGISTRY_BY_KEY } from "../../types/fieldLayout";
import { apiCall } from "../../api/client";
import { useOverlayFocusTrap } from "../shared/useOverlayFocusTrap";

interface Props {
  todo: Todo | null;
  projects: Project[];
  onClose: () => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onDelete: (id: string) => void;
  onOpenFullPage?: (id: string) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function TodoDrawer({ todo, projects, onClose, onSave, onDelete, onOpenFullPage }: Props) {
  const isOpen = todo !== null;
  const layout = useFieldLayout();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const titleRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useOverlayFocusTrap({
    isOpen,
    containerRef: drawerRef,
    onClose,
    initialFocusRef: titleRef,
    restoreFocus: false,
  });

  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setProjectId(todo.projectId || "");
      setSaveState("idle");
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
    (field: string, value: unknown) => {
      if (!todo) return;
      if (field === "projectId") setProjectId(String(value ?? ""));
      setSaveState("saving");
      onSave(todo.id, { [field]: value ?? null } as UpdateTodoDto)
        .then(() => {
          setSaveState("saved");
          setTimeout(
            () => setSaveState((s) => (s === "saved" ? "idle" : s)),
            2000,
          );
        })
        .catch(() => setSaveState("error"));
    },
    [todo, onSave],
  );

  const fieldKeys = layout.drawer;

  return (
    <>
      <div
        className="todo-drawer-backdrop"
        aria-hidden={!isOpen}
        onClick={onClose}
      />
      <div
        ref={drawerRef}
        id="todoDetailsDrawer"
        className="todo-drawer"
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        tabIndex={-1}
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

              <div className="todo-drawer__fields">
                {fieldKeys.map((key) => {
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

              {/* Full page link */}
              {onOpenFullPage && (
                <button
                  className="todo-drawer__full-page-link"
                  onClick={() => onOpenFullPage(todo.id)}
                >
                  View all fields →
                </button>
              )}

              <SubtaskList todoId={todo.id} />

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
