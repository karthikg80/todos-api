import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
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
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  externalOpen,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen ?? internalOpen;
  const setIsOpen = useCallback(
    (val: boolean | ((prev: boolean) => boolean)) => {
      const next = typeof val === "function" ? val(isOpen) : val;
      if (onOpenChange) onOpenChange(next);
      else setInternalOpen(next);
    },
    [isOpen, onOpenChange],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [focusedSection, setFocusedSection] = useState(0);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, [setIsOpen]);

  // Reset focused section when opening; compute fixed panel position
  useEffect(() => {
    if (isOpen) {
      setFocusedSection(0);
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPanelPos({
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
        });
      }
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isOpen, closeMenu]);

  const handleArrowNav = useCallback(
    (section: number, dir: number) => {
      const visibleGroups = groupByOptions?.length
        ? GROUP_OPTIONS.filter((o) => groupByOptions.includes(o.value))
        : GROUP_OPTIONS;

      if (section === 0) {
        onViewModeChange(viewMode === "list" ? "board" : "list");
      } else if (section === 1) {
        const options = visibleGroups.map((o) => o.value);
        const idx = options.indexOf(groupBy);
        onGroupByChange(options[(idx + dir + options.length) % options.length]);
      } else if (section === 2) {
        const options = SORT_OPTIONS.map((o) => o.value);
        const idx = options.indexOf(sortBy);
        onSortChange(options[(idx + dir + options.length) % options.length], sortOrder);
      } else if (section === 3) {
        const densities: Density[] = ["compact", "normal", "spacious"];
        const idx = densities.indexOf(density);
        onDensityChange(densities[(idx + dir + densities.length) % densities.length]);
      }
    },
    [viewMode, groupBy, sortBy, sortOrder, density, groupByOptions,
     onViewModeChange, onGroupByChange, onSortChange, onDensityChange],
  );

  // Keyboard navigation when open
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedSection((s) => Math.min(s + 1, 3));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedSection((s) => Math.max(s - 1, 0));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        handleArrowNav(focusedSection, dir);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, focusedSection, handleArrowNav, closeMenu]);

  const visibleGroupOptions = groupByOptions?.length
    ? GROUP_OPTIONS.filter((o) => groupByOptions.includes(o.value))
    : GROUP_OPTIONS;

  const isBoardMode = viewMode === "board";

  return (
    <div className="view-menu" ref={panelRef}>
      <Tooltip content="View options" shortcut="v">
        <button
          ref={triggerRef}
          className={`btn${isOpen ? " btn--active" : ""}`}
          onClick={() => setIsOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label="View options"
          style={{ fontSize: "var(--fs-label)" }}
        >
          View ▾
        </button>
      </Tooltip>

      {isOpen && panelPos && (
        <div
          className="view-menu__panel"
          role="menu"
          style={{ position: "fixed", top: panelPos.top, right: panelPos.right } as CSSProperties}
        >
          {/* Layout */}
          <div className={`view-menu__section${focusedSection === 0 ? " view-menu__section--focused" : ""}`}>
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
            className={`view-menu__section${isBoardMode ? " view-menu__section--disabled" : ""}${focusedSection === 1 ? " view-menu__section--focused" : ""}`}
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
            className={`view-menu__section${isBoardMode ? " view-menu__section--disabled" : ""}${focusedSection === 2 ? " view-menu__section--focused" : ""}`}
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
          <div className={`view-menu__section view-menu__section--last${focusedSection === 3 ? " view-menu__section--focused" : ""}`}>
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
