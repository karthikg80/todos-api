# Home Dashboard: Trust, Steerability, and Rescue Mode Polish

**Target:** `client-react/` (Vite + React 19 app). No changes to `client/` (vanilla JS).

## Problem Summary

1. **Trust gaps** — "Needs attention" counts unsorted/inbox tasks instead of overdue+stale; project counts can diverge; duplicates in focus list.
2. **Opaque recommendations** — Focus items and brief card say "strongest next action" without explaining *why*.
3. **Rescue mode is too simple** — shows a paragraph, not actionable triage items.

---

## Phase 1: Data Consistency (trust fix)

### 1a. Fix "Needs attention" to mean overdue + stale

**File:** `client-react/src/components/layout/HomeDashboard.tsx` — `needsAttention` memo (line ~100)

Currently counts inbox + uncategorized tasks. Should count the union of overdue + stale (deduplicated).

```tsx
// Before (line ~100):
const needsAttention = useMemo(() =>
  active.filter(t => t.status === "inbox" || (!t.projectId && !t.category)).length,
  [active]
);

// After:
const needsAttention = useMemo(() => {
  const ids = new Set<string>();
  for (const t of active) {
    if (t.dueDate && daysUntil(t.dueDate) < 0) ids.add(t.id);
    if (isStale(t)) ids.add(t.id);
  }
  return ids.size;
}, [active]);
```

### 1b. Deduplicate AI focus suggestions by todoId

**File:** `client-react/src/components/ai/HomeFocusSuggestions.tsx`

The `suggestions` array from the backend may contain duplicate `todoId`s. Deduplicate after fetch:

```tsx
// In the .then() after fetchFocusSuggestions:
const seen = new Set<string>();
const deduped = result.suggestions.filter(s => {
  if (seen.has(s.todoId)) return false;
  seen.add(s.todoId);
  return true;
});
setSuggestions(deduped);
```

### 1c. Ensure completed tasks never appear as overdue

**File:** `client-react/src/components/layout/HomeDashboard.tsx` — `dueSoonGroups` memo

`active` already filters `!t.completed`, so due-soon groups are safe. But verify `projectsToNudge` also uses `active` (it does — line ~124). No code change needed, just verify.

---

## Phase 2: Explainable Recommendations

### 2a. Create `buildReasonParts(todo)` utility

**New file:** `client-react/src/utils/focusReason.ts`

Returns an array of short reason fragments for any task:

```ts
export function buildReasonParts(todo: Todo): string[] {
  const parts: string[] = [];

  // Due status
  if (todo.dueDate) {
    const d = daysUntil(todo.dueDate);
    if (d < 0) parts.push(`overdue ${Math.abs(d)}d`);
    else if (d === 0) parts.push("due today");
    else if (d === 1) parts.push("due tomorrow");
    else if (d <= 5) parts.push(`due in ${d}d`);
  }

  // Time estimate
  if (todo.estimateMinutes) parts.push(`${todo.estimateMinutes}m`);

  // Priority (only high/urgent worth calling out)
  if (todo.priority === "urgent") parts.push("urgent");
  else if (todo.priority === "high") parts.push("high priority");

  // Staleness
  const stale = staleDays(todo);
  if (stale > 14) parts.push(`untouched ${stale}d`);

  // Project name
  const project = todo.category || todo.projectId;
  if (project) parts.push(leafName(project));

  return parts;
}

export function formatReason(todo: Todo, aiSummary?: string): string {
  const facts = buildReasonParts(todo);
  if (aiSummary) {
    // Combine AI rationale with non-redundant facts
    const factsStr = facts.slice(0, 2).join(" · ");
    return factsStr ? `${aiSummary} · ${factsStr}` : aiSummary;
  }
  return facts.join(" · ") || "";
}
```

### 2b. Show reason on HomeTaskRow

**File:** `client-react/src/components/layout/HomeDashboard.tsx` — `HomeTaskRow` component (line ~387)

Add an optional `reason` prop to `HomeTaskRow`. Render it below the title:

```tsx
{reason && (
  <span className="home-task-row__reason">{reason}</span>
)}
```

Wire it in the brief card's focus action and in the due-soon groups.

### 2c. Show reason on AI focus suggestions

**File:** `client-react/src/components/ai/HomeFocusSuggestions.tsx`

The `summary` field already renders. Enhance it by appending deterministic facts:

```tsx
<span className="home-ai-suggestion__reason">
  {formatReason(matchedTodo, s.summary)}
</span>
```

This requires passing the `todos` array into the component (already done — it receives `todos` prop) and looking up the todo by `s.todoId`.

### 2d. Show reason in brief card "strongest next action"

**File:** `client-react/src/components/layout/HomeDashboard.tsx` — brief card section (line ~177)

Add a `<span>` below the focus task title with `formatReason(focusTask)`.

---

## Phase 3: Steerable Controls

### 3a. "Why this?" collapsible on focus items

**File:** `client-react/src/components/layout/HomeDashboard.tsx` — `HomeTaskRow`

Add a `<details>` element when the row is in a focus context:

```tsx
{whyDetail && (
  <details className="home-task-row__why">
    <summary>Why this?</summary>
    <div className="home-task-row__why-detail">{whyDetail}</div>
  </details>
)}
```

The `whyDetail` prop provides a longer explanation: due date, priority, days stale, project, estimate, AI rationale. Built from `buildReasonParts()` formatted as a multi-line list.

### 3b. "Less like this" on AI suggestions

**File:** `client-react/src/components/ai/HomeFocusSuggestions.tsx`

Add a "Less like this" button per suggestion that calls dismiss with a signal:

```tsx
<button onClick={() => handleDismissOne(s.suggestionId, "less_like_this")}>
  Less like this
</button>
```

**File:** `client-react/src/api/ai.ts` — add `dismissFocusSuggestionWithSignal`:

```ts
export async function dismissFocusSuggestionWithSignal(
  aiSuggestionId: string,
  suggestionId: string,
  signal: string,
): Promise<void> {
  await apiCall(`/ai/suggestions/${aiSuggestionId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ suggestionId, signal }),
  });
}
```

### 3c. "Exclude from focus" per task (localStorage-backed)

**New file:** `client-react/src/utils/focusExclusions.ts`

```ts
const STORAGE_KEY = "home_focus_exclusions";

export function isExcludedFromFocus(todoId: string): boolean { ... }
export function excludeFromFocus(todoId: string): void { ... }
export function includeInFocus(todoId: string): void { ... }
```

Filter excluded IDs in `HomeFocusSuggestions` before rendering, and in the brief card's `focusTask` selection.

---

## Phase 4: Rescue Mode Restructure

### 4a. Build rescue triage model

**New file:** `client-react/src/utils/rescueTriage.ts`

```ts
interface RescueItem {
  role: "must-do" | "easy-win" | "follow-up";
  roleLabel: string;
  todo: Todo;
  reason: string;
}

export function buildRescueTriage(active: Todo[]): RescueItem[] {
  const items: RescueItem[] = [];

  // 1. Must-do: highest-priority overdue/due-today, shortest estimate
  const mustDo = active
    .filter(t => t.dueDate && daysUntil(t.dueDate) <= 0)
    .sort((a, b) => {
      const pOrd = { urgent: 0, high: 1, medium: 2, low: 3 };
      const pDiff = (pOrd[a.priority || "medium"] ?? 2) - (pOrd[b.priority || "medium"] ?? 2);
      if (pDiff !== 0) return pDiff;
      return (a.estimateMinutes || 30) - (b.estimateMinutes || 30);
    })[0];
  if (mustDo) items.push({ role: "must-do", roleLabel: "Must-do", todo: mustDo, reason: formatReason(mustDo) });

  // 2. Easy win: quickest non-overdue, non-waiting task
  const easyWin = active
    .filter(t => t.id !== mustDo?.id && t.status !== "waiting" && (!t.dueDate || daysUntil(t.dueDate) >= 0))
    .filter(t => !t.subtasks?.length && (t.title?.length || 0) < 40)
    .sort((a, b) => (a.estimateMinutes || 15) - (b.estimateMinutes || 15))[0];
  if (easyWin) items.push({ role: "easy-win", roleLabel: "Easy win", todo: easyWin, reason: formatReason(easyWin) });

  // 3. Follow-up: oldest waiting task
  const followUp = active
    .filter(t => t.status === "waiting" && t.id !== mustDo?.id && t.id !== easyWin?.id)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())[0];
  if (followUp) {
    const waitDays = Math.floor((Date.now() - new Date(followUp.updatedAt).getTime()) / 86400000);
    items.push({ role: "follow-up", roleLabel: "Follow up", todo: followUp, reason: `waiting ${waitDays}d` });
  }

  return items;
}
```

### 4b. Render rescue triage in HomeDashboard

**File:** `client-react/src/components/layout/HomeDashboard.tsx` — rescue panel section (line ~198)

Replace the paragraph-style rescue panel with a `<RescueTriagePanel>` component:

```tsx
{showRescue && (
  <RescueTriagePanel
    active={active}
    onTodoClick={onTodoClick}
    onToggleTodo={onToggleTodo}
    onEditTodo={onEditTodo}
  />
)}
```

**New component (inline or extracted):** `RescueTriagePanel` renders:
- Header: "Rescue mode" eyebrow + "3 items to keep today workable."
- Three cards, each with:
  - Role label (must-do / easy win / follow up) with colored left border
  - Task title (clickable)
  - Reason line
  - Quick actions: [Open] + role-specific action (Move later / Done / Nudge)

### 4c. Activate/deactivate rescue mode

Currently `showRescue` is purely derived (`active.length > 10 && overdueCount > 3`). Add a `rescueActive` state that the user can toggle, with auto-suggestion when conditions are met:

```tsx
const [rescueActive, setRescueActive] = useState(false);
const suggestRescue = active.length > 10 && overdueCount > 3;

// Show rescue panel when user activates OR when conditions suggest it
const showRescue = rescueActive || suggestRescue;
```

Add "Start rescue mode" / "Back to normal" buttons.

---

## Phase 5: Styles

**File:** `client-react/src/index.css` (or wherever the React app's styles live)

New classes:
- `.home-task-row__reason` — muted, smaller text below task title
- `.home-task-row__why` — collapsible `<details>` styling
- `.home-task-row__why-toggle` — inline link-style summary
- `.rescue-triage` — vertical card stack
- `.rescue-triage__card` — card with left colored border (amber for must-do, green for easy-win, blue for follow-up)
- `.rescue-triage__role` — uppercase small label
- `.rescue-triage__reason` — muted reason text

---

## New Files Summary

| File | Purpose |
|------|---------|
| `client-react/src/utils/focusReason.ts` | `buildReasonParts()`, `formatReason()` |
| `client-react/src/utils/rescueTriage.ts` | `buildRescueTriage()` model builder |
| `client-react/src/utils/focusExclusions.ts` | localStorage-backed focus exclusion list |

## Modified Files Summary

| File | Changes |
|------|---------|
| `client-react/src/components/layout/HomeDashboard.tsx` | Fix needsAttention, add reasons to HomeTaskRow, add RescueTriagePanel, add why-this details |
| `client-react/src/components/ai/HomeFocusSuggestions.tsx` | Deduplicate, show combined reasons, add "less like this" |
| `client-react/src/api/ai.ts` | Add `dismissFocusSuggestionWithSignal()` |

---

## Verification

```bash
cd client-react && npx tsc --noEmit && npm run build
```

Plus root-level checks that still apply:
```bash
npm run test:unit
```

---

## Out of Scope (noted for future)

- **Natural-language quick add** — NLP parsing for "Call electrician tomorrow 15m Home Repairs"
- **"Minimum viable day" mode** — planning constraint that caps task count
- **Time-budgeted planning blocks** — calendar integration
- **Life-area separation** (work/family/admin) — group focus items by soul profile areas
