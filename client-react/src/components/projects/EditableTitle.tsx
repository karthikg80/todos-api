import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  value: string;
  onSave: (newValue: string) => void;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  className?: string;
}

export function EditableTitle({ value, onSave, editing: externalEditing, onEditingChange, className }: Props) {
  const [internalEditing, setInternalEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = externalEditing ?? internalEditing;
  const setIsEditing = useCallback(
    (val: boolean) => {
      if (onEditingChange) onEditingChange(val);
      else setInternalEditing(val);
    },
    [onEditingChange],
  );

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, value]);

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setIsEditing(false);
  }, [draft, value, onSave, setIsEditing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDraft(value);
        setIsEditing(false);
      }
    },
    [handleSave, value, setIsEditing],
  );

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className={`${className || "project-workspace__title"} project-workspace__title--editing`}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        aria-label="Project name"
      />
    );
  }

  return (
    <h1
      className={`${className || "project-workspace__title"} project-workspace__title--editable`}
      onClick={() => setIsEditing(true)}
    >
      {value}
    </h1>
  );
}
