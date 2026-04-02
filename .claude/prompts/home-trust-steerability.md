# Home Dashboard: Trust, Steerability, and Rescue Mode — Implementation Prompt

You are working in `client-react/` (Vite + React 19). Do NOT touch `client/` (vanilla JS, frozen).

The backend is shared (Express + Prisma + PostgreSQL in `src/`). Types are in `client-react/src/types/index.ts`. API helpers are in `client-react/src/api/`. Styles are in `client-react/src/styles/app.css`.

## Environment

- Node 22 via nvm: commands must use `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && <command>'`
- Typecheck: `cd client-react && npx tsc --noEmit`
- Build: `cd client-react && npm run build`

## Execution order

Trust fixes first, shared reason utility second, AI suggestion controls third, rescue mode last.

---

## Phase 1: Fix "Needs attention" count (trust fix)

**File:** `client-react/src/components/layout/HomeDashboard.tsx`

The `needsAttention` memo (around line 100) currently counts inbox + uncategorized tasks:

```tsx
const needsAttention = useMemo(() =>
  active.filter(t => t.status === "inbox" || (!t.projectId && !t.category)).length,
  [active]
);
```

This is wrong. Users see overdue items and stale items elsewhere on the dashboard but "Needs attention" shows 0. Fix it to count the deduplicated union of overdue + stale:

```tsx
const needsAttention = useMemo(() => {
  const ids = new Set<string>();
  for (const t of active) {
    if (t.dueDate && daysUntil(t.dueDate) < 0) ids.add(t.id);
    if (isStale(t)) ids.add(t.id);
  }
  return ids.size;
}, [active]);
```

The `daysUntil()` and `isStale()` helpers already exist in the same file.

Also deduplicate AI focus suggestions by `todoId` in `HomeFocusSuggestions.tsx` — the backend can return duplicates:

```tsx
// After fetchFocusSuggestions resolves, before setSuggestions:
const seen = new Set<string>();
const deduped = result.suggestions.filter(s => {
  if (seen.has(s.todoId)) return false;
  seen.add(s.todoId);
  return true;
});
setSuggestions(deduped);
```

---

## Phase 2: Explainable recommendations (shared reason utility)

### 2a. Create `client-react/src/utils/focusReason.ts`

This utility builds short reason fragments for any task. It needs a project-name resolver because `todo.projectId` is a raw ID, NOT a user-facing name. Never leak IDs into UI.

```ts
import type { Todo, Project } from "../types";

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date(new Date().toDateString());
  return Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function staleDays(todo: Todo): number {
  return Math.floor(
    (Date.now() - new Date(todo.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
}

interface ReasonOptions {
  /** Resolve projectId to display name. Omit project from reason if not provided. */
  projectName?: string | null;
}

export function buildReasonParts(todo: Todo, opts: ReasonOptions = {}): string[] {
  const parts: string[] = [];

  if (todo.dueDate) {
    const d = daysUntil(todo.dueDate);
    if (d < -1) parts.push(`overdue ${Math.abs(d)}d`);
    else if (d === -1) parts.push("overdue 1d");
    else if (d === 0) parts.push("due today");
    else if (d === 1) parts.push("due tomorrow");
    else if (d <= 5) parts.push(`due in ${d}d`);
  }

  if (todo.estimateMinutes) parts.push(`${todo.estimateMinutes}m`);

  if (todo.priority === "urgent") parts.push("urgent");
  else if (todo.priority === "high") parts.push("high priority");

  const stale = staleDays(todo);
  if (stale > 14) parts.push(`untouched ${stale}d`);

  if (opts.projectName) parts.push(opts.projectName);

  return parts;
}

export function formatReason(todo: Todo, opts: ReasonOptions & { aiSummary?: string } = {}): string {
  const facts = buildReasonParts(todo, opts);
  if (opts.aiSummary) {
    const factsStr = facts.slice(0, 2).join(" · ");
    return factsStr ? `${opts.aiSummary} · ${factsStr}` : opts.aiSummary;
  }
  return facts.join(" · ") || "";
}
```

Key design decision: `projectName` is passed in explicitly by the caller (who has access to the projects list), NOT derived from `todo.projectId` or `todo.category` inside the utility. This avoids leaking raw IDs and keeps the formatter pure.

### 2b. Wire reasons into HomeDashboard.tsx

Add a `reason` prop to `HomeTaskRow`:

```tsx
function HomeTaskRow({
  todo, onClick, onToggle, onAction, meta, reason, showActions = false,
}: {
  // ... existing props ...
  reason?: string;
}) {
  return (
    <div className="home-task-row" data-home-todo-id={todo.id}>
      {/* ... existing checkbox + title + badge ... */}
      {reason && <span className="home-task-row__reason">{reason}</span>}
      {/* ... existing actions + meta ... */}
    </div>
  );
}
```

Build a project lookup helper at the top of `HomeDashboard`:

```tsx
const projectById = useMemo(() => {
  const map = new Map<string, string>();
  for (const p of projects) map.set(p.id, p.name);
  return map;
}, [projects]);

const getProjectName = (todo: Todo) =>
  (todo.projectId ? projectById.get(todo.projectId) : null) ?? todo.category ?? null;
```

Then pass reasons when rendering:
- Brief card focus task: `formatReason(focusTask, { projectName: getProjectName(focusTask) })`
- Due soon group items: `formatReason(todo, { projectName: getProjectName(todo) })`
- Stale items already show `${staleDays(todo)}d untouched` as `meta` — enhance with `formatReason`

### 2c. Wire reasons into HomeFocusSuggestions.tsx

The component already receives `todos` prop. Add `projects` prop too so it can resolve names. Show combined AI + deterministic reason:

```tsx
const matchedTodo = todos.find(t => t.id === s.todoId);
const projectName = matchedTodo?.projectId ? projectById.get(matchedTodo.projectId) : null;
const reason = matchedTodo
  ? formatReason(matchedTodo, { aiSummary: s.summary, projectName })
  : s.summary;
```

Render `reason` instead of just `s.summary`.

### 2d. Brief card "strongest next action" — add reason line

Below the focus task title in the brief card, add:

```tsx
<span className="home-brief-card__action-reason">
  {formatReason(focusTask, { projectName: getProjectName(focusTask) })}
</span>
```

---

## Phase 3: Steerable controls

### 3a. "Why this?" expandable on focus items

Add an optional `whyDetail` prop to `HomeTaskRow`. When present, render a collapsible:

```tsx
{whyDetail && (
  <details className="home-task-row__why">
    <summary className="home-task-row__why-toggle">Why this?</summary>
    <div className="home-task-row__why-detail">{whyDetail}</div>
  </details>
)}
```

The `whyDetail` is a longer version of the reason: all fragments from `buildReasonParts()` formatted as a bullet list, plus the AI summary if available.

**CSS note:** The current `.home-task-row` is a compact single-line grid. When `reason` or `whyDetail` is present, the row needs to switch to a stacked layout. Add a modifier class like `home-task-row--has-reason` and use it to go `flex-direction: column` with the reason below the title line.

### 3b. "Less like this" on AI suggestions

**File:** `client-react/src/components/ai/HomeFocusSuggestions.tsx`

Add per-suggestion dismiss with signal:

```tsx
<button
  className="home-action-chip"
  onClick={() => handleDismissOne(s.suggestionId, "less_like_this")}
  disabled={!!actioningId}
>
  Less like this
</button>
```

**File:** `client-react/src/api/ai.ts`

Add a new function AND fix consistency — the existing `applyFocusSuggestion` and `dismissFocusSuggestion` silently ignore errors (no `res.ok` check). Fix all three:

```ts
export async function applyFocusSuggestion(aiSuggestionId: string): Promise<void> {
  const res = await apiCall(`/ai/suggestions/${aiSuggestionId}/apply`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Failed to apply focus suggestion");
}

export async function dismissFocusSuggestion(aiSuggestionId: string): Promise<void> {
  const res = await apiCall(`/ai/suggestions/${aiSuggestionId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error("Failed to dismiss focus suggestion");
}

export async function dismissFocusSuggestionWithSignal(
  aiSuggestionId: string,
  suggestionId: string,
  signal: string,
): Promise<void> {
  const res = await apiCall(`/ai/suggestions/${aiSuggestionId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ suggestionId, signal }),
  });
  if (!res.ok) throw new Error("Failed to dismiss focus suggestion");
}
```

### 3c. "Exclude from focus" (localStorage-backed)

**New file:** `client-react/src/utils/focusExclusions.ts`

```ts
const STORAGE_KEY = "home_focus_exclusions";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function writeSet(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function isExcludedFromFocus(todoId: string): boolean {
  return readSet().has(todoId);
}

export function excludeFromFocus(todoId: string): void {
  const ids = readSet();
  ids.add(todoId);
  writeSet(ids);
}

export function includeInFocus(todoId: string): void {
  const ids = readSet();
  ids.delete(todoId);
  writeSet(ids);
}
```

**Scope:** Exclusion means "exclude from focus recommendations" (brief card focus task + AI suggestions). It does NOT hide tasks from due-soon, backlog hygiene, or rescue triage. Be explicit about this — if a task appears in due-soon but was excluded from focus, that is correct behavior.

Filter excluded IDs in:
- Brief card `focusTask` selection
- `HomeFocusSuggestions` before rendering

Do NOT filter excluded IDs from due-soon groups, stale items, projects-to-nudge, or rescue triage.

---

## Phase 4: Rescue mode restructure

### 4a. Create `client-react/src/utils/rescueTriage.ts`

```ts
import type { Todo } from "../types";
import { formatReason } from "./focusReason";

export interface RescueItem {
  role: "must-do" | "easy-win" | "follow-up";
  roleLabel: string;
  todo: Todo;
  reason: string;
}

export function buildRescueTriage(
  active: Todo[],
  opts: { projectName: (todo: Todo) => string | null } = { projectName: () => null },
): RescueItem[] { ... }
```

Selection logic:
1. **Must-do**: highest-priority overdue or due-today task, prefer shortest estimate. Sort by priority (urgent>high>medium>low) then estimateMinutes ascending.
2. **Easy win**: quickest non-overdue, non-waiting task without subtasks and title < 40 chars. Exclude the must-do pick.
3. **Follow-up**: oldest waiting task by `updatedAt`. Exclude the other two picks.

**Important nuance on follow-up:** `updatedAt` is a proxy for waiting age, not a true "waiting since" timestamp. Label it "unchanged Xd" not "waiting Xd" to be honest about what we're measuring.

Each item gets a reason via `formatReason(todo, { projectName: opts.projectName(todo) })`.

### 4b. Render rescue triage in HomeDashboard.tsx

Replace the current rescue panel (around line 198) which is just a banner paragraph.

**Activation semantics — three states, not two:**

```tsx
const [rescueDismissed, setRescueDismissed] = useState(false);
const [rescueManuallyActive, setRescueManuallyActive] = useState(false);
const suggestRescue = active.length > 10 && overdueCount > 3;

// Show rescue when: manually activated OR (system suggests AND user hasn't dismissed)
const showRescue = rescueManuallyActive || (suggestRescue && !rescueDismissed);
```

This way "Back to normal" actually works — it sets `rescueManuallyActive = false` and `rescueDismissed = true`. The panel won't reappear until conditions change (task count drops and rises again, resetting `rescueDismissed`).

When rescue is active, render three cards:

```
┌─────────────────────────────┐
│ ⚡ Must-do                   │
│ "Call electrician"           │
│ overdue 2d · 15m · Home     │
│ [Open] [Move later]         │
├─────────────────────────────┤
│ ✓ Easy win                   │
│ "Reply to Sarah's email"    │
│ 5m · Work                   │
│ [Open] [Done]               │
├─────────────────────────────┤
│ ⏳ Follow up                 │
│ "Waiting on plumber quote"  │
│ unchanged 8d                │
│ [Open] [Nudge]              │
└─────────────────────────────┘
```

Header: "Rescue mode" eyebrow + "3 items to keep today workable." (not the verbose advisory text).

### 4c. Styles for rescue triage

Add to `client-react/src/styles/app.css` (NOT index.css — the app imports app.css):

```css
.rescue-triage { display: flex; flex-direction: column; gap: var(--space-2); }
.rescue-triage__card {
  border-left: 3px solid var(--border);
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--surface);
}
.rescue-triage__card--must-do { border-left-color: var(--warning, #e5a100); }
.rescue-triage__card--easy-win { border-left-color: var(--success, #22c55e); }
.rescue-triage__card--follow-up { border-left-color: var(--accent, #3b82f6); }
.rescue-triage__role {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: var(--space-1);
}
```

Also add styles for the reason and why-this elements:

```css
.home-task-row__reason {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 2px;
}
.home-task-row--has-reason {
  flex-direction: column;
  align-items: flex-start;
}
.home-task-row__why { margin-top: 4px; }
.home-task-row__why-toggle {
  font-size: 0.75rem;
  color: var(--text-muted);
  cursor: pointer;
}
.home-task-row__why-detail {
  font-size: 0.8rem;
  color: var(--text-muted);
  padding: var(--space-1) 0;
  line-height: 1.5;
}
```

Check the actual CSS variable names used in `app.css` and `tokens.css` — the above are approximations. Use whatever naming the existing codebase uses.

---

## New files

| File | Purpose |
|------|---------|
| `client-react/src/utils/focusReason.ts` | `buildReasonParts()`, `formatReason()` — pure, project-name passed in |
| `client-react/src/utils/rescueTriage.ts` | `buildRescueTriage()` — returns 3 curated items |
| `client-react/src/utils/focusExclusions.ts` | localStorage-backed focus exclusion list |

## Modified files

| File | Changes |
|------|---------|
| `client-react/src/components/layout/HomeDashboard.tsx` | Fix needsAttention, add reasons to HomeTaskRow, add RescueTriagePanel, add why-this, wire project lookup |
| `client-react/src/components/ai/HomeFocusSuggestions.tsx` | Deduplicate by todoId, show combined reasons, add "less like this", accept projects prop |
| `client-react/src/api/ai.ts` | Add `dismissFocusSuggestionWithSignal()`, fix error handling on existing focus functions |
| `client-react/src/styles/app.css` | Styles for reason, why-this, rescue triage cards |

## Verification

After each phase: `cd client-react && npx tsc --noEmit && npm run build`

## Constraints

- Do NOT modify files in `client/` — frozen
- Do NOT modify backend files in `src/` — shared API is stable
- Do NOT add new npm dependencies
- Use existing CSS variable names from `tokens.css` and `app.css`
- Follow existing patterns: functional components, hooks, TypeScript strict
- Keep components under ~300 lines — extract sub-components when needed
