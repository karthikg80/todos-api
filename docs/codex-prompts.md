# Codex Implementation Prompts

## M1 - AI Draft Review UI + Apply Integration
```text
Implement M1 incrementally (planning-safe, no frameworks): upgrade the existing AI plan panel so users can edit/select tasks before apply.

Work style:
- Keep changes small and split into 2-3 commits.
- Reuse existing patterns: `data-on*` declarative handlers, in-memory draft state in `public/app.js`, existing `showMessage/hideMessage`, existing `apiCall/parseApiBody`.

Files to touch:
- public/app.js
- public/styles.css
- public/index.html (only if a container tweak is needed)

Exact UI behaviors and states:
1. In `aiPlanPanel`, render each AI task as a draft row with:
   - include checkbox (checked by default)
   - editable title (required)
   - editable description
   - editable due date
   - editable project/category select (reuse existing project option helpers)
   - editable priority select
2. Add panel actions:
   - Select all
   - Select none
   - Reset draft
   - Apply selected tasks
   - Dismiss
3. Keep feedback reason input; submit it on accept/reject.
4. Apply flow:
   - block if no tasks selected
   - block rows with empty title and show actionable error
   - apply only selected rows
   - on success show count created and clear panel state
5. Button state handling:
   - disable Generate/Apply/Dismiss during in-flight requests
   - prevent duplicate submissions
6. Keep existing 429 usage handling and AI insights refresh behavior.
7. Low-risk accessibility polish:
   - ensure status message region is announced (aria-live)
   - add minimal modal semantics for the existing edit modal (no full refactor)

Acceptance criteria:
- Users can edit/select tasks and only selected tasks are created.
- Empty selection or invalid rows cannot be applied.
- Plan panel clears on apply or dismiss.
- No regressions in todo add/edit/filter/bulk actions.
- Visual style stays consistent with current cards/buttons.

Verification steps:
Manual:
- Generate plan -> uncheck some rows -> edit remaining -> apply -> confirm created todos match edits.
- Try apply with zero selected -> confirm warning and no API apply call.
- Click Apply rapidly -> confirm single request path.
- Dismiss suggestion -> panel clears and usage/history refresh.

Scripts (use only if available):
- npm run test:ui
- npm run test:unit
- npm run lint:css
- npm run lint:html
```

---

## TASK 153 — Centralize localStorage keys

```
Read CLAUDE.md before doing anything.

Execute TASK 153: extract all scattered localStorage key string constants into
a single client/utils/storageKeys.js module. Pure extraction — no behavior changes.

## What this task does

localStorage keys are currently defined as module-local constants across 5 modules:
- railUi.js: PROJECTS_RAIL_COLLAPSED_STORAGE_KEY, AI_WORKSPACE_COLLAPSED_STORAGE_KEY, AI_WORKSPACE_VISIBLE_STORAGE_KEY
- quickEntry.js: QUICK_ENTRY_PROPERTIES_OPEN_STORAGE_KEY
- homeDashboard.js: HOME_TOP_FOCUS_CACHE_KEY
- onCreateAssist.js: AI_ON_CREATE_DISMISSED_STORAGE_KEY
- featureFlags.js: inline strings "feature.enhancedTaskCritic", "feature.taskDrawerDecisionAssist"
- store.js: inline string "feature.taskDrawerDecisionAssist"
- drawerUi.js: dynamic key via taskDrawerDismissKey(todoId) function

## Steps

1. Audit first: run
     grep -rn "getItem\|setItem" client/modules/*.js
   and confirm the full list of keys. Verify none were missed.

2. Create client/utils/storageKeys.js:

```js
// storageKeys.js — Central registry of all localStorage key strings.
// Import STORAGE_KEYS from here rather than hardcoding strings inline.
export const STORAGE_KEYS = {
  PROJECTS_RAIL_COLLAPSED:      "todos:projects-rail-collapsed",
  AI_WORKSPACE_COLLAPSED:       "todos:ai-collapsed",
  AI_WORKSPACE_VISIBLE:         "todos:ai-visible",
  QUICK_ENTRY_PROPERTIES_OPEN:  "todos:quick-entry-properties-open",
  HOME_TOP_FOCUS_CACHE:         "todos:home-top-focus-cache",
  AI_ON_CREATE_DISMISSED:       "todos:ai-on-create-dismissed",
  FEATURE_ENHANCED_TASK_CRITIC: "feature.enhancedTaskCritic",
  FEATURE_TASK_DRAWER_ASSIST:   "feature.taskDrawerDecisionAssist",
  TASK_DRAWER_DISMISSED_PREFIX: "todos:task-drawer-dismissed:",
};
```

3. Update each consumer — import and use STORAGE_KEYS.*:

   railUi.js:
     Remove the 3 local const definitions.
     Add: import { STORAGE_KEYS } from "../utils/storageKeys.js";
     Replace each constant name with STORAGE_KEYS.PROJECTS_RAIL_COLLAPSED etc.

   quickEntry.js:
     Remove QUICK_ENTRY_PROPERTIES_OPEN_STORAGE_KEY const.
     Add import, use STORAGE_KEYS.QUICK_ENTRY_PROPERTIES_OPEN.

   homeDashboard.js:
     Remove HOME_TOP_FOCUS_CACHE_KEY const.
     Add import, use STORAGE_KEYS.HOME_TOP_FOCUS_CACHE.

   onCreateAssist.js:
     Remove AI_ON_CREATE_DISMISSED_STORAGE_KEY const.
     Add import, use STORAGE_KEYS.AI_ON_CREATE_DISMISSED.

   featureFlags.js:
     Replace inline strings "feature.enhancedTaskCritic" and "feature.taskDrawerDecisionAssist"
     with STORAGE_KEYS.FEATURE_ENHANCED_TASK_CRITIC and STORAGE_KEYS.FEATURE_TASK_DRAWER_ASSIST.
     Add import.

   store.js:
     Replace inline "feature.taskDrawerDecisionAssist" with STORAGE_KEYS.FEATURE_TASK_DRAWER_ASSIST.
     Add import.

   drawerUi.js:
     Replace the inline prefix string in taskDrawerDismissKey:
       return `todos:task-drawer-dismissed:${todoId}`;
     becomes:
       return `${STORAGE_KEYS.TASK_DRAWER_DISMISSED_PREFIX}${todoId}`;
     Add import.

4. Do NOT add authSession keys (authToken, refreshToken, user) — those belong to AppState.

5. Update docs/memory/brief/BRIEF.md Open Tech Debt section — mark storageKeys item resolved.
   Update docs/next-enhancements.md similarly.

## Critical constraint
Key string VALUES must not change — any change breaks existing user preferences stored
in their browsers. Only the constant names and their location change.

## Verification

Run ALL checks — all must pass:
  npx tsc --noEmit
  npm run lint:html
  npm run lint:css
  npm run test:unit
  CI=1 npm run test:ui:fast

Also verify manually:
  - App loads, sidebar collapsed state persists on reload
  - Quick entry properties open state persists
  - Feature flags readable via localStorage override

## Branch
  BRANCH=codex/task-153-centralize-localstorage-keys
  Base from master.

## Deliverable
Open a PR. Fill in Deliverable and Outcome sections of
docs/agent-queue/tasks/green/153-centralize-localstorage-keys.md.
Set status: DONE.
```

---

## TASK 154 — Reduce hooks.renderTodos sweep coupling

```
Read CLAUDE.md before doing anything.

Execute TASK 154: replace direct hooks.renderTodos?.() calls in domain modules
with EventBus.dispatch("todos:changed") so modules signal state changes rather
than commanding render sweeps. Pure wiring change — behavior identical.

## Background

app.js currently wires:
  hooks.renderTodos = () => EventBus.dispatch("todos:render");
  EventBus.subscribe("todos:changed", applyFiltersAndRender);
  EventBus.subscribe("todos:render", renderTodos);

Domain modules call hooks.renderTodos?.() directly — ~71 calls total.
This creates coupling where business logic commands render sweeps.

The fix: modules dispatch EventBus.dispatch("todos:changed", { reason }) instead.
Since todos:changed already routes to applyFiltersAndRender, behavior is unchanged.

## Steps

### Step 1: Audit (no code changes yet)
Run: grep -rn "hooks.renderTodos" client/modules/
Produce a count per file. Expected:
  todosService.js: ~17
  filterLogic.js: ~10
  projectsState.js: ~9
  drawerUi.js: ~14
  (others may have additional)

### Step 2: Extract EventBus to its own module
EventBus is currently defined inline in app.js (~line 410).
Extract the exact definition to client/modules/eventBus.js:

```js
// eventBus.js — Minimal pub-sub for decoupled state→render wiring.
export const EventBus = (() => {
  const subscribers = {};
  return {
    subscribe(event, fn) {
      if (!subscribers[event]) subscribers[event] = [];
      subscribers[event].push(fn);
    },
    dispatch(event, payload) {
      (subscribers[event] || []).forEach((fn) => fn(payload));
    },
  };
})();
```

In app.js: remove the inline EventBus definition and add:
  import { EventBus } from "./modules/eventBus.js";

### Step 3: Replace hooks.renderTodos?.() calls in domain modules
In each domain module, replace:
  hooks.renderTodos?.();
with:
  EventBus.dispatch("todos:changed", { reason: "<descriptive-reason>" });

Add import to each module:
  import { EventBus } from "./eventBus.js";

Reason strings should be descriptive:
  After todo add: { reason: "todo-added" }
  After todo delete: { reason: "todo-deleted" }
  After todo toggle: { reason: "todo-toggled" }
  After project change: { reason: "project-selected" }
  (use your judgment for context-specific reasons)

### Step 4: Clean up app.js
After step 3, check if any caller of hooks.renderTodos remains.
If none remain:
  Remove the line: hooks.renderTodos = () => EventBus.dispatch("todos:render");
  Remove the subscription: EventBus.subscribe("todos:render", renderTodos);
Keep: EventBus.subscribe("todos:changed", applyFiltersAndRender);

### Step 5: Do NOT change these hooks — they render specific sub-surfaces:
  hooks.renderProjectsRail?.()
  hooks.renderTodayPlanPanel?.()
  hooks.renderHomeDashboard?.()
  hooks.renderProjectHeadingCreateButton?.()
  hooks.renderOnCreateAssistRow?.()
  Any hooks.render* that is NOT hooks.renderTodos

### Step 6: Update docs
Update docs/memory/brief/BRIEF.md Active Architecture Patterns:
Change the EventBus description to reflect that domain modules now dispatch
todos:changed events and hooks.renderTodos no longer exists.

## Verification

Run ALL checks — all must pass:
  npx tsc --noEmit
  npm run test:unit
  CI=1 npm run test:ui:fast

Manual smoke test:
  - Add a todo: list updates
  - Complete a todo: list updates
  - Delete a todo: list updates
  - Switch project: list filters correctly
  - Search: list filters correctly
  Run: grep -rn "hooks.renderTodos" client/modules/ → must return 0 results

## Constraints
- Behavior must be identical — pure wiring change
- Each dispatch must have a meaningful reason string
- hooks.render* for non-todos surfaces must remain unchanged
- BLOCKED if any todo mutation stops triggering re-render
- BLOCKED if touches >12 files

## Branch
  BRANCH=codex/task-154-reduce-hooks-render-sweep-coupling
  Base from master.

## Deliverable
Open a PR. Fill in Deliverable and Outcome sections of
docs/agent-queue/tasks/yellow/154-reduce-hooks-render-sweep-coupling.md.
Set status: DONE.
```

---

## TASK 155 — DOM boundary discipline in filterLogic.js

```
Read CLAUDE.md before doing anything.

Execute TASK 155: make filterLogic.js self-documenting about its DOM coupling
policy, and ensure no pure logic function contains an inline getElementById.
Zero behavior changes.

## Background

filterLogic.js is the single filter entry point. It currently reaches into the
DOM from both view-controller glue functions (acceptable) and from pure logic
functions (not acceptable — makes testing harder).

The goal is NOT to remove all DOM access from filterLogic.js — that would be
a framework-level refactor. The goal is to:
1. Document where DOM coupling is intentional vs accidental
2. Ensure pure logic functions (sort, filter, compute) accept values as parameters
3. Group intentional DOM functions in a clearly marked section

## Steps

### Step 1: Audit (no code changes yet)
Run: grep -n "getElementById\|querySelector" client/modules/filterLogic.js

For each result, classify:
  A) Reading an input VALUE used in logic (searchInput.value, categoryFilter.value)
  B) Manipulating a display element (classList, innerHTML, hidden, setAttribute)
  C) Pure logic function that incidentally queries DOM

Document the classification before touching anything.

### Step 2: Add module-level JSDoc to filterLogic.js

At the very top of filterLogic.js (after existing header comment), add:

```js
/**
 * filterLogic.js — Filter/sort entry point and project selection API.
 *
 * DOM Coupling Policy:
 * Functions in the "DOM Boundary Layer" section below intentionally read or
 * write DOM elements. This is acceptable for view-controller glue.
 *
 * Functions OUTSIDE that section must not contain getElementById/querySelector.
 * Pass values as parameters instead so they remain unit-testable.
 */
```

### Step 3: Add DOM Boundary Layer section comment

Find the cluster of functions that intentionally touch DOM
(getSearchInputValue, getSelectedProjectFilterValue, setSelectedProjectKey,
updateTodosListHeader, clearFilters, and similar).

Add this section divider above the first of them:
```js
// =============================================================================
// DOM Boundary Layer — functions below intentionally read/write DOM elements.
// This is acceptable view-controller glue. Do not add getElementById calls
// outside this section.
// =============================================================================
```

### Step 4: Fix any Category C violations

If Step 1 found any pure logic/sorting/filtering functions (e.g. sortTodos,
filterTodosList, getVisibleTodos) that contain getElementById:
- Extract the DOM read to a parameter
- Update the single caller in app.js or filterLogic.js to read the value and pass it

If NO Category C violations exist, document this explicitly: "Audit found no
pure logic functions with getElementById — only view-controller glue functions."

### Step 5: Mark intentional DOM readers with inline comments

For each function in the DOM Boundary Layer that reads an input value, add a
one-line comment above the getElementById call:
  // DOM read: intentional boundary — reads current filter state from DOM

## Verification

Run ALL checks — all must pass:
  npm run test:unit
  CI=1 npm run test:ui:fast

Manual smoke:
  - Search works
  - Project filter works
  - Date view switching works
  - Clear filters works

Post-task audit:
  grep -n "getElementById" client/modules/filterLogic.js
  → All results should be inside the DOM Boundary Layer section

## Constraints
- Zero behavior changes
- Touch only filterLogic.js and app.js (call site updates only if params added)
- Do not introduce new abstractions
- BLOCKED if any filter behavior changes
- BLOCKED if touches >2 files

## Branch
  BRANCH=codex/task-155-dom-boundary-discipline-filterlogic
  Base from master.

## Deliverable
Open a PR. Include the Step 1 audit output in the PR description.
Fill in Deliverable and Outcome sections of
docs/agent-queue/tasks/yellow/155-dom-boundary-discipline-filterlogic.md.
Set status: DONE.
```

---

## TASK 150 — Folder Restructure (client/ + src/ reorganization)

```
Read CLAUDE.md before doing anything.

Execute TASK 150: reorganize the repository folder structure as specified below.
This is a pure file-move refactor — no logic changes, no new code.

## What this task does

Three changes:
1. Rename public/ → client/ and create subdirectories modules/ and utils/
2. Organize src/ flat files into services/, middleware/, validation/ subdirectories
3. Update all references to the moved paths

---

## Part 1 — client/ restructure

### Create new directory structure
  client/
    modules/     ← domain JS modules
    utils/       ← shared utility JS files
    vendor/      ← already exists, move as-is

### Move rules for public/ → client/

Files to move into client/modules/:
  store.js, todosService.js, projectsState.js, filterLogic.js,
  drawerUi.js, overlayManager.js, featureFlags.js, authUi.js,
  railUi.js, quickEntry.js, homeDashboard.js, aiWorkspace.js,
  adminUsers.js, dragDrop.js, shortcuts.js, commandPalette.js,
  taskDrawerAssist.js, onCreateAssist.js, todayPlan.js

Files to move into client/utils/:
  utils.js, apiClient.js, projectPathUtils.js, lintHeuristics.js,
  icsExport.js, aiSuggestionUtils.js, theme.js, state.js

Files to move into client/ root (not in a subdirectory):
  app.js, index.html, styles.css, service-worker.js,
  favicon.svg, bimi-logo.svg

Move vendor/ directory as-is to client/vendor/

### Update import paths in all moved JS files
After moving, every import statement that references a peer module must
be updated to reflect the new relative path. For example:
  - app.js imports from modules: "./store.js" → "./modules/store.js"
  - modules import from each other: "./filterLogic.js" → "./filterLogic.js" (unchanged, same dir)
  - modules import from utils: "./apiClient.js" → "../utils/apiClient.js"
  - utils import from store: "./store.js" → "../modules/store.js"

Before moving anything, produce the complete import graph:
  grep -rn "^import" public/*.js
This tells you exactly which files import which — use it to update paths correctly.

---

## Part 2 — src/ restructure

### Create new subdirectories
  src/services/
  src/middleware/
  src/validation/

### Move rules for src/

Files to move into src/services/:
  todoService.ts, prismaTodoService.ts, prismaHeadingService.ts,
  projectService.ts, headingService.ts, authService.ts,
  aiService.ts, aiApplyService.ts, aiDismissService.ts,
  aiQuotaService.ts, aiSuggestionStore.ts, aiNormalizationService.ts,
  decisionAssistTelemetry.ts, decisionAssistThrottle.ts,
  emailService.ts

Files to move into src/middleware/:
  authMiddleware.ts, adminMiddleware.ts

Files to move into src/validation/:
  authValidation.ts, validation.ts, aiValidation.ts, aiContracts.ts

Files that stay at src/ root:
  app.ts, server.ts, config.ts, types.ts, errorHandling.ts,
  prismaClient.ts, swagger.ts
  (plus interfaces/, routes/, generated/ subdirs — unchanged)

### Update all TypeScript imports after moving
Every file that imports from a moved file needs its import path updated.
Use tsc --noEmit after each batch to catch broken imports immediately.

---

## Part 3 — Update external references

After all files are moved, update these specific references:

1. src/app.ts — static file serving path:
   Change: path.join(__dirname, "../public")
   To:     path.join(__dirname, "../client")

2. package.json — lint scripts:
   Change: "public/**/*.html"  →  "client/**/*.html"
   (two scripts: lint:css and lint:html)

3. index.html — all <script src=...> and import paths:
   Update any src paths that reference module files to use modules/ prefix
   Update any src paths that reference util files to use utils/ prefix

4. service-worker.js — if it caches any file paths, update them

5. playwright.config.ts and any test files in tests/ui/ —
   if they reference public/ paths, update to client/

6. .gitignore, .railwayignore — if they reference public/, update to client/

---

## Execution order

1. Audit: run `grep -rn "^import" public/*.js` and produce the full import graph
2. Move src/ files into services/, middleware/, validation/ subdirs
3. Run npx tsc --noEmit — fix any broken imports before proceeding
4. Create client/ directory structure
5. Move public/ files to client/ following move rules above
6. Update all import paths in moved JS files
7. Update external references (src/app.ts, package.json, index.html, etc.)
8. Delete the now-empty public/ directory
9. Run all verification checks

---

## Verification

Run ALL checks — all must pass:
  npx tsc --noEmit
  npm run format:check
  npm run lint:html
  npm run lint:css
  npm run test:unit
  CI=1 npm run test:ui:fast

Also verify manually:
  - App loads in browser (index.html served correctly from client/)
  - No 404s for JS module imports in browser devtools network tab
  - npm run dev starts without errors

---

## Constraints
- No logic changes of any kind — pure file moves and path updates
- No new npm dependencies
- Do NOT move test files (*.test.ts) — they stay co-located with source
- Do NOT move src/generated/ or src/interfaces/ or src/routes/ — already organized
- BLOCKED if any circular import is introduced
- BLOCKED if app fails to load in browser after restructure
- tsc --noEmit must pass after EACH part (after src/ moves, after client/ moves)

## Branch
  BRANCH=codex/task-150-folder-restructure
  Base from master.

## Deliverable
Open a PR and provide handoff summary including:
  - Complete list of files moved
  - All import paths updated
  - All external references updated
  - PASS/FAIL matrix
```

---

## TASK 151 — Clarify state.js vs store.js naming

```
Read CLAUDE.md before doing anything.

Execute TASK 151: resolve the confusing state.js / store.js naming by renaming state.js to authSession.js.
This is a pure rename + comment pass — no logic changes.

## What this task does

Two files have misleadingly similar names:
- client/utils/state.js — IIFE script that wraps localStorage auth session (token, refreshToken, user). Exposes window.AppState.
- client/modules/store.js — ES6 module exporting { state, hooks } — the shared runtime UI state object.

They are architecturally clean and completely separate concerns. The task makes the names reflect that.

## Steps

1. Rename client/utils/state.js → client/utils/authSession.js
   - git mv client/utils/state.js client/utils/authSession.js

2. Update client/index.html:
   - Find: src="/utils/state.js"
   - Replace: src="/utils/authSession.js"

3. Update comments in client/app.js that reference utils/state.js:
   - Two comment lines reference utils/state.js — update to utils/authSession.js

4. Add clarifying top comment to client/utils/authSession.js (first line after the opening):
   // Auth session persistence — localStorage read/write for token, refreshToken, user. Exposes window.AppState.

5. Add clarifying top comment to client/modules/store.js (after the existing header block):
   // Runtime UI state module — exports { state, hooks }. All domain modules import from here. Do not import from authSession.js.

6. Update docs/memory/brief/BRIEF.md — in the Open Tech Debt section, replace:
   "- `state.js` vs `store.js` overlap — relationship never formally resolved"
   with:
   "- ~~`state.js` vs `store.js` overlap~~ resolved in Task 151 (renamed to authSession.js)"

7. Update docs/next-enhancements.md similarly.

## Verification

Run ALL checks — all must pass:
  npm run lint:html
  npm run lint:css
  npm run test:unit
  CI=1 npm run test:ui:fast

Also verify manually:
  - App loads in browser with no 404 for authSession.js in network tab
  - Login/logout flow works (window.AppState.persistSession is available)
  - Console is clean on app load

## Constraints
- Pure rename + comment only — zero logic changes
- window.AppState interface must remain exactly unchanged
- Do not rename store.js
- Files to touch: client/utils/state.js (rename), client/index.html, client/app.js, client/modules/store.js (comment only), docs/memory/brief/BRIEF.md, docs/next-enhancements.md
- BLOCKED if any auth behavior changes
- BLOCKED if touches >6 files

## Branch
  BRANCH=codex/task-151-clarify-state-vs-store-naming
  Base from master.

## Deliverable
Open a PR. Fill in the Deliverable and Outcome sections of docs/agent-queue/tasks/yellow/151-clarify-state-vs-store-naming.md.
Set status: DONE.
```

---

## TASK 152 — Extract rate-limit middleware

```
Read CLAUDE.md before doing anything.

Execute TASK 152: extract the inline rate-limit configuration from src/app.ts into src/middleware/rateLimitMiddleware.ts.
This is a pure extraction — no behavior changes.

## What this task does

src/app.ts currently defines three rate limiters inline (around lines 155–195):
- authLimiter: 5 req / 15 min → applied to /auth routes
- emailActionLimiter: 20 req / 15 min → applied to email action routes
- apiLimiter: 100 req / 15 min → applied to /api, /todos, /users, /ai, /projects

All three use express-rate-limit (already installed). The isTest bypass
(process.env.NODE_ENV === 'test' → noLimit passthrough) is also inline.

This task moves them to the middleware layer where they belong.

## Steps

1. Read src/app.ts lines 150–200 to understand the exact current limiter definitions.
   Read src/middleware/authMiddleware.ts to understand the existing export pattern.

2. Create src/middleware/rateLimitMiddleware.ts:
   - Import rateLimit from express-rate-limit and RequestHandler from express
   - Reproduce the isTest constant (process.env.NODE_ENV === 'test')
   - Reproduce the noLimit passthrough handler
   - Export authLimiter, emailActionLimiter, apiLimiter with identical config to current inline versions
   - Add JSDoc block at top:
     /**
      * Rate limit middleware.
      * authLimiter:        5 req / 15 min — applied to /auth routes
      * emailActionLimiter: 20 req / 15 min — applied to email action routes
      * apiLimiter:         100 req / 15 min — applied to /api, /todos, /users, /ai, /projects
      * All limiters are bypassed when NODE_ENV=test.
      */

3. Update src/app.ts:
   - Add import: import { authLimiter, emailActionLimiter, apiLimiter } from './middleware/rateLimitMiddleware';
   - Remove the inline isTest, noLimit, authLimiter, emailActionLimiter, apiLimiter definitions
   - Keep all app.use() calls exactly as they are (only the definitions move, not the usage)

4. Update docs/memory/brief/BRIEF.md — in the Open Tech Debt section, replace:
   "- API rate limiting — no middleware exists on Express layer"
   with:
   "- ~~API rate limiting~~ resolved in Task 152 (extracted to rateLimitMiddleware.ts)"

5. Update docs/next-enhancements.md similarly.

## Verification

Run ALL checks — all must pass:
  npx tsc --noEmit
  npm run format:check
  npm run test:unit
  CI=1 npm run test:ui:fast

## Constraints
- Pure extraction — zero behavior changes
- Rate limit values and window durations must be identical to current
- isTest bypass logic must be preserved in rateLimitMiddleware.ts
- Do not introduce any new npm dependencies
- All three limiters must live in the single new file — do not split further
- Files to touch: src/middleware/rateLimitMiddleware.ts (new), src/app.ts, docs/ (2 files)
- BLOCKED if any rate limit values change
- BLOCKED if touches >4 source files

## Branch
  BRANCH=codex/task-152-extract-rate-limit-middleware
  Base from master.

## Deliverable
Open a PR. Fill in the Deliverable and Outcome sections of docs/agent-queue/tasks/yellow/152-extract-rate-limit-middleware.md.
Set status: DONE.
```

---

## TASK 144 — Server-Side Filter/Sort/Aggregate (Red · backend)

```
Read docs/agent-queue/tasks/red/144-server-side-filter-sort-aggregate.md in full
before doing anything. Then read CLAUDE.md and src/routes/todosRouter.ts.

Execute TASK 144 exactly as specified.

## Context

prismaTodoService.ts already handles server-side filtering for completed,
priority, category, sortBy, and sortOrder via Prisma where and orderBy.

What remains client-side in public/filterLogic.js (filterTodosList function):
1. Project filtering — state.selectedProjectKey filters the returned array
2. Date view filtering — state.currentDateView (today/upcoming/someday/month)
   filters by todo.dueDate ranges client-side
3. Full-text search — searchInput value matched against title/description/category
4. Heading grouping — todos grouped under project headings client-side

The goal is to move 1, 2, and 3 to the server. Heading grouping (4) stays
client-side as it is a rendering concern, not a data concern.

## Steps

### 1. Audit first — no code changes yet
Read src/prismaTodoService.ts lines 140–200 to understand the existing
getTodos(userId, query) interface.
Read src/routes/todosRouter.ts to see what query params are accepted today.
Read public/filterLogic.js lines 234–280 (filterTodosList) to map every
client-side filter condition.
Produce a gap analysis: which filters are already server-side vs which need adding.

### 2. Extend the backend query contract
In src/types.ts (or wherever TodoQuery is defined), add:
  - projectName?: string        — filter by project
  - dateView?: 'today' | 'upcoming' | 'month' | 'someday' | 'all'
  - search?: string             — full-text search on title, description, category

In src/prismaTodoService.ts, extend the getTodos where clause:
  - projectName: where.project = projectName
  - dateView: translate to Prisma where.dueDate range conditions
    - today: dueDate >= start of today AND < start of tomorrow
    - upcoming: dueDate >= start of tomorrow AND <= end of next 7 days
    - month: dueDate in current calendar month
    - someday: dueDate IS NULL
    - all: no dueDate filter
  - search: use Prisma OR with contains (case-insensitive mode) on
    title, description, category

In src/routes/todosRouter.ts, expose the three new query params and pass
them through to the service.

### 3. Update the frontend coordinator
In public/filterLogic.js, update filterTodos():
  - Build a query object from current state:
    { projectName, dateView, search, sortBy, sortOrder, completed, priority }
  - Pass it as query params to the API fetch in apiClient.js
  - Remove the array-filtering logic from filterTodosList that is now server-side
  - Keep filterTodosList as a pass-through or thin post-processor for
    any purely rendering-side concerns (e.g. heading grouping)

Also update public/apiClient.js to serialize the new query params.

### 4. Integration tests
For each new filter type, add a test in src/prismaTodoService.test.ts:
  - projectName filter returns only todos for that project
  - dateView=today returns only todos due today
  - dateView=someday returns only todos with no dueDate
  - search=foo returns todos matching in title, description, or category
  - Combination: projectName + dateView + search all applied together

### 5. Verification
Run ALL checks:
  npx tsc --noEmit
  npm run format:check
  npm run lint:html
  npm run lint:css
  npm run test:unit
  CI=1 npm run test:ui:fast

All existing filter behaviors must produce identical results to before.

## Constraints
- No Prisma schema changes — use existing schema only
- No new npm dependencies
- Keep filterTodos() and setSelectedProjectKey() as external API contracts
  with unchanged signatures
- Keep response shape backward-compatible OR update frontend atomically in same PR
- Feature flag the new server-side path if any behavioral uncertainty exists:
  readBooleanFeatureFlag('serverSideFiltering') — fall back to client-side if false
- Files allowed: src/todoService.ts, src/prismaTodoService.ts, src/types.ts,
  src/routes/todosRouter.ts, public/filterLogic.js, public/apiClient.js,
  tests/ui/ (test updates only, no rewrites)
- BLOCKED triggers:
  - Any Prisma schema migration required → BLOCKED
  - Client-side filter behavior changes visibly → BLOCKED
  - >12 files touched → BLOCKED

## Branch
  BRANCH=codex/task-144-server-side-filter-sort-aggregate
  Base from master.

## Deliverable
Fill in the Deliverable and Outcome sections of the task file.
Set status: DONE. Open a PR and provide handoff summary including:
  - Which filters moved server-side
  - Which remain client-side and why
  - Feature flag status (on/off by default)
  - PASS/FAIL matrix
```

## M1b (Optional) - Brain Dump -> Shared Draft Review
```text
Implement M1b as an optional extension after M1: add a brain-dump input that reuses the same editable draft review panel.

Work style:
- One focused commit if possible.
- Reuse existing patterns only: `data-on*`, `showMessage`, `apiCall`, existing plan panel renderer/state.

Files to touch:
- public/index.html
- public/app.js
- public/styles.css

Exact UI behaviors and states:
1. Add a multiline "Brain dump" textarea in AI workspace with a button: "Draft Tasks from Brain Dump".
2. Validate non-empty input; show existing error message style when empty.
3. On submit, call existing `/ai/plan-from-goal` endpoint by mapping brain-dump text to the existing `goal` payload field (no backend changes).
4. Reuse existing target date input if filled.
5. Feed response into the same editable draft state/panel from M1 (no duplicate renderer).
6. Add loading/disabled state for the brain-dump button.
7. Keep existing goal-based "Generate Plan" flow unchanged.

Acceptance criteria:
- Brain dump creates editable draft tasks in the same review panel.
- Empty brain dump is blocked with clear feedback.
- Existing goal planner flow still works unchanged.
- UI remains consistent with current AI workspace styling.

Verification steps:
Manual:
- Submit valid brain dump -> edit rows -> apply selected -> verify todos created.
- Submit empty brain dump -> verify validation message.
- Trigger rapid clicks -> verify only one request in flight.

Scripts:
- npm run test:ui
- npm run test:unit
- npm run lint:css
- npm run lint:html
```

## M2 - Task Critic Feature-Flag Scaffold
```text
Implement M2 scaffold only: evolve Task Critic UI behind a front-end feature flag, keeping backend contract unchanged.

Work style:
- Keep default behavior untouched when flag is off.
- Reuse existing critique API and status update functions.

Files to touch:
- public/app.js
- public/styles.css
- public/index.html (only if a dedicated mount element is needed)

Exact UI behaviors and states:
1. Add a front-end flag constant (default false), e.g. `ENABLE_ENHANCED_TASK_CRITIC`.
2. Flag OFF:
   - current critic flow remains exactly as-is.
3. Flag ON:
   - render a structured critic card with sections:
     - quality score
     - suggested title/description
     - suggestions list
     - feedback reason controls (chips + optional text)
     - actions: Apply title only / Apply description only / Apply both / Dismiss
     - collapsed "Future insights" placeholder section (non-functional scaffold)
4. Add loading state for `Critique Draft (AI)` action and stale response guard (ignore out-of-date responses).
5. Preserve existing suggestion status updates and downstream refresh (`loadAiSuggestions`, `loadAiUsage`, `loadAiInsights`, `loadAiFeedbackSummary`).

Acceptance criteria:
- Flag OFF path is unchanged.
- Flag ON path is fully functional with current API responses.
- Apply/dismiss continue to update suggestion status correctly.
- No regression to todo draft entry and add flow.

Verification steps:
Manual:
- Test with flag OFF and ON.
- Generate critique, apply each action variant, and confirm draft fields update correctly.
- Dismiss critique and confirm panel clears + history/usage refresh.

Scripts:
- npm run test:ui
- npm run test:unit
- npm run lint:css
- npm run lint:html
```

## M3 - Calendar Export (.ics) from Filtered Todos
```text
Implement M3: add a client-side `.ics` calendar export for the currently visible (filtered) due-dated todos.

Work style:
- No backend changes.
- Keep implementation local to current todo view and filtering functions.
- Keep commits small (UI control + generator + verification polish).

Files to touch:
- public/index.html
- public/app.js
- public/styles.css

Exact UI behaviors and states:
1. Add an `Export .ics` button near the filter/date-view controls in todos view.
2. Export scope is exactly: current `filterTodosList(todos)` result with `dueDate` present.
3. On click:
   - if no due-dated visible tasks: show warning message and do not download.
   - else generate `.ics` text client-side and trigger file download.
4. ICS event fields per task should include:
   - UID (stable enough per export)
   - DTSTAMP
   - DTSTART (UTC)
   - SUMMARY (task title)
   - DESCRIPTION (description or notes fallback)
5. Add lightweight button busy/disabled state during generation.
6. Add a short helper text: export uses current filters and includes only tasks with due dates.

Reuse existing patterns:
- Call `filterTodosList` rather than duplicating filter logic.
- Use `showMessage` for success/warning/error messages.
- Keep handlers attached via `data-onclick` and existing declarative binding.

Acceptance criteria:
- Valid `.ics` file downloads when due-dated visible tasks exist.
- Export respects project/search/date filters.
- Undated tasks are excluded.
- Empty export path shows warning and no file download.
- Existing todo features are unaffected.

Verification steps:
Manual:
- Export with mixed tasks (dated + undated) and verify only dated tasks in calendar.
- Apply a filter and export again; verify only visible filtered tasks are present.
- Export with no due dates in view; verify warning.

Scripts:
- npm run test:ui
- npm run test:unit
- npm run lint:css
- npm run lint:html
```
