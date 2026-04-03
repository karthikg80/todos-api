import type { Todo } from "../types";
import type { Density } from "../hooks/useDensity";
import type { GroupBy } from "./groupTodos";

export interface ChipData {
  key: string;
  label: string;
  variant:
    | "overdue"
    | "blocked"
    | "waiting"
    | "priority-high"
    | "energy"
    | "estimate"
    | "project"
    | "date"
    | "subtask"
    | "tag"
    | "overflow"
    | "recurrence";
  family: "status" | "tag" | "meta";
}

const MAX_TAGS = 2;
const COMPACT_VARIANTS = new Set<ChipData["variant"]>([
  "overdue",
  "blocked",
  "waiting",
  "priority-high",
  "date",
  "project",
]);
const COMPACT_MAX_CHIPS = 2;

export function buildChips(
  todo: Todo,
  density: Density,
  groupBy: GroupBy = "none",
): ChipData[] {
  const candidates: ChipData[] = [];

  // 1. Overdue due date (hidden when grouped by dueDate)
  const isOverdue =
    !todo.completed &&
    !!todo.dueDate &&
    new Date(todo.dueDate) < new Date(new Date().toDateString());
  if (isOverdue && groupBy !== "dueDate") {
    const d = new Date(todo.dueDate!);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    candidates.push({
      key: "overdue",
      label: `${days}d overdue`,
      variant: "overdue",
      family: "status",
    });
  }

  // 2. Blocked
  if (!todo.completed && todo.dependsOnTaskIds.length > 0) {
    const n = todo.dependsOnTaskIds.length;
    candidates.push({
      key: "blocked",
      label: `Blocked by ${n}`,
      variant: "blocked",
      family: "status",
    });
  }

  // 3. Waiting-on
  if (todo.waitingOn) {
    candidates.push({
      key: "waiting",
      label: `@${todo.waitingOn}`,
      variant: "waiting",
      family: "status",
    });
  }

  // 4. Priority (urgent/high only — hidden when grouped by priority)
  if (
    (todo.priority === "urgent" || todo.priority === "high") &&
    groupBy !== "priority"
  ) {
    candidates.push({
      key: "priority",
      label: todo.priority,
      variant: "priority-high",
      family: "status",
    });
  }

  // 5. Due date (non-overdue, hidden when grouped by dueDate)
  if (todo.dueDate && !isOverdue && groupBy !== "dueDate") {
    const d = new Date(todo.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.floor(
      (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    let label: string;
    if (diff === 0) label = "Today";
    else if (diff === 1) label = "Tomorrow";
    else
      label = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    candidates.push({ key: "due", label, variant: "date", family: "meta" });
  }

  // 6. Recurrence
  if (todo.recurrence?.type && todo.recurrence.type !== "none") {
    candidates.push({
      key: "recurrence",
      label: "Repeats",
      variant: "recurrence",
      family: "meta",
    });
  }

  // 7. Energy level
  if (todo.energy) {
    const energyLabels: Record<string, string> = {
      high: "⚡ High",
      medium: "◐ Med",
      low: "🧘 Low",
    };
    const label = energyLabels[todo.energy];
    if (label) {
      candidates.push({
        key: "energy",
        label,
        variant: "energy",
        family: "status",
      });
    }
  }

  // 8. Estimate
  if (todo.estimateMinutes) {
    const mins = todo.estimateMinutes;
    const label = mins >= 60 ? `~${Math.round(mins / 60)}h` : `~${mins}m`;
    candidates.push({
      key: "estimate",
      label,
      variant: "estimate",
      family: "meta",
    });
  }

  // 9. Subtask count (normal mode only — spacious has progress bar)
  if (density === "normal" && todo.subtasks && todo.subtasks.length > 0) {
    const done = todo.subtasks.filter((s) => s.completed).length;
    candidates.push({
      key: "subtask",
      label: `${done}/${todo.subtasks.length} subtasks`,
      variant: "subtask",
      family: "meta",
    });
  }

  // 10. Category/project (hidden when already grouped by project)
  if (todo.category && groupBy !== "project") {
    candidates.push({
      key: "project",
      label: todo.category,
      variant: "project",
      family: "meta",
    });
  }

  // 11. Tags (capped to avoid overflow domination)
  const tags = todo.tags.slice(0, MAX_TAGS);
  for (const tag of tags) {
    candidates.push({
      key: `tag-${tag}`,
      label: `#${tag}`,
      variant: "tag",
      family: "tag",
    });
  }
  if (todo.tags.length > MAX_TAGS) {
    candidates.push({
      key: "tag-overflow",
      label: `+${todo.tags.length - MAX_TAGS} tags`,
      variant: "overflow",
      family: "meta",
    });
  }

  if (density === "compact") {
    return candidates
      .filter((chip) => COMPACT_VARIANTS.has(chip.variant))
      .slice(0, COMPACT_MAX_CHIPS);
  }

  // Truncation for normal mode
  if (density === "normal" && candidates.length > 4) {
    const shown = candidates.slice(0, 4);
    const overflow = candidates.length - 4;
    shown.push({
      key: "overflow",
      label: `+${overflow}`,
      variant: "overflow",
      family: "meta",
    });
    return shown;
  }

  return candidates;
}
