# TASK 155: dom-boundary-discipline-filterlogic

type: Yellow
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-155-dom-boundary-discipline-filterlogic
base: master

## Intent
Move the direct `document.getElementById` DOM queries out of filterLogic.js pure logic functions and into the app.js wiring layer, so filter/sort logic accepts explicit arguments rather than reaching into the DOM.

## Background
filterLogic.js is the single filter entry point and contains core business logic, but it currently reaches directly into the DOM for input values:

```js
// In getSelectedProjectFilterValue():
const filter = document.getElementById("categoryFilter");

// In getSearchInputValue() / clearFilters():
const searchInput = document.getElementById("searchInput");
const sheetSearch = document.getElementById("searchInputSheet");

// In applyFiltersAndRender() / updateTodosListHeader():
const todosView = document.getElementById("todosView");
const headerEl = document.getElementById("todosListHeader");
// ... etc
```

This means filterLogic.js cannot be unit tested without a full DOM. The fix: functions that need DOM values should accept them as parameters (or be refactored so the caller reads the DOM and passes values in). Pure logic stays pure; DOM reads move to the wiring layer.

## Audit First
Before changing anything, run:
  grep -n "getElementById\|querySelector" client/modules/filterLogic.js

This gives the exact list (expected ~15 callsites). Categorize each as:
- A) Reading an input VALUE to pass to logic (searchInput.value, categoryFilter.value)
- B) Manipulating DOM element directly (classList, innerHTML, hidden)

Category A callsites are the priority target — extract them to the caller.
Category B callsites (direct DOM manipulation of display elements) are acceptable in a view-adjacent module — do NOT change these in this task.

## Scope

### Target functions (Category A — read input values, logic uses them)

1. `getSearchInputValue()` — reads `#searchInput` and `#searchInputSheet`
   - Refactor: keep the function but document it clearly as a "DOM boundary reader". This is acceptable at the top of filterLogic.js.
   - OR: accept `searchValue` as parameter in `getVisibleTodos()` / `applyFiltersAndRender()`, read at call site in app.js.
   - Decision: prefer accepting the value as a parameter where the function is called from app.js. Where called internally, keep the reader helper.

2. `getSelectedProjectFilterValue()` — reads `#categoryFilter`
   - This is already a named function. Document it explicitly as the DOM boundary reader for project selection.
   - Do NOT move it — it's already a clean boundary. Add a comment marking it as intentional DOM coupling.

3. `setSelectedProjectKey()` — reads and writes `#categoryFilter`
   - This is a view-controller function — reads DOM to sync select element. Keep as-is, add comment.

### What this task actually changes

The primary value is **documentation and categorization**, not wholesale refactoring:

1. Add a `// === DOM Boundary Layer ===` comment section at the top of filterLogic.js grouping the functions that intentionally touch the DOM (`getSearchInputValue`, `getSelectedProjectFilterValue`, `setSelectedProjectKey`, `updateTodosListHeader`, `clearFilters`).

2. Move any **pure logic functions** that accidentally contain DOM reads into DOM-free form. Specifically:
   - If `applyFiltersAndRender` reads DOM values for logic decisions, extract those reads into named getter calls at the top of the function body and add `// DOM read` comment.
   - If any function that only computes/filters (no display side effects) contains getElementById, extract the getElementById call to a parameter.

3. Add a module-level JSDoc comment to filterLogic.js:
   ```js
   /**
    * filterLogic.js — Filter/sort entry point and project selection API.
    *
    * DOM Coupling Policy:
    * - Functions in the "DOM Boundary Layer" section intentionally read/write DOM.
    *   These are acceptable as view-controller glue.
    * - Functions outside that section must NOT contain getElementById/querySelector.
    *   Pass values as parameters instead.
    */
   ```

4. Fix the one confirmed violation: `clearFilters()` directly resets DOM input values mid-function. This is fine — document it as intentional DOM reset.

5. If any pure sorting/filtering function (e.g., `sortTodos`, `filterTodosList`, `getVisibleTodos`) contains getElementById, extract that call to a parameter and update callers.

## Out of Scope
- Refactoring all DOM access out of filterLogic.js (that's framework migration territory)
- Changing filter behavior
- Adding abstractions for every DOM element ID
- Touching any other module

## Files Allowed
- `client/modules/filterLogic.js`
- `client/app.js` (only to update call sites if parameters are added)

## Acceptance Criteria
- [ ] filterLogic.js has a module-level JSDoc comment describing DOM coupling policy
- [ ] A `// === DOM Boundary Layer ===` section clearly groups intentional DOM functions
- [ ] No pure logic function (sorting, filtering, computing) contains an inline getElementById
- [ ] All existing filter behaviors work identically
- [ ] `npm run test:unit` passes
- [ ] `CI=1 npm run test:ui:fast` passes

## Constraints
- Zero behavior changes
- Do not touch any file except filterLogic.js and app.js (call site updates only)
- Do not introduce new abstractions or indirection layers
- BLOCKED if any filter, sort, or project selection behavior changes
- BLOCKED if touches >2 files

## MIC-Lite

### Motivation
filterLogic.js is the single filter entry point and will be touched in every future feature sprint. Making the DOM coupling explicit and bounded now prevents future agents and contributors from adding more getElementById calls into pure logic functions, which would progressively make the module untestable.

### Impact
- No behavior change
- filterLogic.js becomes self-documenting about its DOM coupling policy
- Future unit tests can target pure functions without DOM mocking

### Checkpoints
- [ ] Audit output produced before any changes
- [ ] Pure logic functions verified DOM-free after changes
- [ ] All filter/sort/project-select flows work in browser smoke test
- [ ] Test suites pass

## Scope Escalation Triggers
- Touches >2 files → BLOCKED
- Any filter behavior changes → BLOCKED
- New abstraction layer introduced → BLOCKED (out of scope)

## Deliverable
- PR URL: Blocked in sandbox until branch push/PR creation can run against GitHub
- Commit SHA(s): Pending local commit at handoff
- Files changed:
  - `client/modules/filterLogic.js`
  - `docs/agent-queue/tasks/yellow/155-dom-boundary-discipline-filterlogic.md`
- Audit output (before):
  - `41`, `47` in `setDateView()` -> `B`
  - `97` in `syncWorkspaceViewState()` -> `B`
  - `213` in `updateIcsExportButtonState()` -> `B`
  - `270` in `filterTodosList()` -> `C`
  - `330`, `332` in `clearFilters()` -> `B`
  - `339` in `getSelectedProjectFilterValue()` -> `A`
  - `353` in `setSelectedProjectKey()` -> `B`
  - `428`-`432` in `updateHeaderAndContextUI()` -> `B`
  - `745`, `750` in `renderTodos()` -> `B`
- Audit output (after):
  - All inline `getElementById` / `querySelector` callsites are bracketed by `DOM Boundary Layer` section markers.
  - `filterTodosList()` no longer contains an inline DOM query.
  - `getVisibleTodos({ searchQuery })` and `filterTodosList(..., { searchQuery })` now accept explicit search input values.
- PASS/FAIL matrix:
  - PASS `npx tsc --noEmit`
  - PASS `npm run format:check`
  - PASS `npm run lint:html`
  - PASS `npm run lint:css`
  - FAIL `npm run test:unit` -> sandbox blocked `listen EPERM: operation not permitted 0.0.0.0`
  - FAIL `CI=1 npm run test:ui:fast` -> sandbox blocked `listen EPERM: operation not permitted 127.0.0.1:4173`
  - FAIL Manual smoke -> blocked because sandbox disallows starting the local UI server

## Outcome
Added explicit DOM coupling policy documentation to `filterLogic.js`, marked each direct DOM-querying cluster with `DOM Boundary Layer` section dividers, and extracted the one pure-logic violation out of `filterTodosList()` into a boundary reader plus explicit `searchQuery` parameters.

No behavior changes were introduced in the filter pipeline. `app.js` did not need updates because existing callers continue to use the default DOM-backed search query path through `getVisibleTodos()`.

Static verification passed (`tsc`, format, HTML lint, CSS lint). Server-backed verification and manual smoke could not complete in this sandbox because local `listen(...)` calls are rejected with `EPERM`.
