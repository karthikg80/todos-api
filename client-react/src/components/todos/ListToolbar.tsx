import type { Density } from "../../hooks/useDensity";
import { SortControl, type SortField, type SortOrder } from "./SortControl";
import type { GroupBy } from "../../utils/groupTodos";

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "none", label: "None" },
  { value: "project", label: "Project" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "dueDate", label: "Due Date" },
];

const DENSITY_OPTIONS: { value: Density; label: string; icon: string }[] = [
  { value: "compact", label: "Compact density", icon: "▤" },
  { value: "normal", label: "Normal density", icon: "☰" },
  { value: "spacious", label: "Spacious density", icon: "▦" },
];

interface Props {
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  groupBy: GroupBy;
  onGroupByChange: (val: GroupBy) => void;
  density: Density;
  onDensityChange: (val: Density) => void;
}

export function ListToolbar({ sortBy, sortOrder, onSortChange, groupBy, onGroupByChange, density, onDensityChange }: Props) {

  return (
    <div className="list-toolbar">
      <div className="list-toolbar__group">
        <div className="list-toolbar__control">
          <select
            className="sort-control__select"
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
            aria-label="Group by"
          >
            {GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Group: {o.label}
              </option>
            ))}
          </select>
        </div>
        <SortControl sortBy={sortBy} sortOrder={sortOrder} onChange={onSortChange} />
      </div>
      <div className="list-toolbar__density">
        {DENSITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`list-toolbar__density-btn${density === opt.value ? " list-toolbar__density-btn--active" : ""}`}
            onClick={() => onDensityChange(opt.value)}
            aria-label={opt.label}
            aria-pressed={density === opt.value}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
