import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Todo } from "../../types";
import { IconClose } from "./Icons";

interface Props {
  todos: Todo[];
  excludeId: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function TaskPicker({
  todos,
  excludeId,
  selectedIds,
  onChange,
  placeholder = "Search tasks to link…",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const candidates = useMemo(
    () =>
      todos.filter(
        (t) => t.id !== excludeId && !selectedIds.includes(t.id) && !t.completed,
      ),
    [todos, excludeId, selectedIds],
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return candidates
      .filter((t) => t.title.toLowerCase().includes(q))
      .sort((a, b) => {
        // Prefix match first
        const aPrefix = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bPrefix = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        return aPrefix - bPrefix;
      })
      .slice(0, 8);
  }, [candidates, query]);

  const selectedTasks = useMemo(
    () => selectedIds.map((id) => todos.find((t) => t.id === id)).filter(Boolean) as Todo[],
    [selectedIds, todos],
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [results.length]);

  const select = useCallback(
    (id: string) => {
      onChange([...selectedIds, id]);
      setQuery("");
      setOpen(false);
      inputRef.current?.focus();
    },
    [selectedIds, onChange],
  );

  const remove = useCallback(
    (id: string) => {
      onChange(selectedIds.filter((sid) => sid !== id));
    },
    [selectedIds, onChange],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[activeIdx]) {
        e.preventDefault();
        select(results[activeIdx].id);
      } else if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      } else if (e.key === "Backspace" && !query && selectedIds.length > 0) {
        remove(selectedIds[selectedIds.length - 1]);
      }
    },
    [results, activeIdx, select, remove, query, selectedIds],
  );

  return (
    <div className="task-picker">
      {/* Selected chips */}
      {selectedTasks.length > 0 && (
        <div className="task-picker__chips">
          {selectedTasks.map((t) => (
            <span key={t.id} className="task-picker__chip">
              <span className="task-picker__chip-text">{t.title}</span>
              <button
                className="task-picker__chip-remove"
                onClick={() => remove(t.id)}
                aria-label={`Remove ${t.title}`}
              >
                <IconClose size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="task-picker__input-wrapper">
        <input
          ref={inputRef}
          className="task-picker__search"
          type="text"
          placeholder={selectedIds.length > 0 ? "Add another…" : placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <div className="task-picker__dropdown">
          {results.map((t, i) => (
            <button
              key={t.id}
              className={`task-picker__option${i === activeIdx ? " task-picker__option--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                select(t.id);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span className="task-picker__option-title">{t.title}</span>
              {t.category && (
                <span className="task-picker__option-meta">{t.category}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
