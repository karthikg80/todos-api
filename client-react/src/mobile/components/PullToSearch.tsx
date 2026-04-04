import { useState, useRef, useCallback, useEffect } from "react";
import type { Todo } from "../../types";

interface Props {
  todos: Todo[];
  onSelectResult: (id: string) => void;
}

export function PullToSearch({ todos, onSelectResult }: Props) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const pullStartY = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const scrollTop = document.scrollingElement?.scrollTop ?? 0;
    if (scrollTop <= 0) pullStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (pullStartY.current === 0) return;
    const delta = e.changedTouches[0].clientY - pullStartY.current;
    if (delta > 80) { setActive(true); setTimeout(() => inputRef.current?.focus(), 100); }
    pullStartY.current = 0;
  }, []);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  const results = query.trim()
    ? todos.filter((t) =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 10)
    : [];

  const handleClose = () => { setActive(false); setQuery(""); };

  if (!active) return null;

  return (
    <div className="m-search">
      <div className="m-search__header">
        <input ref={inputRef} className="m-search__input" type="search"
          placeholder="Search tasks, tags..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="m-search__cancel" onClick={handleClose}>Cancel</button>
      </div>
      {results.length > 0 && (
        <ul className="m-search__results">
          {results.map((t) => (
            <li key={t.id}>
              <button className="m-search__result" onClick={() => { onSelectResult(t.id); handleClose(); }}>
                <span className={`m-search__result-check${t.completed ? " m-search__result-check--done" : ""}`}>
                  {t.completed ? "☑" : "☐"}
                </span>
                <span className="m-search__result-title">{t.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.length === 0 && (
        <div className="m-search__empty">No results for &ldquo;{query}&rdquo;</div>
      )}
    </div>
  );
}
