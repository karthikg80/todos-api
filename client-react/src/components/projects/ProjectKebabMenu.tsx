import { useState, useRef, useEffect, useCallback } from "react";
import { IconKebab } from "../shared/Icons";

interface Props {
  onToggleSettings?: () => void;
  settingsOpen?: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onRepeat: () => void;
  onComplete: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function ProjectKebabMenu({
  onToggleSettings,
  settingsOpen = false,
  onRename,
  onDuplicate,
  onRepeat,
  onComplete,
  onArchive,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setConfirmingDelete(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className="project-kebab" ref={panelRef}>
      <button
        ref={triggerRef}
        className="project-kebab__trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Project actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconKebab size={16} />
      </button>
      {open && (
        <div className="project-kebab__menu" role="menu">
          {onToggleSettings ? (
            <button
              className="project-kebab__item"
              role="menuitem"
              onClick={() => {
                onToggleSettings();
                close();
              }}
              aria-label={settingsOpen ? "Hide settings" : "Show settings"}
            >
              {settingsOpen ? "Hide settings" : "Show settings"}
            </button>
          ) : null}
          <button
            className="project-kebab__item"
            role="menuitem"
            onClick={() => {
              onRename();
              close();
            }}
            aria-label="Rename"
          >
            Rename
          </button>
          <button
            className="project-kebab__item"
            role="menuitem"
            onClick={() => {
              onDuplicate();
              close();
            }}
            aria-label="Duplicate project"
          >
            Duplicate project
          </button>
          <button
            className="project-kebab__item"
            role="menuitem"
            onClick={() => {
              onRepeat();
              close();
            }}
            aria-label="Repeat project"
          >
            Repeat project
          </button>
          <button
            className="project-kebab__item"
            role="menuitem"
            onClick={() => {
              onComplete();
              close();
            }}
            aria-label="Complete project"
          >
            Complete project
          </button>
          <button
            className="project-kebab__item"
            role="menuitem"
            onClick={() => {
              onArchive();
              close();
            }}
            aria-label="Archive"
          >
            Archive
          </button>
          {!confirmingDelete ? (
            <button
              className="project-kebab__item project-kebab__item--danger"
              role="menuitem"
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete"
            >
              Delete
            </button>
          ) : (
            <div className="project-kebab__confirm">
              <p className="project-kebab__confirm-text">
                Delete project? Tasks will become unsorted.
              </p>
              <button
                className="project-kebab__confirm-btn"
                onClick={() => {
                  onDelete();
                  close();
                }}
                aria-label="Confirm delete"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
