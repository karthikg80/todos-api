import type { TodoStatus, Priority, RecurrenceType } from "./index";

/* ─── Navigation state machine ─────────────────────────────────── */

export type TaskViewMode = "collapsed" | "quickEdit" | "drawer" | "fullPage";

export type TaskViewState =
  | { mode: "collapsed" }
  | { mode: "quickEdit"; taskId: string }
  | { mode: "drawer"; taskId: string }
  | { mode: "fullPage"; taskId: string };

export type TaskNavAction =
  | { type: "OPEN_QUICK_EDIT"; taskId: string }
  | { type: "OPEN_DRAWER"; taskId: string }
  | { type: "OPEN_FULL_PAGE"; taskId: string }
  | { type: "ESCALATE"; focusedTaskId?: string }
  | { type: "DEESCALATE" }
  | { type: "COLLAPSE" };

/* ─── Field definition registry ────────────────────────────────── */

export type FieldType = "text" | "textarea" | "select" | "date" | "number";

/** How the field should render — defaults to native control for its type */
export type FieldVariant =
  | "native"
  | "chips"
  | "date-shortcuts"
  | "collapsible"
  | "presets";

/** Semantic color token for chip options (theme-safe) */
export type ChipTone =
  | "muted"
  | "info"
  | "warn"
  | "danger"
  | "success"
  | "accent";

export type FieldGroup =
  | "status"
  | "dates"
  | "project"
  | "planning"
  | "advanced";

export interface FieldOption {
  value: string;
  label: string;
  shortLabel?: string;
  icon?: string;
  tone?: ChipTone;
  /** Hide this option unless the current value matches it */
  hiddenUnlessCurrent?: boolean;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  group: FieldGroup;
  defaultTier: 1 | 2 | 3;
  variant?: FieldVariant;
  options?: FieldOption[];
  /** Value explanation — why this field matters (shown when empty) */
  hint?: string;
  /** Action prompt for collapsible fields (e.g. "Add description...") */
  emptyPrompt?: string;
  /** Preset values for "presets" variant */
  presets?: Array<{ label: string; value: number }>;
  compact?: boolean;
  fullWidth?: boolean;
  editable?: boolean;
}

/* ─── Tier capacities ──────────────────────────────────────────── */

export const TIER_CAPS = { quickEdit: 6, drawer: 14 } as const;

/* ─── Field layout preferences (stored in backend) ─────────────── */

export interface TierPins {
  pinned: string[];
  hidden: string[];
}

export interface FieldLayoutPrefs {
  quickEdit: TierPins;
  drawer: TierPins;
}

export interface ResolvedFieldLayout {
  quickEdit: string[];
  drawer: string[];
  meta: {
    hasSufficientHistory: boolean;
    pinnedQuickEdit: string[];
    hiddenQuickEdit: string[];
    pinnedDrawer: string[];
    hiddenDrawer: string[];
  };
}

/* ─── Static registry ──────────────────────────────────────────── */

const STATUS_OPTIONS: FieldOption[] = [
  { value: "inbox", label: "Inbox", shortLabel: "Inbox", icon: "📥", tone: "muted" },
  { value: "next", label: "Next", shortLabel: "Next", icon: "➡", tone: "info" },
  { value: "in_progress", label: "In progress", shortLabel: "Active", icon: "⏳", tone: "accent" },
  { value: "waiting", label: "Waiting", shortLabel: "Wait", icon: "⌛", tone: "warn" },
  { value: "scheduled", label: "Scheduled", shortLabel: "Sched", icon: "📅", tone: "info" },
  { value: "someday", label: "Someday", shortLabel: "Later", icon: "💤", tone: "muted" },
  { value: "done", label: "Done", shortLabel: "Done", icon: "✓", tone: "success", hiddenUnlessCurrent: true },
  { value: "cancelled", label: "Cancelled", shortLabel: "Cancel", icon: "✕", tone: "danger", hiddenUnlessCurrent: true },
];

const PRIORITY_OPTIONS: FieldOption[] = [
  { value: "", label: "None", shortLabel: "—", tone: "muted" },
  { value: "low", label: "Low", shortLabel: "Low", tone: "muted" },
  { value: "medium", label: "Medium", shortLabel: "Med", tone: "info" },
  { value: "high", label: "High", shortLabel: "High", tone: "warn" },
  { value: "urgent", label: "Urgent", shortLabel: "!", tone: "danger" },
];

const ENERGY_OPTIONS: FieldOption[] = [
  { value: "", label: "None", shortLabel: "—", tone: "muted" },
  { value: "low", label: "Low", shortLabel: "―", tone: "muted" },
  { value: "medium", label: "Medium", shortLabel: "――", tone: "info" },
  { value: "high", label: "High", shortLabel: "―――", tone: "accent" },
];

const EFFORT_OPTIONS: FieldOption[] = [
  { value: "", label: "None", shortLabel: "—", tone: "muted" },
  { value: "1", label: "Small", shortLabel: "S", tone: "muted" },
  { value: "2", label: "Medium", shortLabel: "M", tone: "info" },
  { value: "3", label: "Large", shortLabel: "L", tone: "warn" },
];

const EMOTIONAL_STATE_OPTIONS: FieldOption[] = [
  { value: "", label: "None", shortLabel: "—", tone: "muted" },
  { value: "avoiding", label: "Avoiding", shortLabel: "Avoid", icon: "😬", tone: "warn" },
  { value: "unclear", label: "Unclear", shortLabel: "Unclear", icon: "❓", tone: "info" },
  { value: "heavy", label: "Heavy", shortLabel: "Heavy", icon: "😫", tone: "danger" },
  { value: "exciting", label: "Energizing", shortLabel: "Energy", icon: "🎉", tone: "success" },
];

const RECURRENCE_OPTIONS: FieldOption[] = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const ESTIMATE_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
  { label: "4h", value: 240 },
];

export const FIELD_REGISTRY: FieldDef[] = [
  // ── Tier 1 (quick edit) ───────────────────────────────────
  {
    key: "status", label: "Status", type: "select", group: "status", defaultTier: 1,
    variant: "chips", options: STATUS_OPTIONS, compact: true,
  },
  {
    key: "priority", label: "Priority", type: "select", group: "status", defaultTier: 1,
    variant: "chips", options: PRIORITY_OPTIONS, compact: true,
  },
  {
    key: "dueDate", label: "Due date", type: "date", group: "dates", defaultTier: 1,
    variant: "date-shortcuts",
  },
  {
    key: "projectId", label: "Project", type: "select", group: "project", defaultTier: 1,
    hint: "Organize into a project",
  },
  {
    key: "description", label: "Description", type: "textarea", group: "status", defaultTier: 1,
    variant: "collapsible", fullWidth: true,
    emptyPrompt: "Add a description...", hint: "Capture what needs to be done",
  },

  // ── Tier 2 (drawer) ──────────────────────────────────────
  {
    key: "headingId", label: "Section", type: "select", group: "project", defaultTier: 2,
  },
  {
    key: "startDate", label: "Start date", type: "date", group: "dates", defaultTier: 2,
    variant: "date-shortcuts", compact: true,
  },
  {
    key: "scheduledDate", label: "Scheduled", type: "date", group: "dates", defaultTier: 2,
    variant: "date-shortcuts", compact: true,
  },
  {
    key: "reviewDate", label: "Review date", type: "date", group: "dates", defaultTier: 2,
    variant: "date-shortcuts", compact: true,
  },
  {
    key: "energy", label: "Energy", type: "select", group: "planning", defaultTier: 2,
    variant: "chips", options: ENERGY_OPTIONS, compact: true,
    hint: "Match tasks to your energy level",
  },
  {
    key: "context", label: "Context", type: "text", group: "planning", defaultTier: 2,
    hint: "Filter tasks by where you can do them",
  },
  {
    key: "waitingOn", label: "Waiting on", type: "text", group: "planning", defaultTier: 2,
    hint: "Track what's blocking this task",
  },
  {
    key: "firstStep", label: "First step", type: "text", group: "planning", defaultTier: 2,
    hint: "Break resistance \u2014 one tiny action",
  },
  {
    key: "estimateMinutes", label: "Estimate", type: "number", group: "planning", defaultTier: 2,
    variant: "presets", compact: true, presets: ESTIMATE_PRESETS,
    hint: "How long will this take?",
  },
  {
    key: "notes", label: "Notes", type: "textarea", group: "advanced", defaultTier: 2,
    variant: "collapsible", fullWidth: true,
    emptyPrompt: "Add private notes...", hint: "Only you can see these",
  },

  // ── Tier 3 (full page only) ───────────────────────────────
  {
    key: "effortScore", label: "Effort", type: "select", group: "planning", defaultTier: 3,
    variant: "chips", options: EFFORT_OPTIONS, compact: true,
    hint: "How much work is this?",
  },
  {
    key: "emotionalState", label: "Feeling", type: "select", group: "planning", defaultTier: 3,
    variant: "chips", options: EMOTIONAL_STATE_OPTIONS, compact: true,
    hint: "Spot patterns in what you avoid or enjoy",
  },
  {
    key: "recurrenceType", label: "Repeat", type: "select", group: "advanced", defaultTier: 3,
    options: RECURRENCE_OPTIONS, compact: true,
  },
  {
    key: "recurrenceInterval", label: "Every", type: "number", group: "advanced", defaultTier: 3, compact: true,
  },
  {
    key: "category", label: "Category", type: "text", group: "advanced", defaultTier: 3,
  },
  {
    key: "archived", label: "Archived", type: "select", group: "advanced", defaultTier: 3,
    options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }],
  },
];

/* ─── Lookup helpers ───────────────────────────────────────────── */

export const FIELD_REGISTRY_BY_KEY: Record<string, FieldDef> = Object.fromEntries(
  FIELD_REGISTRY.map((f) => [f.key, f]),
);

export function getFieldDef(key: string): FieldDef | undefined {
  return FIELD_REGISTRY_BY_KEY[key];
}

export function getDefaultFieldsForTier(tier: 1 | 2 | 3): string[] {
  return FIELD_REGISTRY.filter((f) => f.defaultTier <= tier).map((f) => f.key);
}
