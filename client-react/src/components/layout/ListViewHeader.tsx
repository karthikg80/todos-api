import type { Todo, User, CreateTodoDto } from "../../types";
import { IconMoon, IconSun, IconMenu } from "../shared/Icons";
import { Breadcrumb } from "../shared/Breadcrumb";
import { AnimatedCount } from "../shared/AnimatedCount";
import { Tooltip } from "../shared/Tooltip";
import { FilterPanel, type ActiveFilters } from "../todos/FilterPanel";
import type { SortField, SortOrder, ViewMode } from "../../types/viewTypes";
import type { Density } from "../../hooks/useDensity";
import type { GroupBy } from "../../utils/groupTodos";
import { BulkToolbar } from "../todos/BulkToolbar";
import { QuickEntry } from "../todos/QuickEntry";
import { SearchBar } from "../shared/SearchBar";
import { SegmentedControl } from "../shared/SegmentedControl";
import { VerificationBanner } from "../shared/VerificationBanner";
import { ViewMenu } from "./ViewMenu";
import { ViewSubtitle } from "./ViewSubtitle";

type UiMode = "normal" | "simple";
type HorizonSegment = "due" | "planned" | "pending" | "later";

const HORIZON_SEGMENT_OPTIONS = [
  { key: "due", label: "Due" },
  { key: "planned", label: "Planned" },
  { key: "pending", label: "Pending" },
  { key: "later", label: "Later" },
] as const satisfies ReadonlyArray<{
  key: HorizonSegment;
  label: string;
}>;

export interface ListViewHeaderProps {
  // Identity
  headerTitle: string;
  activeView: string;
  selectedProjectId: string | null;
  isMobile: boolean;
  horizonSegment?: HorizonSegment;
  onHorizonSegmentChange?: (segment: HorizonSegment) => void;
  horizonSegmentCounts?: Partial<Record<HorizonSegment, number>>;

  // Counts
  visibleTodos: Todo[];
  loadState: string;

  // Filters
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
  activeTagFilter: string;
  onClearTagFilter: () => void;

  // Sort + view mode
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;

  // Actions
  onOpenNav: () => void;
  onNewTask: () => void;
  onToggleDark: () => void;
  onLogout: () => void;

  // Breadcrumb
  onClearProject: () => void;
  viewLabels: Record<string, string>;

  // Bulk
  bulkMode: boolean;
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onBulkComplete: () => void;
  onBulkDelete: () => void;
  onCancelBulk: () => void;

  // Quick entry
  uiMode: UiMode;
  onAddTodo: (dto: CreateTodoDto) => Promise<unknown>;
  onCaptureToDesk: (text: string) => Promise<unknown>;
  quickEntryPlaceholder: string;

  // Search
  searchQuery: string;
  onSearchChange: (q: string) => void;

  // ICS export
  todos: Todo[];
  onExportIcs: (todos: Todo[]) => void;
  onExportMessage: (msg: string) => void;

  // View controls
  groupBy: GroupBy;
  onGroupByChange: (val: GroupBy) => void;
  density: Density;
  onDensityChange: (val: Density) => void;
  groupByOptions?: GroupBy[];

  // Misc
  user: User | null;
  dark: boolean;
}

export function ListViewHeader({
  headerTitle,
  activeView,
  selectedProjectId,
  isMobile,
  horizonSegment,
  onHorizonSegmentChange,
  horizonSegmentCounts,
  visibleTodos,
  loadState,
  filtersOpen,
  onToggleFilters,
  activeFilters,
  onFilterChange,
  activeTagFilter,
  onClearTagFilter,
  viewMode,
  onViewModeChange,
  sortBy,
  sortOrder,
  onSortChange,
  onOpenNav,
  onNewTask,
  onToggleDark,
  onLogout,
  onClearProject,
  viewLabels,
  bulkMode,
  selectedIds,
  onSelectAll,
  onBulkComplete,
  onBulkDelete,
  onCancelBulk,
  uiMode,
  onAddTodo,
  onCaptureToDesk,
  quickEntryPlaceholder,
  searchQuery,
  onSearchChange,
  todos,
  onExportIcs,
  onExportMessage,
  user,
  dark,
  groupBy,
  onGroupByChange,
  density,
  onDensityChange,
  groupByOptions,
}: ListViewHeaderProps) {
  const activeCount = visibleTodos.filter((t) => !t.completed).length;
  const showHorizonSegments =
    activeView === "horizon" &&
    !selectedProjectId &&
    !!horizonSegment &&
    !!onHorizonSegmentChange;

  return (
    <>
      {/* Mobile header */}
      {isMobile && (
        <div className="mobile-header">
          <button
            id="projectsRailMobileOpen"
            className="mobile-header__menu-btn"
            onClick={onOpenNav}
            aria-label="Open navigation"
          >
            <IconMenu />
          </button>
          <span className="app-header__title">{headerTitle}</span>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: "var(--s-2)",
            }}
          >
            <button
              className="btn"
              data-new-task-trigger="true"
              onClick={onNewTask}
              style={{ fontSize: "var(--fs-label)" }}
            >
              + New
            </button>
            <button
              className="btn"
              onClick={onToggleDark}
              aria-label="Toggle dark mode"
              style={{ fontSize: "var(--fs-label)" }}
            >
              {dark ? <IconSun /> : <IconMoon />}
            </button>
            {user && (
              <button
                className="btn"
                style={{ fontSize: "var(--fs-label)" }}
                onClick={onLogout}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}

      {/* Desktop header */}
      {!isMobile && (
        <header className="app-header">
          <div className="app-header__title-group">
            <div className="app-header__title-row">
              <span id="todosListHeaderTitle" className="app-header__title">
                <Breadcrumb
                  items={[
                    ...(selectedProjectId
                      ? [
                          {
                            label: viewLabels[activeView] ?? "Tasks",
                            onClick: onClearProject,
                          },
                          { label: headerTitle },
                        ]
                      : [{ label: headerTitle }]),
                  ]}
                />
                {!selectedProjectId && headerTitle}
              </span>
              <span id="todosListHeaderCount" className="app-header__count">
                {loadState === "loaded" && (
                  <>
                    <AnimatedCount value={activeCount} /> tasks
                  </>
                )}
              </span>
            </div>
            <ViewSubtitle
              viewMode={viewMode}
              sortBy={sortBy}
              sortOrder={sortOrder}
              groupBy={groupBy}
              density={density}
            />
          </div>
          <ViewMenu
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
            groupBy={groupBy}
            onGroupByChange={onGroupByChange}
            density={density}
            onDensityChange={onDensityChange}
            groupByOptions={groupByOptions}
          />
          <Tooltip content="Filters" shortcut="f">
            <button
              id="moreFiltersToggle"
              className={`btn${filtersOpen ? " btn--active" : ""}`}
              onClick={onToggleFilters}
              style={{ fontSize: "var(--fs-label)" }}
            >
              Filters
              {(activeFilters.dateFilter !== "all" ||
                activeFilters.priority ||
                activeFilters.status) && (
                <span className="filter-badge">●</span>
              )}
            </button>
          </Tooltip>
          <Tooltip content={dark ? "Light mode" : "Dark mode"}>
            <button
              className="btn"
              onClick={onToggleDark}
              aria-label="Toggle dark mode"
              style={{ fontSize: "var(--fs-label)" }}
            >
              {dark ? <IconSun /> : <IconMoon />}
            </button>
          </Tooltip>
          {user && (
            <button
              className="btn"
              style={{ fontSize: "var(--fs-label)" }}
              onClick={onLogout}
            >
              Logout
            </button>
          )}
        </header>
      )}

      {user && !user.isVerified && (
        <VerificationBanner email={user.email} isVerified={!!user.isVerified} />
      )}

      {activeTagFilter && (
        <div className="active-filter-bar">
          Filtered by tag: <strong>#{activeTagFilter}</strong>
          <button
            className="active-filter-bar__clear"
            onClick={onClearTagFilter}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {showHorizonSegments && (
        <SegmentedControl
          value={horizonSegment ?? "due"}
          onChange={(next) => onHorizonSegmentChange(next as HorizonSegment)}
          ariaLabel="Horizon views"
          className="horizon-segment-bar"
          options={HORIZON_SEGMENT_OPTIONS.map(({ key, label }) => ({
            value: key,
            label,
            buttonId: `horizonSegment${label}`,
            badge: horizonSegmentCounts?.[key] ? horizonSegmentCounts[key] : undefined,
          }))}
        />
      )}

      {/* Today view coaching */}
      {activeView === "today" &&
        !selectedProjectId &&
        visibleTodos.length > 0 &&
        (() => {
          const overdue = visibleTodos.filter(
            (t) =>
              t.dueDate &&
              t.dueDate.split("T")[0] < new Date().toISOString().split("T")[0],
          ).length;
          return overdue > 0 ? (
            <div className="today-coaching-banner">
              <span>
                {overdue === 1
                  ? "1 task rolled over."
                  : `${overdue} tasks rolled over.`}{" "}
                Let&apos;s make the day smaller.
              </span>
            </div>
          ) : null;
        })()}

      {/* Filter panel */}
      {filtersOpen && (
        <FilterPanel
          filters={activeFilters}
          onChange={onFilterChange}
          onClose={onToggleFilters}
        />
      )}

      {/* Bulk actions toolbar */}
      {bulkMode && (
        <BulkToolbar
          selectedCount={selectedIds.size}
          totalCount={visibleTodos.length}
          allSelected={
            selectedIds.size === visibleTodos.length && visibleTodos.length > 0
          }
          onSelectAll={onSelectAll}
          onComplete={onBulkComplete}
          onDelete={onBulkDelete}
          onCancel={onCancelBulk}
        />
      )}

      {uiMode === "normal" && (
        <QuickEntry
          projectId={selectedProjectId}
          workspaceView={activeView}
          onAddTask={onAddTodo}
          onCaptureToDesk={onCaptureToDesk}
          placeholder={quickEntryPlaceholder}
        />
      )}

      {/* Mobile search */}
      {isMobile && (
        <div style={{ padding: "var(--s-2) var(--s-4)" }}>
          <SearchBar
            inputId="searchInputMobile"
            value={searchQuery}
            onChange={onSearchChange}
            shortcutHint="/"
          />
        </div>
      )}
    </>
  );
}
