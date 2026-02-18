# TASK 103: lint-first-ai-ux

type: Yellow
status: READY
mode: implement
builder: codex
reviewer: claude
branch: claude/task-103-lint-first-ai-ux
base: master

## Intent *
Replace always-on AI panels and chips with a "lint-first" (silent executor) UX:
show nothing by default; surface exactly one small lint chip when a deterministic
heuristic fires; let Fix/Review expand the existing AI suggestion UI on demand.

## Scope

### `public/app.js`
- Add pure utility functions `lintTodoFields(fields)` and
  `renderLintChip(issue)` near the top of the file (after feature-flag
  declarations, ~line 35).
- Extend `createInitialOnCreateAssistState()` with two new fields:
  `showFullAssist: false` and `lintIssue: null`.
- Gate `renderOnCreateAssistRow()` at its top: if `!state.showFullAssist`,
  render the lint chip only (or nothing) and return early — do not change
  any of the existing rendering logic below that gate.
- Add `data-ai-lint-action` delegation inside the existing main click handler
  block (near line 7344): `"fix"` sets `showFullAssist = true` and calls
  `loadOnCreateDecisionAssist(todo, true)`; `"review"` sets
  `showFullAssist = true` and calls `loadOnCreateDecisionAssist(todo, false)`.
- Gate `renderTaskDrawerAssistSection(todoId)` at its top: if
  `!drawerState.showFullAssist`, render the lint chip only (or hidden div)
  and return early.
- Add `showFullAssist: false` to `resetTaskDrawerAssistState(todoId)` (called
  in `openTodoDrawer()`).
- Add `data-ai-lint-action` delegation inside the existing task-drawer click
  handler to set `drawerState.showFullAssist = true` then call
  `loadTaskDrawerDecisionAssist(todoId)`.
- In `renderTodayPlanPanel()`, remove the auto-load block
  (`if (!hasLoaded && !loading) { loadTodayPlanDecisionAssist(false); }`) so
  the panel no longer fires a network request on first Today view open.
  The "Generate plan" button already wires the user-initiated path.

### `public/styles.css`
- Add `.ai-lint-chip` and child element styles in the AI section (after
  `.ai-create-assist__chips`).

### `tests/ui/lint-chip.spec.ts` (new file)
- Fast-suite tests (no `@visual` tag, no `page.waitForTimeout()`):
  - On-create: vague title → lint chip visible, full assist row hidden.
  - On-create: clean title → no lint chip.
  - On-create: Fix button → full assist row revealed.
  - On-create: urgency language + no due date → `missing_due_date` chip.
  - Task drawer: vague task title → lint chip visible, full AI section hidden.
  - Projects rail: `"AI Plan"` not present (depends on Task 102 or own blocklist
    if 102 has not merged yet).

## Out of Scope
- Changing any server-side AI endpoints or their payloads.
- Modifying `prisma/schema.prisma` or any DB migration.
- Adding new npm dependencies.
- Changing the `filterTodos()` / `setSelectedProjectKey()` pipeline.
- Modifying or deleting existing AI-related tests.
- Visual snapshot regeneration.
- Mobile Playwright tests tagged `@visual`.

## Files Allowed
- `public/app.js`
- `public/styles.css`
- `tests/ui/lint-chip.spec.ts` (new file)

## Acceptance Criteria *
- [ ] Creating a todo with a vague title (e.g. "do stuff") shows exactly one
      lint chip; the full `ai-create-assist__chips` section is hidden.
- [ ] Creating a todo with a clean, specific title (≥5 words, no vague words)
      shows no lint chip and no full assist row.
- [ ] Clicking the **Fix** button on the lint chip triggers
      `loadOnCreateDecisionAssist` with `allowGenerate = true` and reveals the
      full assist row.
- [ ] Clicking the **Review** button triggers `loadOnCreateDecisionAssist` with
      `allowGenerate = false` and reveals the full assist row.
- [ ] Opening a task drawer for a todo with a vague title shows a lint chip in
      the AI Suggestions section; the full `todo-drawer-ai-list` is hidden.
- [ ] Opening a task drawer for a clean todo shows no lint chip and no full AI
      section (collapsed / hidden).
- [ ] Clicking Fix/Review in the drawer reveals the full AI suggestions panel.
- [ ] The Today Plan panel does NOT auto-load suggestions on first open; the
      "Generate plan" button still works.
- [ ] Event delegation patterns in `public/app.js` are not broken (no direct
      listeners on dynamic children).
- [ ] `filterTodos()` and `setSelectedProjectKey(...)` behaviour is unchanged.
- [ ] All existing tests continue to pass (no deletions or weakenings).
- [ ] All checks pass:
      `npx tsc --noEmit && npm run format:check && npm run lint:html &&
       npm run lint:css && npm run test:unit && CI=1 npm run test:ui:fast`

## Constraints
- `lintTodoFields()` must be a **pure function** (no side effects, no DOM
  access, no network calls). It must be covered by at least one unit test or
  be deterministically exercised by the Playwright tests.
- Only **one** lint issue is shown at a time (priority order: title_too_short
  > vague_title > missing_due_date > too_many_highs > big_task_no_subtasks).
- Lint runs against in-memory `todos` array for the "too_many_highs" check;
  no additional API call is needed.
- The existing server-backed AI endpoints (`/ai/decision-assist/stub`,
  `/ai/suggestions/latest`, `/ai/task-critic`) must remain callable and
  reachable — they are just deferred until user requests them.
- No `page.waitForTimeout()` or sleep-based waits in any test.
- New Playwright tests must use `openTodosViewWithStorageState()` or
  `bootstrapTodosContext()` from `tests/ui/helpers/todos-view.ts`.

## MIC-Lite (Yellow/Red)

### Motivation
The current always-on AI panels add noise and network cost on every create and
drawer open. A lint-first model gives users the signal only when relevant,
matching the "silent executor" design principle.

### Impact
- `renderOnCreateAssistRow()` behaviour changes: it now renders a chip instead
  of the full assist row by default. All 18+ call sites are unaffected because
  the gate lives inside the function.
- `renderTaskDrawerAssistSection()` behaviour changes similarly.
- `renderTodayPlanPanel()` no longer fires an auto-load network request on
  first open — this reduces background API calls.
- No existing stored data is modified.
- No existing server-side contract is changed.

### Checkpoints
- [ ] After adding `lintTodoFields` + `renderLintChip`, run
      `npx tsc --noEmit` — must pass before touching render functions.
- [ ] After gating `renderOnCreateAssistRow`, manually verify in browser that:
      (a) vague title shows chip, (b) Fix reveals full row, (c) clean title shows
      nothing.
- [ ] After gating `renderTaskDrawerAssistSection`, verify in browser that
      drawer chip appears for vague tasks.
- [ ] Run `CI=1 npm run test:ui:fast` — must pass before pushing.

## Scope Escalation Triggers
If any of these occur, set status to BLOCKED and request re-approval:
- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new dependency
- Changes cross-module behavior contracts
- Modifies data model (Prisma schema)

## Deliverable
- PR URL
- Commit SHA(s)
- Files changed
- PASS/FAIL matrix

## Outcome *
(filled after completion)
