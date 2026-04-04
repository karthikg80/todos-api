import { useState, useRef, useCallback, useEffect } from "react";
import type { Todo, Project } from "../../types";

interface Props {
  todos: Todo[];
  projects: Project[];
  onSelectResult: (id: string) => void;
}

export function PullToSearch({ todos, projects, onSelectResult }: Props) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const projectMap = useRef(new Map<string, Project>());
  useEffect(() => {
    const m = new Map<string, Project>();
    projects.forEach((p) => m.set(p.id, p));
    projectMap.current = m;
  }, [projects]);

  const results = debouncedQuery.trim()
    ? todos.filter((t) => {
        const q = debouncedQuery.toLowerCase();
        const projectName = t.projectId ? (projectMap.current.get(t.projectId)?.name ?? "") : "";
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q)) ||
          projectName.toLowerCase().includes(q)
        );
      }).slice(0, 10)
    : [];

  const handleClose = () => { setActive(false); setQuery(""); setDebouncedQuery(""); };

  if (!active) return null;

  return (
    <div className="m-search">
      <div className="m-search__header">
        <input ref={inputRef} className="m-search__input" type="search"
          placeholder="Search tasks, tags, projects..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="m-search__cancel" onClick={handleClose}>Cancel</button>
      </div>
      {results.length > 0 && (
        <ul className="m-search__results">
          {results.map((t) => {
            const project = t.projectId ? projectMap.current.get(t.projectId) : undefined;
            return (
              <li key={t.id}>
                <button className="m-search__result" onClick={() => { onSelectResult(t.id); handleClose(); }}>
                  <span className={`m-search__result-check${t.completed ? " m-search__result-check--done" : ""}`}>
                    {t.completed ? "☑" : "☐"}
                  </span>
                  <span className="m-search__result-title">{t.title}</span>
                  {project && <span className="m-search__result-project">{project.name}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {debouncedQuery.trim() && results.length === 0 && (
        <div className="m-search__empty">No results for &ldquo;{debouncedQuery}&rdquo;</div>
      )}
    </div>
  );
}
