import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { WorkspaceView } from "../projects/Sidebar";
import type { Todo } from "../../types";
import { IllustrationNoResults } from "./Illustrations";

interface Command {
  id: string;
  label: string;
  group: string;
  action: () => void;
  keywords?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: WorkspaceView) => void;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  todos?: Todo[];
  onTodoClick?: (id: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onToggleDarkMode,
  onLogout,
  todos = [],
  onTodoClick,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = useMemo(
    () => [
      {
        id: "nav-focus",
        label: "Go to Focus",
        group: "Navigation",
        action: () => onNavigate("home"),
        keywords: "home dashboard",
      },
      {
        id: "nav-desk",
        label: "Go to Desk",
        group: "Navigation",
        action: () => onNavigate("triage"),
        keywords: "triage inbox",
      },
      {
        id: "nav-everything",
        label: "Go to Everything",
        group: "Navigation",
        action: () => onNavigate("all"),
        keywords: "all tasks",
      },
      {
        id: "nav-today",
        label: "Go to Today",
        group: "Navigation",
        action: () => onNavigate("today"),
      },
      {
        id: "nav-upcoming",
        label: "Go to Upcoming",
        group: "Navigation",
        action: () => onNavigate("upcoming"),
      },
      {
        id: "nav-completed",
        label: "Go to Completed",
        group: "Navigation",
        action: () => onNavigate("completed"),
        keywords: "done finished",
      },
      {
        id: "toggle-dark-mode",
        label: "Toggle Dark Mode",
        group: "Actions",
        action: onToggleDarkMode,
        keywords: "theme light night",
      },
      {
        id: "focus-search",
        label: "Focus Search",
        group: "Actions",
        action: () => document.getElementById("searchInput")?.focus(),
        keywords: "find filter",
      },
      {
        id: "new-task",
        label: "New Task",
        group: "Actions",
        action: () => document.getElementById("todoInput")?.focus(),
        keywords: "add create todo",
      },
      {
        id: "logout",
        label: "Logout",
        group: "Account",
        action: onLogout,
        keywords: "sign out",
      },
    ],
    [onNavigate, onToggleDarkMode, onLogout],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();

    // Filter commands
    const matchedCommands = commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords?.toLowerCase().includes(q),
    );

    // Search tasks by title
    const matchedTasks: Command[] = onTodoClick
      ? todos
          .filter((t) => t.title.toLowerCase().includes(q))
          .slice(0, 5)
          .map((t) => ({
            id: `task-${t.id}`,
            label: t.title,
            group: "Tasks",
            action: () => onTodoClick(t.id),
            keywords: t.category || undefined,
          }))
      : [];

    return [...matchedCommands, ...matchedTasks];
  }, [commands, query, todos, onTodoClick]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Clamp active index
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const execute = useCallback(
    (cmd: Command) => {
      onClose();
      // Delay action so palette closes first
      requestAnimationFrame(() => cmd.action());
    },
    [onClose],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIndex]) execute(filtered[activeIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, activeIndex, execute, onClose],
  );

  if (!isOpen) return null;

  // Group commands for display
  const groups = new Map<string, Command[]>();
  for (const cmd of filtered) {
    const list = groups.get(cmd.group) || [];
    list.push(cmd);
    groups.set(cmd.group, list);
  }

  let flatIndex = 0;

  return (
    <div
      id="commandPaletteOverlay"
      className="command-palette-overlay command-palette-overlay--open"
      onClick={onClose}
    >
      <div
        className="command-palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          id="commandPaletteInput"
          ref={inputRef}
          className="command-palette__input"
          type="text"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div id="commandPaletteList" className="command-palette__list" role="listbox">
          {filtered.length === 0 && (
            <div id="commandPaletteEmpty" className="command-palette__empty">
              <IllustrationNoResults />
              <p>No results</p>
            </div>
          )}
          {[...groups.entries()].map(([group, cmds]) => (
            <div key={group}>
              <div className="command-palette__group">{group}</div>
              {cmds.map((cmd) => {
                const idx = flatIndex++;
                return (
                  <div
                    key={cmd.id}
                    id={`commandPaletteOption-${idx}`}
                    className={`command-palette__option${idx === activeIndex ? " command-palette__option--active" : ""}`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    {cmd.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
