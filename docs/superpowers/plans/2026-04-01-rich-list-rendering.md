# Rich List Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the React client's flat Everything view into a grouped, density-aware, visually rich task list.

**Architecture:** Extend the existing `SortableTodoList` → `TodoRow` rendering pipeline with three new utilities (`groupTodos`, `buildChips`, `useGroupBy`), a `ListToolbar` component for view controls, and `GroupHeader` for collapsible sections. Sort/density controls move from `AppShell` into `ListToolbar`. CSS variables from `tokens.css` are used directly (`--danger`, `--warning`, `--surface-3` — no new tokens needed).

**Tech Stack:** React 19, TypeScript, @dnd-kit, Vite, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-01-rich-list-rendering-design.md`

**Important CSS token mapping:** The spec references `--error`, `--bg-tertiary`, `--text-secondary` which do NOT exist in `tokens.css`. Use these instead:
- `--error` → `--danger` (light: `#e05260`, dark: `#ff8a96`)
- `--warning` → `--warning` (exists: `#d97706`)
- `--bg-tertiary` → `--surface-3`
- `--text-secondary` → `--muted`

**No test infrastructure exists** in the React client. Tasks 1 and 7 include setting up vitest before writing tests.

---

### Task 1: Set Up Vitest + Write `groupTodos()` Tests

**Files:**
- Create: `client-react/vitest.config.ts`
- Create: `client-react/src/utils/groupTodos.ts`
- Create: `client-react/src/utils/groupTodos.test.ts`
- Modify: `client-react/package.json` (add vitest dep + script)

- [ ] **Step 1: Install vitest**

Run:
```bash
cd client-react && npm install -D vitest
```

- [ ] **Step 2: Create vitest config**

Create `client-react/vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `client-react/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create `groupTodos.ts` with type stubs**

Create `client-react/src/utils/groupTodos.ts`:
```typescript
import type { Todo, TodoStatus, Priority } from "../types";

export type GroupBy = "none" | "project" | "status" | "priority" | "dueDate";

export interface GroupedSection {
  key: string;
  label: string;
  todos: Todo[];
}

const STATUS_ORDER: TodoStatus[] = [
  "next",
  "in_progress",
  "waiting",
  "scheduled",
  "someday",
  "inbox",
];

const STATUS_LABELS: Record<string, string> = {
  next: "Next",
  in_progress: "In Progress",
  waiting: "Waiting",
  scheduled: "Scheduled",
  someday: "Someday",
  inbox: "Inbox",
};

const PRIORITY_ORDER: (Priority | "none")[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No Priority",
};

type DueDateBucket =
  | "overdue"
  | "today"
  | "this-week"
  | "next-week"
  | "later"
  | "no-date";

const DUE_DATE_ORDER: DueDateBucket[] = [
  "overdue",
  "today",
  "this-week",
  "next-week",
  "later",
  "no-date",
];

const DUE_DATE_LABELS: Record<DueDateBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  "this-week": "This Week",
  "next-week": "Next Week",
  later: "Later",
  "no-date": "No Date",
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday of the current ISO week (Mon=1). */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const monday = startOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function getDueDateBucket(dueDate: string | null | undefined): DueDateBucket {
  if (!dueDate) return "no-date";
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const today = startOfToday();
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  const weekEnd = endOfWeek(today);
  if (due <= weekEnd) return "this-week";
  const nextWeekEnd = new Date(weekEnd);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  if (due <= nextWeekEnd) return "next-week";
  return "later";
}

function groupByProject(todos: Todo[]): GroupedSection[] {
  const map = new Map<string, { label: string; todos: Todo[] }>();
  for (const todo of todos) {
    const key = todo.projectId ?? todo.category ?? "__none__";
    const label = todo.category ?? "No Project";
    if (!map.has(key)) map.set(key, { label, todos: [] });
    map.get(key)!.todos.push(todo);
  }
  return Array.from(map.entries()).map(([key, val]) => ({
    key,
    label: val.label,
    todos: val.todos,
  }));
}

function groupByOrdered<T extends string>(
  todos: Todo[],
  order: T[],
  labels: Record<string, string>,
  getKey: (t: Todo) => T,
): GroupedSection[] {
  const buckets = new Map<T, Todo[]>();
  for (const k of order) buckets.set(k, []);
  for (const todo of todos) {
    const k = getKey(todo);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(todo);
  }
  return Array.from(buckets.entries())
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({
      key,
      label: labels[key] ?? key,
      todos: list,
    }));
}

export function groupTodos(
  todos: Todo[],
  groupBy: GroupBy,
): GroupedSection[] {
  switch (groupBy) {
    case "none":
      return [{ key: "__all__", label: "", todos }];
    case "project":
      return groupByProject(todos);
    case "status":
      return groupByOrdered(
        todos,
        STATUS_ORDER,
        STATUS_LABELS,
        (t) => t.status,
      );
    case "priority":
      return groupByOrdered(
        todos,
        PRIORITY_ORDER,
        PRIORITY_LABELS,
        (t) => (t.priority ?? "none") as Priority | "none",
      );
    case "dueDate":
      return groupByOrdered(
        todos,
        DUE_DATE_ORDER,
        DUE_DATE_LABELS,
        (t) => getDueDateBucket(t.dueDate),
      );
  }
}
```

- [ ] **Step 5: Write failing tests for `groupTodos()`**

Create `client-react/src/utils/groupTodos.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { groupTodos, type GroupBy } from "./groupTodos";
import type { Todo } from "../types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    title: "Test",
    status: "next",
    completed: false,
    tags: [],
    dependsOnTaskIds: [],
    order: 0,
    archived: false,
    userId: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupTodos", () => {
  describe("none", () => {
    it("returns a single group with all todos", () => {
      const todos = [makeTodo(), makeTodo()];
      const result = groupTodos(todos, "none");
      expect(result).toHaveLength(1);
      expect(result[0].todos).toHaveLength(2);
    });
  });

  describe("project", () => {
    it("groups by projectId, labels by category", () => {
      const todos = [
        makeTodo({ projectId: "p1", category: "Work" }),
        makeTodo({ projectId: "p1", category: "Work" }),
        makeTodo({ projectId: "p2", category: "Personal" }),
      ];
      const result = groupTodos(todos, "project");
      expect(result).toHaveLength(2);
      expect(result.find((g) => g.key === "p1")!.label).toBe("Work");
      expect(result.find((g) => g.key === "p1")!.todos).toHaveLength(2);
      expect(result.find((g) => g.key === "p2")!.todos).toHaveLength(1);
    });

    it("falls back to category string when projectId is null", () => {
      const todos = [makeTodo({ projectId: null, category: "Misc" })];
      const result = groupTodos(todos, "project");
      expect(result[0].key).toBe("Misc");
    });

    it("groups tasks with no project under __none__", () => {
      const todos = [makeTodo({ projectId: null, category: null })];
      const result = groupTodos(todos, "project");
      expect(result[0].key).toBe("__none__");
      expect(result[0].label).toBe("No Project");
    });
  });

  describe("status", () => {
    it("groups in defined order, hides empty groups", () => {
      const todos = [
        makeTodo({ status: "inbox" }),
        makeTodo({ status: "next" }),
        makeTodo({ status: "next" }),
        makeTodo({ status: "waiting" }),
      ];
      const result = groupTodos(todos, "status");
      expect(result.map((g) => g.key)).toEqual(["next", "waiting", "inbox"]);
      expect(result[0].todos).toHaveLength(2);
    });
  });

  describe("priority", () => {
    it("groups in defined order", () => {
      const todos = [
        makeTodo({ priority: "low" }),
        makeTodo({ priority: "high" }),
        makeTodo({ priority: null }),
      ];
      const result = groupTodos(todos, "priority");
      expect(result.map((g) => g.key)).toEqual(["high", "low", "none"]);
    });
  });

  describe("dueDate", () => {
    it("places past dates in overdue", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const todos = [
        makeTodo({ dueDate: yesterday.toISOString() }),
      ];
      const result = groupTodos(todos, "dueDate");
      expect(result[0].key).toBe("overdue");
    });

    it("places today's date in today bucket", () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      const todos = [makeTodo({ dueDate: now.toISOString() })];
      const result = groupTodos(todos, "dueDate");
      expect(result[0].key).toBe("today");
    });

    it("places null dueDate in no-date", () => {
      const todos = [makeTodo({ dueDate: null })];
      const result = groupTodos(todos, "dueDate");
      expect(result[0].key).toBe("no-date");
    });

    it("orders buckets: overdue, today, this-week, next-week, later, no-date", () => {
      const d = new Date();
      const yesterday = new Date(d);
      yesterday.setDate(d.getDate() - 1);
      const nextMonth = new Date(d);
      nextMonth.setDate(d.getDate() + 30);

      const todos = [
        makeTodo({ dueDate: null }),
        makeTodo({ dueDate: d.toISOString() }),
        makeTodo({ dueDate: yesterday.toISOString() }),
        makeTodo({ dueDate: nextMonth.toISOString() }),
      ];
      const result = groupTodos(todos, "dueDate");
      const keys = result.map((g) => g.key);
      // overdue before today before later before no-date
      expect(keys.indexOf("overdue")).toBeLessThan(keys.indexOf("today"));
      expect(keys.indexOf("today")).toBeLessThan(keys.indexOf("later"));
      expect(keys.indexOf("later")).toBeLessThan(keys.indexOf("no-date"));
    });
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
cd client-react && npx vitest run
```
Expected: All tests pass (since we wrote implementation first in step 4).

- [ ] **Step 7: Commit**

```bash
git add client-react/vitest.config.ts client-react/package.json client-react/package-lock.json client-react/src/utils/groupTodos.ts client-react/src/utils/groupTodos.test.ts
git commit -m "feat(react): add groupTodos utility with vitest tests

Introduces groupTodos() pure function supporting none, project,
status, priority, and dueDate grouping modes. Sets up vitest for
the React client."
```

---

### Task 2: Create `useGroupBy` Hook

**Files:**
- Create: `client-react/src/hooks/useGroupBy.ts`

- [ ] **Step 1: Create the hook**

Create `client-react/src/hooks/useGroupBy.ts`:
```typescript
import { useState, useEffect, useCallback } from "react";
import type { GroupBy } from "../utils/groupTodos";

const STORAGE_KEY = "todos:group-by";
const VALID: GroupBy[] = ["none", "project", "status", "priority", "dueDate"];

function readStored(): GroupBy {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val && VALID.includes(val as GroupBy)) return val as GroupBy;
  } catch {
    /* ignore */
  }
  return "none";
}

export function useGroupBy() {
  const [groupBy, setGroupByState] = useState<GroupBy>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, groupBy);
    } catch {
      /* ignore */
    }
  }, [groupBy]);

  const setGroupBy = useCallback((val: GroupBy) => {
    if (VALID.includes(val)) setGroupByState(val);
    else setGroupByState("none");
  }, []);

  return { groupBy, setGroupBy };
}
```

- [ ] **Step 2: Commit**

```bash
git add client-react/src/hooks/useGroupBy.ts
git commit -m "feat(react): add useGroupBy hook with localStorage persistence"
```

---

### Task 3: Create `useCollapsedGroups` Hook

**Files:**
- Create: `client-react/src/hooks/useCollapsedGroups.ts`

- [ ] **Step 1: Create the hook**

Create `client-react/src/hooks/useCollapsedGroups.ts`:
```typescript
import { useState, useCallback } from "react";
import type { GroupBy } from "../utils/groupTodos";

const STORAGE_KEY = "todos:collapsed-groups";

/** Read Record<groupBy, collapsedKeys[]> from localStorage with defensive parsing. */
function readStored(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStored(val: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

export function useCollapsedGroups(groupBy: GroupBy) {
  const [allCollapsed, setAllCollapsed] = useState(readStored);

  const collapsed = allCollapsed[groupBy] ?? [];

  const isCollapsed = useCallback(
    (groupKey: string) => collapsed.includes(groupKey),
    [collapsed],
  );

  const toggle = useCallback(
    (groupKey: string) => {
      setAllCollapsed((prev) => {
        const current = prev[groupBy] ?? [];
        const next = current.includes(groupKey)
          ? current.filter((k) => k !== groupKey)
          : [...current, groupKey];
        const updated = { ...prev, [groupBy]: next };
        writeStored(updated);
        return updated;
      });
    },
    [groupBy],
  );

  return { isCollapsed, toggle };
}
```

- [ ] **Step 2: Commit**

```bash
git add client-react/src/hooks/useCollapsedGroups.ts
git commit -m "feat(react): add useCollapsedGroups hook with mode-scoped persistence"
```

---

### Task 4: Create `GroupHeader` Component

**Files:**
- Create: `client-react/src/components/todos/GroupHeader.tsx`
- Modify: `client-react/src/styles/app.css`

- [ ] **Step 1: Create `GroupHeader` component**

Create `client-react/src/components/todos/GroupHeader.tsx`:
```typescript
interface Props {
  label: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

export function GroupHeader({ label, count, isCollapsed, onToggle }: Props) {
  return (
    <div className="group-header">
      <button
        className="group-header__toggle"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
      >
        <svg
          className={`group-header__chevron${isCollapsed ? "" : " group-header__chevron--open"}`}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span className="group-header__label">{label}</span>
      </button>
      <span className="group-header__count" aria-hidden="true">
        {count}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for `GroupHeader`**

Append to `client-react/src/styles/app.css`:
```css
/* === Group Header === */
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-2) var(--s-4);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border);
}
.group-header__toggle {
  display: flex;
  align-items: center;
  gap: var(--s-1h);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--muted);
  font: inherit;
}
.group-header__toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--r-xs);
}
.group-header__chevron {
  transition: transform var(--dur-fast) var(--ease-out);
  transform: rotate(0deg);
}
.group-header__chevron--open {
  transform: rotate(90deg);
}
.group-header__label {
  font-size: var(--fs-label);
  font-weight: var(--fw-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
}
.group-header__count {
  font-size: var(--fs-xs);
  color: var(--muted);
  background: var(--surface-3);
  padding: 1px var(--s-2);
  border-radius: var(--r-full);
}
```

- [ ] **Step 3: Commit**

```bash
git add client-react/src/components/todos/GroupHeader.tsx client-react/src/styles/app.css
git commit -m "feat(react): add GroupHeader component with collapse toggle"
```

---

### Task 5: Integrate Grouping into `SortableTodoList`

**Files:**
- Modify: `client-react/src/components/todos/SortableTodoList.tsx`

- [ ] **Step 1: Add grouping imports and hooks**

In `client-react/src/components/todos/SortableTodoList.tsx`, add imports at the top:
```typescript
import { useMemo } from "react";
import { groupTodos, type GroupBy } from "../../utils/groupTodos";
import { useGroupBy } from "../../hooks/useGroupBy";
import { useCollapsedGroups } from "../../hooks/useCollapsedGroups";
import { GroupHeader } from "./GroupHeader";
```

- [ ] **Step 2: Add `groupBy` prop and rendering logic**

Add a `groupBy` prop to `SortableTodoList` Props interface:
```typescript
interface Props {
  // ... existing props ...
  groupBy?: GroupBy;
}
```

Inside the component, after the `sensors` setup, add:
```typescript
const { groupBy: activeGroupBy } = useGroupBy();
const effectiveGroupBy = groupBy ?? activeGroupBy;
const sections = useMemo(
  () => groupTodos(todos, effectiveGroupBy),
  [todos, effectiveGroupBy],
);
const { isCollapsed, toggle } = useCollapsedGroups(effectiveGroupBy);
const isDerived = effectiveGroupBy === "status" || effectiveGroupBy === "priority" || effectiveGroupBy === "dueDate";
```

- [ ] **Step 3: Replace flat list rendering with grouped rendering**

Replace the return block's `<DndContext>...<div id="todosList">` with:
```typescript
if (effectiveGroupBy === "none") {
  // Keep existing flat DnD rendering unchanged
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div id="todosList">
          {todos.map((todo) => (
            <SortableRow key={todo.id} /* ...existing props... */ />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Grouped rendering
return (
  <div id="todosList">
    {sections.map((section) => (
      <div key={section.key} className="group-section">
        <GroupHeader
          label={section.label}
          count={section.todos.length}
          isCollapsed={isCollapsed(section.key)}
          onToggle={() => toggle(section.key)}
        />
        {!isCollapsed(section.key) && (
          isDerived ? (
            <div>
              {section.todos.map((todo) => (
                <div key={todo.id} className="sortable-row">
                  <TodoRow
                    todo={todo}
                    isActive={todo.id === activeTodoId}
                    isExpanded={todo.id === expandedTodoId}
                    isBulkMode={isBulkMode}
                    isSelected={selectedIds.has(todo.id)}
                    projects={projects}
                    headings={headings}
                    onToggle={onToggle}
                    onClick={onClick}
                    onKebab={onKebab}
                    onSelect={onSelect}
                    onInlineEdit={onInlineEdit}
                    onSave={onSave}
                    onTagClick={onTagClick}
                    onLifecycleAction={onLifecycleAction}
                  />
                </div>
              ))}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={section.todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {section.todos.map((todo) => (
                  <SortableRow
                    key={todo.id}
                    todo={todo}
                    isActive={todo.id === activeTodoId}
                    isExpanded={todo.id === expandedTodoId}
                    isBulkMode={isBulkMode}
                    isSelected={selectedIds.has(todo.id)}
                    projects={projects}
                    headings={headings}
                    onToggle={onToggle}
                    onClick={onClick}
                    onKebab={onKebab}
                    onSelect={onSelect}
                    onInlineEdit={onInlineEdit}
                    onSave={onSave}
                    onTagClick={onTagClick}
                    onLifecycleAction={onLifecycleAction}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )
        )}
      </div>
    ))}
  </div>
);
```

Note: In derived groups (status, priority, dueDate), no `SortableRow` wrapper or drag handle is rendered — just a plain `div` + `TodoRow`. In `project` groups, the full `DndContext`/`SortableContext`/`SortableRow` pattern is kept.

- [ ] **Step 4: Verify build compiles**

Run:
```bash
cd client-react && npm run build
```
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/components/todos/SortableTodoList.tsx
git commit -m "feat(react): render grouped sections in SortableTodoList

Groups use collapsible GroupHeader with per-group DnD for project
grouping and no drag for derived groups (status/priority/dueDate)."
```

---

### Task 6: Create `ListToolbar` + Move Controls from AppShell

**Files:**
- Create: `client-react/src/components/todos/ListToolbar.tsx`
- Modify: `client-react/src/components/layout/AppShell.tsx`
- Modify: `client-react/src/styles/app.css`

- [ ] **Step 1: Create `ListToolbar` component**

Create `client-react/src/components/todos/ListToolbar.tsx`:
```typescript
import { useGroupBy } from "../../hooks/useGroupBy";
import { useDensity, type Density } from "../../hooks/useDensity";
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
}

export function ListToolbar({ sortBy, sortOrder, onSortChange }: Props) {
  const { groupBy, setGroupBy } = useGroupBy();
  const { density, setDensity } = useDensity();

  return (
    <div className="list-toolbar">
      <div className="list-toolbar__group">
        <div className="list-toolbar__control">
          <select
            className="sort-control__select"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
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
            onClick={() => setDensity(opt.value)}
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
```

- [ ] **Step 2: Add CSS for `ListToolbar`**

Append to `client-react/src/styles/app.css`:
```css
/* === List Toolbar === */
.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-2) var(--s-4);
  gap: var(--s-2);
  border-bottom: 1px solid var(--border-light);
}
.list-toolbar__group {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}
.list-toolbar__control select {
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  color: var(--text);
  font-size: var(--fs-label);
}
.list-toolbar__density {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--r-sm);
  background: var(--surface-2);
}
.list-toolbar__density-btn {
  padding: var(--s-1) var(--s-1h);
  border-radius: var(--r-xs);
  border: none;
  background: none;
  color: var(--muted);
  font-size: var(--fs-xs);
  cursor: pointer;
  line-height: 1;
}
.list-toolbar__density-btn--active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-0);
}
.list-toolbar__density-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
```

- [ ] **Step 3: Integrate `ListToolbar` into `SortableTodoList`**

In `SortableTodoList.tsx`, add `ListToolbar` import and add sort props to the Props interface:
```typescript
import { ListToolbar } from "./ListToolbar";
```

Add to Props:
```typescript
interface Props {
  // ... existing props ...
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
}
```

Render `ListToolbar` above the list, after the loading/error/empty guards:
```typescript
return (
  <>
    <ListToolbar sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} />
    {/* existing grouped/flat rendering */}
  </>
);
```

- [ ] **Step 4: Remove `SortControl` from `AppShell`**

In `client-react/src/components/layout/AppShell.tsx`:

Remove the `SortControl` import (line 23) and the `SortControl` JSX block (lines ~966-975).

Pass sort state through to `SortableTodoList`:
```typescript
<SortableTodoList
  // ... existing props ...
  sortBy={sortBy}
  sortOrder={sortOrder}
  onSortChange={(f, o) => { setSortBy(f); setSortOrder(o); }}
/>
```

- [ ] **Step 5: Verify build compiles**

Run:
```bash
cd client-react && npm run build
```
Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add client-react/src/components/todos/ListToolbar.tsx client-react/src/components/todos/SortableTodoList.tsx client-react/src/components/layout/AppShell.tsx client-react/src/styles/app.css
git commit -m "feat(react): add ListToolbar with GroupBy dropdown and density toggle

Moves SortControl from AppShell into the list-local toolbar alongside
new GroupBy dropdown and density picker buttons."
```

---

### Task 7: Add `TodoRow` Visual Indicators (Priority Border + Overdue Tint)

**Files:**
- Modify: `client-react/src/components/todos/TodoRow.tsx`
- Modify: `client-react/src/styles/app.css`

- [ ] **Step 1: Add priority border and overdue tint classes to `TodoRow`**

In `client-react/src/components/todos/TodoRow.tsx`, modify the `rowClass` construction (line 79):

Replace:
```typescript
const rowClass = `todo-item${isActive ? " todo-item--active" : ""}${isExpanded ? " todo-item--expanded" : ""}${todo.completed ? " completed" : ""}${isSelected ? " todo-item--selected" : ""}`;
```

With:
```typescript
const isOverdue = !todo.completed && !!todo.dueDate && new Date(todo.dueDate) < new Date(new Date().toDateString());
const priorityBorder = (todo.priority === "urgent" || todo.priority === "high")
  ? " todo-item--border-high"
  : todo.priority === "medium"
    ? " todo-item--border-med"
    : "";
const rowClass = `todo-item${isActive ? " todo-item--active" : ""}${isExpanded ? " todo-item--expanded" : ""}${todo.completed ? " completed" : ""}${isSelected ? " todo-item--selected" : ""}${priorityBorder}${isOverdue ? " todo-item--overdue" : ""}`;
```

- [ ] **Step 2: Add CSS for visual indicators**

Append to `client-react/src/styles/app.css`:
```css
/* === Priority borders === */
.todo-item--border-high {
  border-left: 3px solid var(--danger);
}
.todo-item--border-med {
  border-left: 3px solid var(--warning);
}
/* === Overdue tint === */
.todo-item--overdue {
  background: color-mix(in srgb, var(--danger) 5%, transparent);
}
.todo-item--overdue:hover {
  background: color-mix(in srgb, var(--danger) 8%, var(--surface-2));
}
```

- [ ] **Step 3: Verify build compiles**

Run:
```bash
cd client-react && npm run build
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/components/todos/TodoRow.tsx client-react/src/styles/app.css
git commit -m "feat(react): add priority left border and overdue tint to TodoRow"
```

---

### Task 8: Create `buildChips()` + Tests

**Files:**
- Create: `client-react/src/utils/buildChips.ts`
- Create: `client-react/src/utils/buildChips.test.ts`

- [ ] **Step 1: Create `buildChips()` utility**

Create `client-react/src/utils/buildChips.ts`:
```typescript
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
```

- [ ] **Step 2: Write tests**

Create `client-react/src/utils/buildChips.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildChips } from "./buildChips";
import type { Todo } from "../types";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "t1",
    title: "Test",
    status: "next",
    completed: false,
    tags: [],
    dependsOnTaskIds: [],
    order: 0,
    archived: false,
    userId: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildChips", () => {
  it("returns empty for compact density", () => {
    const todo = makeTodo({ priority: "high", category: "Work" });
    expect(buildChips(todo, "compact")).toEqual([]);
  });

  it("orders overdue before blocked before priority", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const todo = makeTodo({
      dueDate: yesterday.toISOString(),
      dependsOnTaskIds: ["dep1"],
      priority: "high",
    });
    const chips = buildChips(todo, "spacious");
    expect(chips[0].variant).toBe("overdue");
    expect(chips[1].variant).toBe("blocked");
    expect(chips[2].variant).toBe("priority-high");
  });

  it("truncates to 4 + overflow in normal mode", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const todo = makeTodo({
      dueDate: yesterday.toISOString(),
      dependsOnTaskIds: ["dep1"],
      priority: "high",
      category: "Work",
      tags: ["a", "b", "c"],
    });
    const chips = buildChips(todo, "normal");
    expect(chips).toHaveLength(5); // 4 shown + overflow
    expect(chips[4].variant).toBe("overflow");
    expect(chips[4].label).toBe("+4"); // project + 3 tags
  });

  it("shows all chips in spacious mode", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const todo = makeTodo({
      dueDate: yesterday.toISOString(),
      dependsOnTaskIds: ["dep1"],
      priority: "high",
      category: "Work",
      tags: ["a", "b"],
    });
    const chips = buildChips(todo, "spacious");
    expect(chips.length).toBeGreaterThan(4);
    expect(chips.find((c) => c.variant === "overflow")).toBeUndefined();
  });

  it("shows waiting-on chip", () => {
    const todo = makeTodo({ waitingOn: "Alice" });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.variant === "waiting")?.label).toBe("@Alice");
  });

  it("skips low priority", () => {
    const todo = makeTodo({ priority: "low" });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.key === "priority")).toBeUndefined();
  });

  it("shows subtask count in normal mode", () => {
    const todo = makeTodo({
      subtasks: [
        { id: "s1", title: "A", completed: true, order: 0, todoId: "t1", createdAt: "", updatedAt: "" },
        { id: "s2", title: "B", completed: false, order: 1, todoId: "t1", createdAt: "", updatedAt: "" },
      ],
    });
    const chips = buildChips(todo, "normal");
    expect(chips.find((c) => c.variant === "subtask")?.label).toBe("1/2");
  });
});
```

- [ ] **Step 3: Run tests**

Run:
```bash
cd client-react && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/utils/buildChips.ts client-react/src/utils/buildChips.test.ts
git commit -m "feat(react): add buildChips utility with priority ordering and truncation"
```

---

### Task 9: Integrate `buildChips()` into `TodoRow` with Density-Aware Rendering

**Files:**
- Modify: `client-react/src/components/todos/TodoRow.tsx`
- Modify: `client-react/src/styles/app.css`

- [ ] **Step 1: Replace hardcoded chips with `buildChips()`**

In `client-react/src/components/todos/TodoRow.tsx`:

Add imports:
```typescript
import { useDensity } from "../../hooks/useDensity";
import { buildChips } from "../../utils/buildChips";
```

Inside the component function, add:
```typescript
const { density } = useDensity();
const chips = buildChips(todo, density);
```

Replace the entire `<div className="todo-chips">...</div>` block (lines ~143-176) with:
```typescript
{chips.length > 0 && (
  <div className="todo-chips">
    {chips.map((chip) => (
      <span
        key={chip.key}
        className={`todo-chip todo-chip--${chip.variant}`}
        onClick={chip.variant === "tag" ? (e) => { e.stopPropagation(); onTagClick?.(chip.label.slice(1)); } : undefined}
      >
        {chip.label}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 2: Add CSS for new chip variants**

Append to `client-react/src/styles/app.css`:
```css
/* === Chip variants === */
.todo-chip--overdue {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  font-weight: var(--fw-medium);
}
.todo-chip--blocked {
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  color: var(--danger);
}
.todo-chip--waiting {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}
.todo-chip--priority-high {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  font-weight: var(--fw-medium);
}
.todo-chip--priority-med {
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  color: var(--warning);
  font-weight: var(--fw-medium);
}
.todo-chip--project,
.todo-chip--date,
.todo-chip--subtask,
.todo-chip--tag {
  background: var(--surface-3);
  color: var(--muted);
}
.todo-chip--overflow {
  background: var(--surface-3);
  color: var(--muted);
  font-size: var(--fs-xs);
}
```

- [ ] **Step 3: Verify build compiles**

Run:
```bash
cd client-react && npm run build
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/components/todos/TodoRow.tsx client-react/src/styles/app.css
git commit -m "feat(react): integrate buildChips with density-aware rendering in TodoRow"
```

---

### Task 10: Spacious Mode Extras (Description, Subtask Progress, Notes)

**Files:**
- Modify: `client-react/src/components/todos/TodoRow.tsx`
- Modify: `client-react/src/styles/app.css`

- [ ] **Step 1: Add spacious-mode content to `TodoRow`**

In `client-react/src/components/todos/TodoRow.tsx`, after the chips `<div>` and before the inline actions, add:
```typescript
{density === "spacious" && (
  <>
    {todo.description && (
      <div className="todo-description-preview">
        {todo.description.length > 120
          ? todo.description.slice(0, 120) + "..."
          : todo.description}
      </div>
    )}
    {todo.subtasks && todo.subtasks.length > 0 && (() => {
      const done = todo.subtasks.filter((s) => s.completed).length;
      const total = todo.subtasks.length;
      return (
        <div className="todo-subtask-bar">
          <div
            className="todo-subtask-bar__track"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemax={total}
            aria-label={`${done} of ${total} subtasks complete`}
          >
            <div
              className="todo-subtask-bar__fill"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
          <span className="todo-subtask-bar__label">{done} of {total}</span>
        </div>
      );
    })()}
    {todo.notes && (
      <div className="todo-notes-indicator">Has notes</div>
    )}
  </>
)}
```

- [ ] **Step 2: Add CSS for spacious-mode elements**

Append to `client-react/src/styles/app.css`:
```css
/* === Spacious mode extras === */
.todo-description-preview {
  font-size: var(--fs-label);
  color: var(--muted);
  line-height: var(--lh-snug);
  margin-top: var(--s-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.todo-subtask-bar {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  margin-top: var(--s-1);
}
.todo-subtask-bar__track {
  flex: 1;
  max-width: 120px;
  height: 4px;
  background: var(--surface-3);
  border-radius: var(--r-full);
  overflow: hidden;
}
.todo-subtask-bar__fill {
  height: 100%;
  background: var(--accent);
  border-radius: var(--r-full);
  transition: width var(--dur-base) var(--ease-out);
}
.todo-subtask-bar__label {
  font-size: var(--fs-xs);
  color: var(--muted);
}
.todo-notes-indicator {
  font-size: var(--fs-xs);
  color: var(--muted);
  margin-top: var(--s-1);
  font-style: italic;
}
```

- [ ] **Step 3: Verify build compiles**

Run:
```bash
cd client-react && npm run build
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add client-react/src/components/todos/TodoRow.tsx client-react/src/styles/app.css
git commit -m "feat(react): add spacious-mode description, subtask progress bar, notes indicator"
```

---

### Task 11: Density-Aware Compact Mode (Hide Chips + Inline Actions)

**Files:**
- Modify: `client-react/src/styles/app.css`

- [ ] **Step 1: Add compact-mode CSS rules**

Append to `client-react/src/styles/app.css`:
```css
/* === Compact density: hide non-essential elements === */
[data-density="compact"] .todo-inline-actions {
  display: none;
}
[data-density="compact"] .todo-kebab-wrapper {
  display: none;
}
[data-density="compact"] .todo-description-preview,
[data-density="compact"] .todo-subtask-bar,
[data-density="compact"] .todo-notes-indicator {
  display: none;
}
```

Note: Chips are already not mounted in compact mode due to `buildChips()` returning `[]`. The CSS rules above hide the action buttons and spacious-mode elements that may be rendered by other density states during transitions.

- [ ] **Step 2: Verify build compiles**

Run:
```bash
cd client-react && npm run build
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client-react/src/styles/app.css
git commit -m "feat(react): hide inline actions and extras in compact density mode"
```

---

### Task 12: Final Integration Verification

**Files:** No new files — this is a verification task.

- [ ] **Step 1: Run all unit tests**

Run:
```bash
cd client-react && npx vitest run
```
Expected: All tests pass.

- [ ] **Step 2: Run production build**

Run:
```bash
cd client-react && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run root-level checks**

Run:
```bash
npx tsc --noEmit
npm run format:check
```
Expected: Both pass.

- [ ] **Step 4: Manual verification checklist**

Start the dev server (`cd client-react && npm run dev`) and verify:
- [ ] Group By dropdown appears in the list toolbar
- [ ] Selecting "Status" groups tasks with collapsible headers
- [ ] Selecting "Priority" groups tasks with correct order (urgent → high → medium → low → none)
- [ ] Selecting "Due Date" groups tasks into correct buckets
- [ ] Selecting "Project" groups by category with drag-and-drop working
- [ ] Selecting "None" restores flat list with drag-and-drop
- [ ] Collapsing a group hides its tasks; state persists on page reload
- [ ] Density toggle (compact/normal/spacious) changes row layout
- [ ] Compact: shows only checkbox + title + priority border
- [ ] Normal: shows chips (max 4 + overflow)
- [ ] Spacious: shows description, subtask progress bar, all chips
- [ ] High-priority tasks have red left border
- [ ] Medium-priority tasks have amber left border
- [ ] Overdue tasks have red background tint
- [ ] Blocked chip appears for tasks with dependencies
- [ ] Waiting-on chip appears for tasks with `waitingOn` set

- [ ] **Step 5: Commit any fixes, then final commit**

If all checks pass with no fixes needed, skip this step.
