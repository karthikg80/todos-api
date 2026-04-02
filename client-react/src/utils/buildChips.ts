import type { Todo } from "../types";
import type { Density } from "../hooks/useDensity";

export interface ChipData {
  key: string;
  label: string;
  variant: "overdue" | "blocked" | "waiting" | "priority-high" | "priority-med" | "project" | "date" | "subtask" | "tag" | "overflow";
}

export function buildChips(todo: Todo, density: Density): ChipData[] {
  if (density === "compact") return [];

  const candidates: ChipData[] = [];

  // 1. Overdue due date
  const isOverdue = !todo.completed && !!todo.dueDate && new Date(todo.dueDate) < new Date(new Date().toDateString());
  if (isOverdue) {
    const d = new Date(todo.dueDate!);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    candidates.push({ key: "overdue", label: `${days}d overdue`, variant: "overdue" });
  }

  // 2. Blocked
  if (!todo.completed && todo.dependsOnTaskIds.length > 0) {
    const n = todo.dependsOnTaskIds.length;
    candidates.push({ key: "blocked", label: `Blocked by ${n}`, variant: "blocked" });
  }

  // 3. Waiting-on
  if (todo.waitingOn) {
    candidates.push({ key: "waiting", label: `@${todo.waitingOn}`, variant: "waiting" });
  }

  // 4. Priority (only urgent/high/medium)
  if (todo.priority === "urgent" || todo.priority === "high") {
    candidates.push({ key: "priority", label: todo.priority, variant: "priority-high" });
  } else if (todo.priority === "medium") {
    candidates.push({ key: "priority", label: "medium", variant: "priority-med" });
  }

  // 5. Due date (non-overdue)
  if (todo.dueDate && !isOverdue) {
    const d = new Date(todo.dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let label: string;
    if (diff === 0) label = "Today";
    else if (diff === 1) label = "Tomorrow";
    else label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    candidates.push({ key: "due", label, variant: "date" });
  }

  // 6. Subtask count (normal mode only)
  if (density === "normal" && todo.subtasks && todo.subtasks.length > 0) {
    const done = todo.subtasks.filter((s) => s.completed).length;
    candidates.push({ key: "subtask", label: `${done}/${todo.subtasks.length}`, variant: "subtask" });
  }

  // 7. Category/project
  if (todo.category) {
    candidates.push({ key: "project", label: todo.category, variant: "project" });
  }

  // 8. Tags (last-fill)
  for (const tag of todo.tags) {
    candidates.push({ key: `tag-${tag}`, label: `#${tag}`, variant: "tag" });
  }

  // Truncation for normal mode
  if (density === "normal" && candidates.length > 4) {
    const shown = candidates.slice(0, 4);
    const overflow = candidates.length - 4;
    shown.push({ key: "overflow", label: `+${overflow}`, variant: "overflow" });
    return shown;
  }

  return candidates;
}
