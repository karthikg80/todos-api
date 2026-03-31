import { useState } from "react";
import type { Priority, TodoStatus } from "../../types";

export type DateFilter =
  | "all"
  | "today"
  | "upcoming"
  | "next-month"
  | "later"
  | "pending"
  | "planned";

export interface ActiveFilters {
  dateFilter: DateFilter;
  priority: Priority | "";
  status: TodoStatus | "";
}

const DATE_TABS: { key: DateFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "next-month", label: "Next month" },
  { key: "later", label: "Later" },
  { key: "pending", label: "Pending" },
  { key: "planned", label: "Planned" },
];

const PRIORITY_OPTIONS: (Priority | "")[] = [
  "",
  "low",
  "medium",
  "high",
  "urgent",
];

const STATUS_OPTIONS: (TodoStatus | "")[] = [
  "",
  "inbox",
  "next",
  "in_progress",
  "waiting",
  "scheduled",
  "someday",
];

interface Props {
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  onClose: () => void;
}

export function FilterPanel({ filters, onChange, onClose }: Props) {
  const [local, setLocal] = useState(filters);

  const update = (patch: Partial<ActiveFilters>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  };

  const hasFilters =
    local.dateFilter !== "all" || local.priority !== "" || local.status !== "";

  return (
    <div className="filter-panel" id="moreFiltersPanel">
      <div className="filter-panel__header">
        <span className="filter-panel__title">Filters</span>
        {hasFilters && (
          <button
            className="clear-filters-btn"
            onClick={() => {
              const cleared: ActiveFilters = {
                dateFilter: "all",
                priority: "",
                status: "",
              };
              setLocal(cleared);
              onChange(cleared);
            }}
          >
            Clear all
          </button>
        )}
        <button className="filter-panel__close" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Date tabs */}
      <div className="filter-panel__date-tabs">
        {DATE_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`filter-panel__tab${local.dateFilter === tab.key ? " filter-panel__tab--active" : ""}`}
            onClick={() => update({ dateFilter: tab.key })}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Priority + Status selects */}
      <div className="filter-panel__row">
        <div className="filter-panel__field">
          <label className="filter-panel__label">Priority</label>
          <select
            className="todo-drawer__select"
            value={local.priority}
            onChange={(e) =>
              update({ priority: e.target.value as Priority | "" })
            }
          >
            <option value="">Any</option>
            {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-panel__field">
          <label className="filter-panel__label">Status</label>
          <select
            className="todo-drawer__select"
            value={local.status}
            onChange={(e) =>
              update({ status: e.target.value as TodoStatus | "" })
            }
          >
            <option value="">Any</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {(s as string).replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/** Apply ActiveFilters to a todo list (client-side) */
export function applyFilters<
  T extends {
    completed: boolean;
    dueDate?: string | null;
    priority?: string | null;
    status: string;
    scheduledDate?: string | null;
  },
>(todos: T[], filters: ActiveFilters): T[] {
  let result = todos;
  const today = new Date().toISOString().split("T")[0];

  // Date filter
  switch (filters.dateFilter) {
    case "today":
      result = result.filter(
        (t) => !t.completed && t.dueDate && t.dueDate.split("T")[0] <= today,
      );
      break;
    case "upcoming": {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const nw = nextWeek.toISOString().split("T")[0];
      result = result.filter(
        (t) =>
          !t.completed &&
          t.dueDate &&
          t.dueDate.split("T")[0] > today &&
          t.dueDate.split("T")[0] <= nw,
      );
      break;
    }
    case "next-month": {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      const nm = nextMonth.toISOString().split("T")[0];
      result = result.filter(
        (t) =>
          !t.completed &&
          t.dueDate &&
          t.dueDate.split("T")[0] > today &&
          t.dueDate.split("T")[0] <= nm,
      );
      break;
    }
    case "later":
      result = result.filter((t) => {
        if (t.completed) return false;
        if (!t.dueDate) return true;
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return t.dueDate.split("T")[0] > d.toISOString().split("T")[0];
      });
      break;
    case "pending":
      result = result.filter(
        (t) => !t.completed && (t.status === "waiting" || t.status === "scheduled"),
      );
      break;
    case "planned":
      result = result.filter(
        (t) => !t.completed && t.scheduledDate,
      );
      break;
  }

  // Priority filter
  if (filters.priority) {
    result = result.filter((t) => t.priority === filters.priority);
  }

  // Status filter
  if (filters.status) {
    result = result.filter((t) => t.status === filters.status);
  }

  return result;
}
