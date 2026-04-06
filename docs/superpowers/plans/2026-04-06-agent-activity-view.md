# Agent Activity View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Activity" sidebar view showing narrated agent actions from the last 7 days.

**Architecture:** New backend endpoint queries audit table for narrated entries, grouped by agent/job/period. Frontend adds "Activity" as an `AppPage` (like Settings/Review), renders the existing `AgentActivityFeed` component with date headers and standalone mode.

**Tech Stack:** Express/Prisma (backend endpoint), React/TypeScript (frontend view)

**Spec:** `docs/superpowers/specs/2026-04-06-agent-activity-view-design.md`

---

## File Map

### New files
- `src/routes/agentActivityRouter.ts` — `GET /agent-activity` endpoint
- `client-react/src/components/activity/AgentActivityView.tsx` — page wrapper with header + back button

### Modified files
- `src/app.ts:347-362,461+` — mount router, add to `protectedRoutes`
- `client-react/src/components/shared/Icons.tsx` — add `IconActivity`
- `client-react/src/components/projects/Sidebar.tsx:73-98,267-287` — add `onOpenActivity` + `activePage` props, add nav entry
- `client-react/src/components/layout/AppShell.tsx:70-76,847-856,1021-1037` — add `"activity"` to `AppPage`, wire sidebar, add page branch
- `client-react/src/components/home/AgentActivityFeed.tsx:1-67` — remove `agentName`, add `standalone` prop, date headers, empty/loading states

---

## Task 1: Backend endpoint — GET /agent-activity

**Files:**
- Create: `src/routes/agentActivityRouter.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: Create `src/routes/agentActivityRouter.ts`**

```typescript
import { Router, Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";

interface ActivityRow {
  agent_id: string;
  job_name: string;
  job_period_key: string;
  narration: string;
  metadata: Prisma.JsonValue;
  created_at: Date;
}

export function createAgentActivityRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/agent-activity", async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    try {
      const rows = await prisma.$queryRaw<ActivityRow[]>`
        SELECT DISTINCT ON (agent_id, job_name, job_period_key)
          agent_id, job_name, job_period_key, narration, metadata, created_at
        FROM agent_action_audits
        WHERE user_id = ${userId}
          AND narration IS NOT NULL
          AND created_at >= ${sevenDaysAgo}
        ORDER BY agent_id, job_name, job_period_key, created_at DESC
      `;

      const entries = rows
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .map((row) => ({
          agentId: row.agent_id,
          jobName: row.job_name,
          periodKey: row.job_period_key,
          narration: row.narration,
          metadata: row.metadata ?? {},
          createdAt: row.created_at.toISOString(),
        }));

      res.json({ entries });
    } catch (err) {
      console.error("Failed to fetch agent activity:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
```

- [ ] **Step 2: Mount in `src/app.ts`**

Add import at the top with other router imports (around line 19-65):

```typescript
import { createAgentActivityRouter } from "./routes/agentActivityRouter";
```

Add `"/agent-activity"` to the `protectedRoutes` array (line 347-362), after `"/adaptation"`:

```typescript
      "/adaptation",
      "/agent-activity",
```

Mount the router inside the `if (persistencePrisma)` block (around line 461). Add after an existing `app.use(...)` call:

```typescript
    app.use(createAgentActivityRouter(persistencePrisma));
```

- [ ] **Step 3: Run typecheck**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npx tsc --noEmit'`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/agentActivityRouter.ts src/app.ts
git commit -m "feat(api): add GET /agent-activity endpoint for narrated agent actions"
```

---

## Task 2: IconActivity icon

**Files:**
- Modify: `client-react/src/components/shared/Icons.tsx`

- [ ] **Step 1: Add IconActivity**

In `client-react/src/components/shared/Icons.tsx`, add after the last icon export:

```typescript
export function IconActivity(p: IconProps) {
  return (
    <Icon {...p}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Icon>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npx tsc --noEmit'`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add client-react/src/components/shared/Icons.tsx
git commit -m "feat(react): add IconActivity pulse icon"
```

---

## Task 3: Sidebar — add Activity nav entry

**Files:**
- Modify: `client-react/src/components/projects/Sidebar.tsx:73-98,267-287`

- [ ] **Step 1: Add props to Sidebar interface**

In `client-react/src/components/projects/Sidebar.tsx`, add to the `Props` interface (after `onOpenAdmin` on line 84):

```typescript
  onOpenActivity: () => void;
  activePage: string;
```

Add to the destructured params in the function signature (after `onOpenAdmin` on line 111):

```typescript
  onOpenActivity,
  activePage,
```

- [ ] **Step 2: Import IconActivity**

Add to the icon imports at the top of the file:

```typescript
import { IconActivity } from "../shared/Icons";
```

(Check the existing import line for Icons — it may be a combined import. Add `IconActivity` to it.)

- [ ] **Step 3: Add nav entry after workspace views**

After the `</nav>` that closes the workspace views loop (line 287), add a new nav entry before the projects section (before line 289 `{/* Section 2: Projects grouped by area */}`):

```tsx
        <nav className="projects-rail__primary" style={{ marginTop: 4 }}>
          <button
            className={`workspace-view-item${activePage === "activity" ? " projects-rail-item--active" : ""}`}
            onClick={onOpenActivity}
          >
            <IconActivity />
            <span className="nav-label">Activity</span>
          </button>
        </nav>
```

- [ ] **Step 4: Run typecheck**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npx tsc --noEmit'`
Expected: FAIL — AppShell doesn't pass the new props yet. That's fine, we'll fix in the next task.

- [ ] **Step 5: Commit**

```bash
git add client-react/src/components/projects/Sidebar.tsx
git commit -m "feat(react): add Activity nav entry to sidebar"
```

---

## Task 4: AppShell — wire Activity page

**Files:**
- Modify: `client-react/src/components/layout/AppShell.tsx:70-76,847-856,1021-1037`
- Create: `client-react/src/components/activity/AgentActivityView.tsx`

- [ ] **Step 1: Create `AgentActivityView` wrapper**

Create `client-react/src/components/activity/AgentActivityView.tsx`:

```typescript
import { AgentActivityFeed } from "../home/AgentActivityFeed";

interface Props {
  onBack: () => void;
}

export function AgentActivityView({ onBack }: Props) {
  return (
    <>
      <header className="app-header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <span className="app-header__title">Agent Activity</span>
      </header>
      <div className="app-content">
        <AgentActivityFeed standalone />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add `"activity"` to `AppPage` type**

In `client-react/src/components/layout/AppShell.tsx`, line 70-76, add `"activity"`:

```typescript
type AppPage =
  | "todos"
  | "settings"
  | "components"
  | "admin"
  | "feedback"
  | "review"
  | "activity";
```

- [ ] **Step 3: Add page label to document title**

In the `useEffect` that sets `document.title` (around line 847-858), add `"activity"` case. Find:

```typescript
            : page === "feedback"
              ? "Feedback"
              : headerTitle;
```

Replace with:

```typescript
            : page === "feedback"
              ? "Feedback"
              : page === "activity"
                ? "Agent Activity"
                : headerTitle;
```

- [ ] **Step 4: Add rendering branch**

Import `AgentActivityView` at the top:

```typescript
import { AgentActivityView } from "../activity/AgentActivityView";
```

In the page rendering chain, after the `page === "review"` branch (line 1021-1036) and before the `ViewRouter` fallback (line 1037), add:

Find:
```typescript
            </Suspense>
          ) : (
            <ViewRouter activeViewKey={activeViewKey} capacity={3}>
```

Replace with:
```typescript
            </Suspense>
          ) : page === "activity" ? (
            <AgentActivityView
              onBack={() => startTransition(() => setPage("todos"))}
            />
          ) : (
            <ViewRouter activeViewKey={activeViewKey} capacity={3}>
```

- [ ] **Step 5: Pass new props to Sidebar**

Find where `<Sidebar` is rendered in AppShell and add the new props:

```typescript
onOpenActivity={() => {
  startTransition(() => setPage("activity"));
  setMobileNavOpen(false);
}}
activePage={page}
```

- [ ] **Step 6: Run typecheck**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npx tsc --noEmit'`
Expected: FAIL — `AgentActivityFeed` doesn't accept `standalone` prop yet. That's expected.

- [ ] **Step 7: Commit**

```bash
git add client-react/src/components/activity/AgentActivityView.tsx client-react/src/components/layout/AppShell.tsx
git commit -m "feat(react): wire Activity page into AppShell with sidebar navigation"
```

---

## Task 5: AgentActivityFeed — standalone mode with date headers

**Files:**
- Modify: `client-react/src/components/home/AgentActivityFeed.tsx`

- [ ] **Step 1: Remove `agentName` from interface, add `standalone` prop**

Replace the entire file content:

```typescript
import { useState, useEffect } from "react";
import { apiCall } from "../../api/client";
import {
  useAgentProfiles,
  getAgentProfile,
} from "../../agents/useAgentProfiles";
import { AgentSigil } from "./AgentSigil";

interface ActivityEntry {
  agentId: string;
  jobName: string;
  periodKey: string;
  narration: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface Props {
  standalone?: boolean;
}

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffMs = today.getTime() - entryDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 5)
    return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupByDay(
  entries: ActivityEntry[],
): Array<{ label: string; entries: ActivityEntry[] }> {
  const groups: Array<{ label: string; entries: ActivityEntry[] }> = [];
  let currentLabel = "";

  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    if (label !== currentLabel) {
      groups.push({ label, entries: [entry] });
      currentLabel = label;
    } else {
      groups[groups.length - 1].entries.push(entry);
    }
  }

  return groups;
}

export function AgentActivityFeed({ standalone = false }: Props) {
  const profiles = useAgentProfiles();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("/agent-activity")
      .then((res) => res.json())
      .then((data: { entries: ActivityEntry[] }) => setEntries(data.entries))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    if (standalone) {
      return (
        <div className="activity-feed activity-feed--loading">
          <div className="loading-skeleton">
            <div className="loading-skeleton__row" />
            <div className="loading-skeleton__row" />
            <div className="loading-skeleton__row" />
          </div>
        </div>
      );
    }
    return null;
  }

  if (entries.length === 0) {
    if (standalone) {
      return (
        <div className="activity-feed activity-feed--empty">
          <p className="activity-feed__empty-text">
            No agent activity in the last 7 days.
          </p>
        </div>
      );
    }
    return null;
  }

  const renderEntry = (entry: ActivityEntry, i: number) => {
    const agent = getAgentProfile(profiles, entry.agentId);
    return (
      <div
        key={`${entry.agentId}-${entry.periodKey}-${i}`}
        className="activity-entry"
      >
        {agent && (
          <AgentSigil
            agentId={agent.id}
            color={agent.colors.stroke}
            bg={agent.colors.bg}
            size={32}
          />
        )}
        <div className="activity-entry__body">
          <div className="activity-entry__header">
            <span
              className="activity-entry__name"
              style={{ color: agent?.colors.textDark }}
            >
              {agent?.name ?? entry.agentId}
            </span>
            <span className="activity-entry__meta">
              {entry.jobName} &middot;{" "}
              {new Date(entry.createdAt).toLocaleString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="activity-entry__narration">{entry.narration}</p>
        </div>
      </div>
    );
  };

  if (standalone) {
    const groups = groupByDay(entries);
    return (
      <div className="activity-feed">
        {groups.map((group) => (
          <div key={group.label} className="activity-feed__day">
            <h3 className="activity-feed__date-header">{group.label}</h3>
            {group.entries.map(renderEntry)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {entries.map(renderEntry)}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for date headers and standalone states**

In `client-react/src/styles/app.css`, find the existing `.activity-feed` styles and add:

```css
.activity-feed__date-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted, #999);
  margin: var(--s-4, 16px) 0 var(--s-2, 8px);
  padding-bottom: var(--s-1, 4px);
  border-bottom: 1px solid var(--border, #eee);
}
.activity-feed__day:first-child .activity-feed__date-header {
  margin-top: 0;
}
.activity-feed--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}
.activity-feed__empty-text {
  color: var(--text-muted, #999);
  font-size: 14px;
}
```

- [ ] **Step 3: Run typecheck**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npx tsc --noEmit'`
Expected: PASS — all pieces connected now.

- [ ] **Step 4: Run format check**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run format:check 2>&1 | grep -v eval-lab'`
If formatting issues, run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npx prettier --write src/routes/agentActivityRouter.ts client-react/src/components/home/AgentActivityFeed.tsx client-react/src/components/activity/AgentActivityView.tsx client-react/src/components/projects/Sidebar.tsx client-react/src/components/layout/AppShell.tsx'`

- [ ] **Step 5: Run unit tests**

Run: `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run test:unit'`
Expected: PASS (no test regressions)

- [ ] **Step 6: Commit**

```bash
git add client-react/src/components/home/AgentActivityFeed.tsx client-react/src/styles/app.css
git commit -m "feat(react): add standalone mode with date headers to AgentActivityFeed"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run all checks**

```bash
/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npx tsc --noEmit'
/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run check:architecture'
/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run format:check'
/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm run test:unit'
```

Expected: ALL PASS

- [ ] **Step 2: Fix any failures and commit**

```bash
git add -A
git commit -m "fix: address verification failures"
```
