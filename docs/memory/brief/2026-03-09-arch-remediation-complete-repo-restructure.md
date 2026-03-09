# Brief Entry — 2026-03-09: Architecture Remediation Complete + Repo Restructure

## What Changed

### Architecture Remediation — All 10 tasks complete (PRs #179–#188)

The full arch review backlog identified in early March 2026 is now done:

| PR | Task | What |
|----|------|------|
| #179 | 146 | Debounce input-triggered filter/render calls (DEBOUNCE_MS=250) |
| #180 | 142 | Replace all native confirm()/prompt() with styled ConfirmDialog/InputDialog |
| #181 | 140 | Split app.js monolith into ES6 modules + store.js shared state |
| #182 | 141 | Centralize all mutable UI state into store.js state object |
| #183 | 143 | DialogManager singleton — focus trap, Escape routing, aria-modal |
| #184 | 147 | Delete 3,833 duplicate lines from app.js (dead code after module split) |
| #185 | 145 | EventBus pub-sub pattern — state mutations dispatch events, renderers subscribe |
| #186 | 148 | Second module extraction — 6 new domain modules (featureFlags, authUi, railUi, quickEntry, homeDashboard, aiWorkspace) |
| #187/188 | 144 | Server-backed filter queries — project/dateView/search now execute in Postgres via Prisma |
| #189 | 149 | Third module extraction — 7 new domain modules (adminUsers, dragDrop, shortcuts, commandPalette, taskDrawerAssist, onCreateAssist, todayPlan) |

### Repo Restructure (PRs #190–#191)

- Task 150: `public/` renamed to `client/` with subdirectories:
  - `client/modules/` — 19 domain JS modules
  - `client/utils/` — 8 shared utility files
  - `client/` root — app.js, index.html, styles.css, service-worker.js
- `src/` organized into subdirectories:
  - `src/services/` — 15 backend service files
  - `src/middleware/` — authMiddleware, adminMiddleware
  - `src/validation/` — authValidation, validation, aiValidation, aiContracts
- `src/app.ts` static path updated: `../public` → `../client`
- `package.json` lint globs updated to `client/**/*.html`

## Current app.js State

app.js journey:
- Original: 13,918 lines (monolith)
- After Task 147: 10,085 lines
- After Task 148: 5,423 lines
- After Task 149: 1,975 lines (thin orchestrator — imports + window registrations + init)

29 focused JS modules now exist in `client/modules/` and `client/utils/`.

## Active Architecture Patterns (updated)

- ES6 modules throughout — all domain logic is in named modules, no globals except window registrations
- `store.js` is the shared mutable state hub — all modules import `{ state, hooks }` from store.js; store.js imports nobody
- Import DAG: store.js ← domain modules ← app.js
- EventBus pub-sub: state mutations dispatch events, renderers subscribe — applyFiltersAndRender() is never called directly
- DialogManager singleton: all overlays (12 surfaces) wired through open()/close()/closeAll() with focus trap and Escape routing
- Server-side filtering: project, dateView, search all execute in Postgres; client filterTodosList() is a thin post-processor for heading grouping only
- Debounce: all input/keyup handlers that trigger filterTodos() use DEBOUNCE_MS=250

## Key Invariants Added This Sprint

- store.js imports from nobody — circular imports are structurally impossible
- diff-before-delete discipline: when extracting functions to modules, always diff app.js version vs module version before deleting — Tasks 141/143/144/145 modified app.js after initial extraction, causing 5 staleness bugs caught in Task 147
- tsc --noEmit after each module batch extraction (not after all at once)
- Codex review caught one API contract field name mismatch in aiWorkspace.js (aiFeedbackSummary.total vs .totalRated) — fixed before merge

## Next Feature Backlog (docs/next-enhancements.md)

- M1: AI Plan Review UX — editable draft rows, select/deselect, apply guards (not started)
- M2: Task Critic Evolution — feature-flagged structured panel, granular apply (not started)
- M3: Calendar export (.ics) — export filtered due-dated todos client-side (not started)
