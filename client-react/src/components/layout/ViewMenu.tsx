import { useState, useRef, useEffect, useCallback } from "react";
import type { SortField, SortOrder, ViewMode } from "../../types/viewTypes";
import type { Density } from "../../hooks/useDensity";
import type { GroupBy } from "../../utils/groupTodos";
import { Tooltip } from "../shared/Tooltip";

interface Props {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  groupBy: GroupBy;
  onGroupByChange: (val: GroupBy) => void;
  density: Density;
  onDensityChange: (val: Density) => void;
  groupByOptions?: GroupBy[];
}

const SORT_OPTIONS: { value: SortField; label: string; ariaLabel?: string }[] =
  [
    { value: "order", label: "Default" },
    { value: "createdAt", label: "Created" },
    { value: "dueDate", label: "Due date" },
    { value: "priority", label: "Priority", ariaLabel: "Sort by priority" },
    { value: "title", label: "Title" },
  ];

const GROUP_OPTIONS: { value: GroupBy; label: string; ariaLabel?: string }[] = [
  { value: "none", label: "None" },
  { value: "project", label: "Project" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "dueDate", label: "Due date", ariaLabel: "Group by due date" },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "normal", label: "Normal" },
  { value: "spacious", label: "Spacious" },
];

export function ViewMenu({
  viewMode,
  onViewModeChange,
  sortBy,
  sortOrder,
  onSortChange,
  groupBy,
  onGroupByChange,
  density,
  onDensityChange,
  groupByOptions,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on click outside
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

  // Close on Escape
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

  const visibleGroupOptions = groupByOptions?.length
    ? GROUP_OPTIONS.filter((o) => groupByOptions.includes(o.value))
    : GROUP_OPTIONS;

  const isBoardMode = viewMode === "board";

  return (
    <div className="view-menu" ref={panelRef}>
      <Tooltip content="View options" shortcut="v">
        <button
          ref={triggerRef}
          className={`btn${open ? " btn--active" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="View options"
          style={{ fontSize: "var(--fs-label)" }}
        >
          View ▾
        </button>
      </Tooltip>

      {open && (
        <div className="view-menu__panel" role="menu">
          {/* Layout */}
          <div className="view-menu__section">
            <div className="view-menu__label">Layout</div>
            <div className="view-menu__segmented">
              {(["list", "board"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`view-menu__seg-btn${viewMode === mode ? " view-menu__seg-btn--active" : ""}`}
                  onClick={() => onViewModeChange(mode)}
                  aria-pressed={viewMode === mode}
                  aria-label={mode === "list" ? "List" : "Board"}
                >
                  {mode === "list" ? "☰ List" : "▦ Board"}
                </button>
              ))}
            </div>
          </div>

          {/* Group by — disabled in board mode */}
          <div
            className={`view-menu__section${isBoardMode ? " view-menu__section--disabled" : ""}`}
          >
            <div className="view-menu__label">Group by</div>
            <div className="view-menu__pills">
              {visibleGroupOptions.map((o) => (
                <button
                  key={o.value}
                  className={`view-menu__pill${groupBy === o.value ? " view-menu__pill--active" : ""}`}
                  onClick={() => onGroupByChange(o.value)}
                  aria-pressed={groupBy === o.value}
                  aria-label={o.ariaLabel ?? o.label}
                  disabled={isBoardMode}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort by — disabled in board mode */}
          <div
            className={`view-menu__section${isBoardMode ? " view-menu__section--disabled" : ""}`}
          >
            <div className="view-menu__label">Sort by</div>
            <div className="view-menu__pills">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  className={`view-menu__pill${sortBy === o.value ? " view-menu__pill--active" : ""}`}
                  onClick={() => onSortChange(o.value, sortOrder)}
                  aria-pressed={sortBy === o.value}
                  aria-label={o.ariaLabel ?? o.label}
                  disabled={isBoardMode}
                >
                  {o.label}
                </button>
              ))}
              <button
                className="view-menu__dir-btn"
                onClick={() =>
                  onSortChange(sortBy, sortOrder === "asc" ? "desc" : "asc")
                }
                aria-label={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
                disabled={isBoardMode}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>

          {/* Density */}
          <div className="view-menu__section view-menu__section--last">
            <div className="view-menu__label">Density</div>
            <div className="view-menu__segmented">
              {DENSITY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  className={`view-menu__seg-btn${density === o.value ? " view-menu__seg-btn--active" : ""}`}
                  onClick={() => onDensityChange(o.value)}
                  aria-pressed={density === o.value}
                  aria-label={o.label}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
