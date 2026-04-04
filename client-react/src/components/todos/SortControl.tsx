import type { SortField, SortOrder } from "../../types/viewTypes";
export type { SortField, SortOrder } from "../../types/viewTypes";

interface Props {
  sortBy: SortField;
  sortOrder: SortOrder;
  onChange: (field: SortField, order: SortOrder) => void;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "order", label: "Default" },
  { value: "createdAt", label: "Created" },
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Title" },
];

export function SortControl({ sortBy, sortOrder, onChange }: Props) {
  return (
    <div className="sort-control">
      <select
        className="sort-control__select"
        value={sortBy}
        onChange={(e) => onChange(e.target.value as SortField, sortOrder)}
        aria-label="Sort by"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        className="sort-control__dir"
        onClick={() => onChange(sortBy, sortOrder === "asc" ? "desc" : "asc")}
        aria-label={`Sort ${sortOrder === "asc" ? "descending" : "ascending"}`}
      >
        {sortOrder === "asc" ? "↑" : "↓"}
      </button>
    </div>
  );
}
