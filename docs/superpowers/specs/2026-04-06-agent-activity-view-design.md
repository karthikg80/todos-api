# Agent Activity View — Design Spec v2

## Overview

Add a dedicated "Activity" view accessible from the sidebar that shows narrated
agent actions from the last 7 days. This is a standalone page (like Settings or
Weekly Review), not a todo workspace view.

---

## Backend: `GET /agent-activity`

New authenticated endpoint. The existing `AgentActivityFeed` component already
calls `apiCall("/agent-activity")` (currently fails silently), so the route path
is pre-determined.

### Router

Create `src/routes/agentActivityRouter.ts` — a small dedicated router. Do NOT
add to `agentProfileRouter.ts` (that router is public, takes no deps, and has
no Prisma access).

```ts
// src/routes/agentActivityRouter.ts
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

export function createAgentActivityRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/agent-activity", async (req: Request, res: Response) => {
    // ... implementation
  });

  return router;
}
```

### Mount & auth (app.ts)

1. Mount at root: `app.use(createAgentActivityRouter(persistencePrisma));`
2. Add `"/agent-activity"` to the `protectedRoutes` array (line ~347) so user
   auth middleware is applied automatically.

### Query

```sql
SELECT DISTINCT ON (agent_id, job_name, job_period_key)
  agent_id, job_name, job_period_key, narration, metadata, created_at
FROM agent_action_audits
WHERE user_id = $userId
  AND narration IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY agent_id, job_name, job_period_key, created_at DESC
```

This gives the **latest** narration per (agent, job, period) group. Then sort
the final result set by `created_at DESC` in application code.

In Prisma, use `$queryRaw` or a grouped findMany with ordering. The key
requirement: one entry per agent per job run, latest narration wins.

### Response shape

```json
{
  "entries": [
    {
      "agentId": "echo",
      "jobName": "inbox",
      "periodKey": "2026-04-06",
      "narration": "Sorted. 6 items — 3 to projects, 2 flagged urgent, 1 archived.",
      "metadata": {},
      "createdAt": "2026-04-06T08:02:00Z"
    }
  ]
}
```

`agentName` is NOT in the response — the client derives it from cached agent
profiles via `useAgentProfiles()`. The existing component already does this
(line 34 of `AgentActivityFeed.tsx`). However, the `ActivityEntry` interface
currently has an `agentName` field (line 8) — **remove it** from the interface
since the backend won't provide it and the component already resolves the name
from profiles.

---

## Frontend: Navigation Model

### What changes: `AppPage`, not `WorkspaceView`

Agent activity is a standalone content page with no todo plumbing. It follows
the same pattern as Settings, Admin, Feedback, and Weekly Review:

- **`AppPage` type** — add `"activity"` to the union (line ~70 of `AppShell.tsx`)
- **Rendering** — add a branch in the `page ===` chain (after `"review"`, before
  the `ViewRouter` fallback)
- **No changes** to `WorkspaceView`, `queryParams`, `visibleTodos`, `viewCounts`,
  or `quickEntryPlaceholder`

### Sidebar entry (`Sidebar.tsx`)

Add a new prop `onOpenActivity: () => void` to the `Sidebar` `Props` interface.
Add a nav entry in the `projects-rail__primary` nav, after the workspace views
and before the projects section:

```tsx
<button
  className={`workspace-view-item${page === "activity" ? " projects-rail-item--active" : ""}`}
  onClick={onOpenActivity}
>
  <IconActivity />
  <span className="nav-label">Activity</span>
</button>
```

This requires a way for the sidebar to know when the activity page is active.
Options (pick simplest):
- Pass `page` (or a boolean `isActivityActive`) as a prop
- Or: use the existing `activeView` with a sentinel — but this pollutes
  `WorkspaceView`, so prefer a prop

Recommended: add `activePage: AppPage` prop to Sidebar so it can highlight
correctly. When any workspace view is selected, `activePage` will be `"todos"`.

### Wiring in `AppShell.tsx`

```tsx
// In sidebarContent:
onOpenActivity={() => {
  startTransition(() => setPage("activity"));
  setMobileNavOpen(false);
}}

// In the page === chain:
) : page === "activity" ? (
  <AgentActivityView
    onBack={() => startTransition(() => setPage("todos"))}
  />
) : (
  <ViewRouter ...>
```

---

## Component: `AgentActivityView`

New wrapper component at `client-react/src/components/activity/AgentActivityView.tsx`.

This is thin — it provides the page chrome (header with back button + title)
and renders `AgentActivityFeed` in standalone mode.

```tsx
interface Props {
  onBack: () => void;
}

export function AgentActivityView({ onBack }: Props) {
  return (
    <>
      <header className="app-header">
        <button className="btn" onClick={onBack}>← Back</button>
        <span className="app-header__title">Agent Activity</span>
      </header>
      <div className="app-content">
        <AgentActivityFeed standalone />
      </div>
    </>
  );
}
```

---

## Component: `AgentActivityFeed` enhancements

File: `client-react/src/components/home/AgentActivityFeed.tsx`

### Interface cleanup

Remove `agentName` from `ActivityEntry` — the backend doesn't provide it, and
the component resolves it from `useAgentProfiles()`.

### `standalone` prop

Add an optional `standalone?: boolean` prop that controls two behaviors:

1. **Empty state** — when `standalone` is true and `entries.length === 0`,
   render a message: "No agent activity in the last 7 days." When `standalone`
   is false (default, embedded in HomeDashboard), keep the current behavior
   of returning `null`.

2. **Date headers** — when `standalone` is true, group entries under day
   labels before rendering. Labels:
   - Same calendar day as now → **"Today"**
   - Previous calendar day → **"Yesterday"**
   - 2–5 days ago → **day name** ("Saturday", "Thursday", etc.)
   - 6–7 days ago → **formatted date** ("Mar 31", "Mar 30")

   Use a simple grouping pass over the sorted entries array. Render each
   group as a `<div>` with a `<h3 className="activity-feed__date-header">`
   followed by the entries for that day.

### Loading state for standalone

When `standalone` is true, show a skeleton/spinner during load instead of
returning `null`.

---

## Icon: `IconActivity`

Add to `client-react/src/components/shared/Icons.tsx`. Feather "activity" icon
(pulse/heartbeat line):

```tsx
export function IconActivity(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36-3.18-19.64A2 2 0 0 0 10.12 1h-.24a2 2 0 0 0-1.94 1.52L5.21 13H2" />
    </Icon>
  );
}
```

Verify this renders correctly at 15×15 — if the path is too complex for the
viewBox, simplify to:

```tsx
<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/routes/agentActivityRouter.ts` | **New.** `GET /agent-activity` endpoint |
| `src/app.ts` | Import + mount router; add to `protectedRoutes` |
| `client-react/src/components/shared/Icons.tsx` | Add `IconActivity` |
| `client-react/src/components/projects/Sidebar.tsx` | Add `onOpenActivity` prop + nav entry; add `activePage` prop for highlight |
| `client-react/src/components/layout/AppShell.tsx` | Add `"activity"` to `AppPage`; wire sidebar prop; add rendering branch |
| `client-react/src/components/activity/AgentActivityView.tsx` | **New.** Wrapper with header + back button |
| `client-react/src/components/home/AgentActivityFeed.tsx` | Remove `agentName` from interface; add `standalone` prop with date headers, empty state, loading state |

## What Doesn't Change

- No new DB columns or migrations
- No agent-runner changes
- No changes to `WorkspaceView` type or any todo-related memos
- No changes to agent profile endpoint or registry
- `AgentActivityFeed`'s core rendering (sigil + narration layout) stays the same
- Existing embedded usage on HomeDashboard (if any) is unaffected (`standalone`
  defaults to `false`)
