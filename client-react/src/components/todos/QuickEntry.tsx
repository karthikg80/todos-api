import { useState, useRef } from "react";
import type { CreateTodoDto } from "../../types";

interface Props {
  projectId?: string | null;
  onAdd: (dto: CreateTodoDto) => Promise<unknown>;
}

export function QuickEntry({ projectId, onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onAdd({
        title: trimmed,
        ...(projectId ? { projectId } : {}),
      });
      setTitle("");
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="quick-entry" id="taskComposerSheet" aria-hidden="false">
      <input
        id="todoInput"
        ref={inputRef}
        className="quick-entry__input"
        type="text"
        placeholder="Add a task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />
      <button
        id="taskComposerAddButton"
        className="quick-entry__btn"
        disabled={!title.trim() || submitting}
        onClick={handleSubmit}
      >
        Add
      </button>
    </div>
  );
}
