import type { SortField, SortOrder, ViewMode } from "../../types/viewTypes";
import type { Density } from "../../hooks/useDensity";
import type { GroupBy } from "../../utils/groupTodos";

interface Props {
  viewMode: ViewMode;
  sortBy: SortField;
  sortOrder: SortOrder;
  groupBy: GroupBy;
  density: Density;
}

const SORT_LABELS: Record<SortField, string> = {
  order: "Default sort",
  createdAt: "Created",
  dueDate: "Due date",
  priority: "Priority",
  title: "Title",
};

const GROUP_LABELS: Record<GroupBy, string> = {
  none: "No grouping",
  project: "Project",
  status: "Status",
  priority: "Priority",
  dueDate: "Due date",
};

export function ViewSubtitle({
  viewMode,
  sortBy,
  sortOrder,
  groupBy,
  density,
}: Props) {
  const parts: string[] = [viewMode === "list" ? "List" : "Board"];

  if (sortBy === "order") {
    parts.push("Default sort");
  } else {
    parts.push(`${SORT_LABELS[sortBy]} ${sortOrder === "asc" ? "↑" : "↓"}`);
  }

  parts.push(GROUP_LABELS[groupBy]);

  if (density !== "normal") {
    parts.push(density === "compact" ? "Compact" : "Spacious");
  }

  return <span className="view-subtitle">{parts.join(" · ")}</span>;
}
