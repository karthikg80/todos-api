# React App Parity Gaps — Close remaining gaps to sunset vanilla JS client

You are working in `client-react/` (Vite + React 19, no build framework). The vanilla JS app at `client/` is being frozen — no new features there. Your job is to close the remaining parity gaps so we can sunset it.

The backend is shared (Express + Prisma + PostgreSQL in `src/`). Both apps use the same API endpoints, same JWT auth, same todo/project DTOs. Types are in `client-react/src/types/index.ts`. API helpers are in `client-react/src/api/`.

## Environment

- Node 22 via nvm: commands must use `/bin/bash -c 'source "$HOME/.nvm/nvm.sh" && nvm use 22 && <command>'`
- React app dev: `cd client-react && npm run dev`
- React app typecheck: `cd client-react && npx tsc --noEmit`
- React app build: `cd client-react && npm run build`

## Gap 1: Weekly Review View

**Priority: HIGH — this is a core workflow users depend on.**

The vanilla app has `client/modules/weeklyReviewUi.js` which renders a weekly review flow. The React app has no equivalent.

### What the weekly review does (reference the vanilla implementation):
1. User navigates to weekly review from sidebar or command palette
2. System calls `POST /agent/read/weekly_review` with `{ mode: "suggest" }` to get findings
3. Findings include: stale tasks, projects missing next actions, waiting items, overdue work, rollover groups
4. User reviews findings, then can "Apply" which calls `POST /agent/write/weekly_review` with `{ mode: "apply" }`
5. Apply mode creates action items and marks projects as reviewed

### Implementation:
- Create `client-react/src/components/review/WeeklyReview.tsx`
- Add `"weekly-review"` to the `WorkspaceView` type in `client-react/src/components/projects/Sidebar.tsx`
- Add a sidebar nav item for it (use an appropriate icon)
- Add the view routing in `AppShell.tsx`
- Add API helper in `client-react/src/api/agent.ts` (or extend existing) for the agent read/write calls
- The vanilla app uses `callAgentAction()` which hits `/agent/read/*` and `/agent/write/*` endpoints

### UI structure:
- Header: "Weekly Reset" with the soul copy intro text
- Loading state while fetching suggestions
- Findings section: grouped by type (stale tasks, missing next actions, waiting items, rollover groups)
- Each finding shows type label, subject (task/project name), and reason
- Action section: shows recommended actions with type and title
- "Apply recommendations" button that calls the apply endpoint
- Success/empty states with appropriate illustrations

## Gap 2: Waiting / Scheduled / Someday Status Views

**Priority: MEDIUM — users filter by these statuses frequently.**

The sidebar currently has: home, triage, all, today, upcoming, completed. Missing: waiting, scheduled, someday.

### Implementation:
- Add `"waiting" | "scheduled" | "someday"` to `WorkspaceView` type in `Sidebar.tsx`
- Add sidebar nav items for each (below "Completed")
- In `AppShell.tsx`, filter todos for these views:
  - `waiting`: `active.filter(t => t.status === "waiting")`
  - `scheduled`: `active.filter(t => t.status === "scheduled")`
  - `someday`: `active.filter(t => t.status === "someday")`
- Render using the existing `SortableTodoList` component
- Show count badges on sidebar items

## Gap 3: Advanced Filtering

**Priority: MEDIUM — power users rely on multi-criteria filters.**

The vanilla app has a rich filter pipeline. The React app only has status views + project selection + search bar.

### Implementation:
- Create `client-react/src/components/todos/FilterBar.tsx`
- Filter dimensions:
  - **Priority**: low / medium / high / urgent (multi-select chips)
  - **Energy**: low / medium / high (multi-select chips)
  - **Due date range**: overdue / today / this week / this month / no due date
  - **Tags**: text chips from existing tag values
- Mount FilterBar above the todo list in the "all", "today", "upcoming" views
- Filter state can be local to AppShell (lifted state) or a lightweight context
- Filters should compose with the existing search bar and project selection
- Clear all button to reset filters

## Gap 4: Dark Mode Persistence

**Priority: LOW — polish, but noticeable.**

The React app has `useDarkMode()` hook and toggle. Check if it:
1. Persists preference to localStorage
2. Respects `prefers-color-scheme` media query as default
3. Applies `class="dark"` or equivalent on `<html>` element

If any of these are missing, fix them. The vanilla app uses `body.dark-mode` class.

## Gap 5: Playwright E2E Tests for React App

**Priority: HIGH — can't ship without test coverage.**

Currently only `tests/ui-react/react-smoke.spec.ts` exists (minimal smoke test).

### Implementation:
- Create test files in `tests/ui-react/` mirroring the key flows:
  - `home-dashboard.spec.ts` — home view renders, brief card shows, focus suggestions load
  - `task-crud.spec.ts` — create task, edit task, complete task, delete task
  - `sidebar-navigation.spec.ts` — navigate between views, project selection works
  - `weekly-review.spec.ts` — weekly review flow end-to-end (once Gap 1 is built)
- Use the same Playwright patterns from `tests/ui/helpers/` — adapt for React app's URL/port
- Use `page.getByRole()`, `page.getByTestId()` for selectors
- Do NOT use `page.waitForTimeout()` — use proper DOM-ready waits
- The React app runs on a different port than vanilla — check `vite.config.ts` for the dev port

## Constraints

- Do NOT modify files in `client/` (vanilla JS app) — it's frozen
- Do NOT modify backend files in `src/` unless a new API endpoint is genuinely needed
- Do NOT add npm dependencies to the root `package.json` — only to `client-react/package.json` if needed
- Follow existing React app patterns: functional components, hooks, TypeScript strict mode
- Use existing CSS class naming conventions from `client-react/src/styles/app.css`
- Keep components focused — extract sub-components when a file exceeds ~300 lines

## Execution Order

1. Weekly Review (Gap 1) — most impactful missing feature
2. Status views (Gap 2) — quick win, small scope
3. Advanced filtering (Gap 3) — builds on Gap 2
4. Dark mode persistence (Gap 4) — quick polish
5. Playwright tests (Gap 5) — after features are stable

After each gap, run `cd client-react && npx tsc --noEmit && npm run build` to verify.
