import { useState, useEffect, useRef } from "react";
import type { Todo, Project, Heading } from "../../types";
import type { FieldDef, FieldOption } from "../../types/fieldLayout";

interface Props {
  fieldDef: FieldDef;
  todo: Todo;
  projects?: Project[];
  headings?: Heading[];
  onSave: (field: string, value: unknown) => void;
  compact?: boolean;
}

/**
 * Renders a single editable field for a Todo.
 * Dispatches to specialized sub-renderers based on fieldDef.variant.
 */
export function FieldRenderer({
  fieldDef,
  todo,
  projects,
  headings,
  onSave,
  compact,
}: Props) {
  const { key, variant } = fieldDef;
  const rawValue = getFieldValue(todo, key);
  const isCompact = compact || fieldDef.compact;

  // ── Chips variant ────────────────────────────────────────
  if (variant === "chips") {
    return (
      <ChipSelector
        fieldDef={fieldDef}
        value={String(rawValue ?? "")}
        compact={isCompact}
        onSave={(v) => onSave(key, coerceValue(key, v))}
      />
    );
  }

  // ── Date shortcuts variant ───────────────────────────────
  if (variant === "date-shortcuts") {
    const dateStr =
      typeof rawValue === "string" && rawValue ? rawValue.split("T")[0] : "";
    return (
      <DateShortcuts
        fieldDef={fieldDef}
        value={dateStr}
        compact={isCompact}
        onSave={(v) => onSave(key, v || null)}
      />
    );
  }

  // ── Collapsible textarea variant ─────────────────────────
  if (variant === "collapsible") {
    return (
      <CollapsibleTextarea
        fieldDef={fieldDef}
        initialValue={rawValue}
        compact={isCompact}
        onSave={(v) => onSave(key, v || null)}
      />
    );
  }

  // ── Estimate presets variant ─────────────────────────────
  if (variant === "presets") {
    return (
      <EstimatePresets
        fieldDef={fieldDef}
        initialValue={rawValue}
        compact={isCompact}
        onSave={(v) => onSave(key, v)}
      />
    );
  }

  // ── Native select ────────────────────────────────────────
  if (fieldDef.type === "select") {
    const resolvedOptions = resolveSelectOptions(key, fieldDef.options, projects, headings);
    return (
      <div className={fieldCls(isCompact)}>
        <FieldLabel label={fieldDef.label} hint={!rawValue ? fieldDef.hint : undefined} />
        <select
          id={`field-${key}`}
          className="todo-drawer__select"
          value={String(rawValue ?? "")}
          onChange={(e) => onSave(key, coerceValue(key, e.target.value))}
        >
          {resolvedOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  // ── Native date ──────────────────────────────────────────
  if (fieldDef.type === "date") {
    const dateStr =
      typeof rawValue === "string" && rawValue ? rawValue.split("T")[0] : "";
    return (
      <div className={fieldCls(isCompact)}>
        <FieldLabel label={fieldDef.label} />
        <input
          id={`field-${key}`}
          className="todo-drawer__input"
          type="date"
          value={dateStr}
          onChange={(e) => onSave(key, e.target.value || null)}
        />
      </div>
    );
  }

  // ── Native number ────────────────────────────────────────
  if (fieldDef.type === "number") {
    return (
      <NumberField
        fieldKey={key}
        label={fieldDef.label}
        hint={fieldDef.hint}
        initialValue={rawValue}
        compact={isCompact}
        onSave={onSave}
      />
    );
  }

  // ── Native textarea ──────────────────────────────────────
  if (fieldDef.type === "textarea") {
    return (
      <TextField
        fieldKey={key}
        label={fieldDef.label}
        hint={fieldDef.hint}
        initialValue={rawValue}
        multiline
        fullWidth={fieldDef.fullWidth}
        compact={isCompact}
        onSave={onSave}
        placeholder={getPlaceholder(key)}
      />
    );
  }

  // ── Native text (default) ────────────────────────────────
  return (
    <TextField
      fieldKey={key}
      label={fieldDef.label}
      hint={fieldDef.hint}
      initialValue={rawValue}
      compact={isCompact}
      onSave={onSave}
      placeholder={getPlaceholder(key)}
    />
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* Sub-renderer: ChipSelector                                      */
/* ════════════════════════════════════════════════════════════════ */

function ChipSelector({
  fieldDef,
  value,
  compact,
  onSave,
}: {
  fieldDef: FieldDef;
  value: string;
  compact?: boolean;
  onSave: (value: string) => void;
}) {
  const options = (fieldDef.options ?? []).filter(
    (o) => !o.hiddenUnlessCurrent || o.value === value,
  );

  return (
    <div className={fieldCls(compact, fieldDef.fullWidth)}>
      <FieldLabel
        label={fieldDef.label}
        hint={!value ? fieldDef.hint : undefined}
      />
      <div
        className="field-chips"
        role="radiogroup"
        aria-label={fieldDef.label}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={`field-chip field-chip--${o.tone ?? "muted"}${o.value === value ? " field-chip--active" : ""}`}
            onClick={() => onSave(o.value)}
          >
            {o.icon && <span className="field-chip__icon">{o.icon}</span>}
            <span className="field-chip__label">
              {compact ? (o.shortLabel ?? o.label) : o.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* Sub-renderer: DateShortcuts                                     */
/* ════════════════════════════════════════════════════════════════ */

function DateShortcuts({
  fieldDef,
  value,
  compact,
  onSave,
}: {
  fieldDef: FieldDef;
  value: string;
  compact?: boolean;
  onSave: (value: string) => void;
}) {
  const relative = value ? formatRelativeDate(value) : null;

  return (
    <div className={fieldCls(compact, fieldDef.fullWidth)}>
      <div className="field-date-header">
        <FieldLabel label={fieldDef.label} />
        {relative && (
          <span className={`field-date-relative${relative.overdue ? " field-date-relative--overdue" : ""}`}>
            {relative.label}
          </span>
        )}
      </div>
      <input
        id={`field-${fieldDef.key}`}
        className="todo-drawer__input"
        type="date"
        value={value}
        onChange={(e) => onSave(e.target.value)}
      />
      <div className="field-date-shortcuts">
        {getDateShortcuts(fieldDef.key).map((s) => (
          <button
            key={s.label}
            type="button"
            className="field-date-shortcut"
            onClick={() => onSave(s.value())}
          >
            {s.label}
          </button>
        ))}
        {value && (
          <button
            type="button"
            className="field-date-shortcut field-date-shortcut--clear"
            onClick={() => onSave("")}
            aria-label="Clear date"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* Sub-renderer: CollapsibleTextarea                               */
/* ════════════════════════════════════════════════════════════════ */

function CollapsibleTextarea({
  fieldDef,
  initialValue,
  compact,
  onSave,
}: {
  fieldDef: FieldDef;
  initialValue: unknown;
  compact?: boolean;
  onSave: (value: string) => void;
}) {
  const str = String(initialValue ?? "");
  const [expanded, setExpanded] = useState(!!str);
  const [value, setValue] = useState(str);
  const prevRef = useRef(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue !== prevRef.current) {
      const next = String(initialValue ?? "");
      setValue(next);
      setExpanded(!!next);
      prevRef.current = initialValue;
    }
  }, [initialValue]);

  useEffect(() => {
    if (expanded && !str) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [expanded, str]);

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed !== str.trim()) {
      onSave(trimmed);
    }
    if (!trimmed) setExpanded(false);
  };

  if (!expanded) {
    return (
      <div className={fieldCls(compact, fieldDef.fullWidth)}>
        <button
          type="button"
          className="field-collapsible-prompt"
          onClick={() => setExpanded(true)}
        >
          {fieldDef.emptyPrompt ?? `Add ${fieldDef.label.toLowerCase()}...`}
        </button>
        {fieldDef.hint && (
          <span className="field-hint">{fieldDef.hint}</span>
        )}
      </div>
    );
  }

  return (
    <div className={fieldCls(compact, fieldDef.fullWidth)}>
      <FieldLabel label={fieldDef.label} />
      <textarea
        ref={textareaRef}
        id={`field-${fieldDef.key}`}
        className="todo-drawer__textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* Sub-renderer: EstimatePresets                                   */
/* ════════════════════════════════════════════════════════════════ */

function EstimatePresets({
  fieldDef,
  initialValue,
  compact,
  onSave,
}: {
  fieldDef: FieldDef;
  initialValue: unknown;
  compact?: boolean;
  onSave: (value: number | null) => void;
}) {
  const currentNum = initialValue != null ? Number(initialValue) : null;
  const presets = fieldDef.presets ?? [];
  const isPreset = presets.some((p) => p.value === currentNum);
  const [customMode, setCustomMode] = useState(!isPreset && currentNum != null);
  const [customValue, setCustomValue] = useState(
    !isPreset && currentNum != null ? String(currentNum) : "",
  );

  return (
    <div className={fieldCls(compact, fieldDef.fullWidth)}>
      <FieldLabel
        label={fieldDef.label}
        hint={currentNum == null ? fieldDef.hint : undefined}
      />
      <div className="field-presets">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`field-preset${currentNum === p.value ? " field-preset--active" : ""}`}
            onClick={() => {
              setCustomMode(false);
              onSave(currentNum === p.value ? null : p.value);
            }}
          >
            {p.label}
          </button>
        ))}
        {customMode ? (
          <input
            className="field-preset-custom"
            type="number"
            min="1"
            placeholder="min"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onBlur={() => {
              const num = customValue ? Number(customValue) : null;
              if (num !== currentNum) onSave(num);
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="field-preset field-preset--custom"
            onClick={() => setCustomMode(true)}
          >
            ···
          </button>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* Shared: FieldLabel with optional hint                           */
/* ════════════════════════════════════════════════════════════════ */

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="field-label-group">
      <label className="todo-drawer__label">{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* Retained: blur-save text + number fields                        */
/* ════════════════════════════════════════════════════════════════ */

function TextField({
  fieldKey,
  label,
  hint,
  initialValue,
  multiline,
  fullWidth,
  compact,
  placeholder,
  onSave,
}: {
  fieldKey: string;
  label: string;
  hint?: string;
  initialValue: unknown;
  multiline?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  placeholder?: string;
  onSave: (field: string, value: unknown) => void;
}) {
  const [value, setValue] = useState(String(initialValue ?? ""));
  const prevRef = useRef(initialValue);

  useEffect(() => {
    if (initialValue !== prevRef.current) {
      setValue(String(initialValue ?? ""));
      prevRef.current = initialValue;
    }
  }, [initialValue]);

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed !== String(initialValue ?? "").trim()) {
      onSave(fieldKey, trimmed || null);
    }
  };

  const cls = `todo-drawer__field${compact ? " todo-drawer__field--half" : ""}${fullWidth ? " todo-drawer__field--full" : ""}`;
  const Tag = multiline ? "textarea" : "input";

  return (
    <div className={cls}>
      <FieldLabel label={label} hint={!value ? hint : undefined} />
      <Tag
        id={`field-${fieldKey}`}
        className={multiline ? "todo-drawer__textarea" : "todo-drawer__input"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        {...(!multiline ? { type: "text" } : {})}
      />
    </div>
  );
}

function NumberField({
  fieldKey,
  label,
  hint,
  initialValue,
  compact,
  onSave,
}: {
  fieldKey: string;
  label: string;
  hint?: string;
  initialValue: unknown;
  compact?: boolean;
  onSave: (field: string, value: unknown) => void;
}) {
  const [value, setValue] = useState(
    initialValue != null ? String(initialValue) : "",
  );
  const prevRef = useRef(initialValue);

  useEffect(() => {
    if (initialValue !== prevRef.current) {
      setValue(initialValue != null ? String(initialValue) : "");
      prevRef.current = initialValue;
    }
  }, [initialValue]);

  const handleBlur = () => {
    const num = value ? Number(value) : null;
    const orig = initialValue != null ? Number(initialValue) : null;
    if (num !== orig) {
      onSave(fieldKey, num);
    }
  };

  return (
    <div className={fieldCls(compact)}>
      <FieldLabel label={label} hint={!value ? hint : undefined} />
      <input
        id={`field-${fieldKey}`}
        className="todo-drawer__input"
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════ */
/* Helpers                                                         */
/* ════════════════════════════════════════════════════════════════ */

function fieldCls(compact?: boolean, fullWidth?: boolean): string {
  return `todo-drawer__field${compact ? " todo-drawer__field--half" : ""}${fullWidth ? " todo-drawer__field--full" : ""}`;
}

function getFieldValue(todo: Todo, key: string): unknown {
  if (key === "recurrenceType") return todo.recurrence?.type ?? "none";
  if (key === "recurrenceInterval") return todo.recurrence?.interval ?? 1;
  if (key === "archived") return String(todo.archived);
  if (key === "effortScore") return todo.effortScore != null ? String(todo.effortScore) : "";
  return (todo as unknown as Record<string, unknown>)[key];
}

function coerceValue(key: string, v: string): unknown {
  if (key === "effortScore") return v ? Number(v) : null;
  if (key === "archived") return v === "true";
  return v || null;
}

function resolveSelectOptions(
  key: string,
  staticOptions: FieldOption[] | undefined,
  projects?: Project[],
  headings?: Heading[],
): FieldOption[] {
  if (key === "projectId") {
    return [
      { value: "", label: "None" },
      ...(projects ?? [])
        .filter((p) => !p.archived)
        .map((p) => ({ value: p.id, label: p.name })),
    ];
  }
  if (key === "headingId") {
    return [
      { value: "", label: "None" },
      ...(headings ?? []).map((h) => ({ value: h.id, label: h.name })),
    ];
  }
  return staticOptions ?? [];
}

function getPlaceholder(key: string): string | undefined {
  switch (key) {
    case "context":
      return "Where? @home, @office, @errands...";
    case "waitingOn":
      return "Person or thing blocking this";
    case "firstStep":
      return "The smallest next action...";
    case "category":
      return "e.g. admin, creative, planning...";
    default:
      return undefined;
  }
}

/* ─── Date helpers ─────────────────────────────────────────────── */

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getDateShortcuts(
  key: string,
): Array<{ label: string; value: () => string }> {
  if (key === "reviewDate") {
    return [
      { label: "+1w", value: () => addDays(7) },
      { label: "+2w", value: () => addDays(14) },
      { label: "+1m", value: () => addDays(30) },
      { label: "+3m", value: () => addDays(90) },
    ];
  }
  return [
    { label: "Today", value: () => addDays(0) },
    { label: "Tomorrow", value: () => addDays(1) },
    { label: "+1w", value: () => addDays(7) },
    { label: "+1m", value: () => addDays(30) },
  ];
}

function formatRelativeDate(dateStr: string): { label: string; overdue: boolean } | null {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < -1) return { label: `${-diff}d overdue`, overdue: true };
  if (diff === -1) return { label: "yesterday", overdue: true };
  if (diff === 0) return { label: "today", overdue: false };
  if (diff === 1) return { label: "tomorrow", overdue: false };
  if (diff <= 7) return { label: `in ${diff}d`, overdue: false };
  if (diff <= 30) return { label: `in ${Math.round(diff / 7)}w`, overdue: false };
  return { label: `in ${Math.round(diff / 30)}mo`, overdue: false };
}
