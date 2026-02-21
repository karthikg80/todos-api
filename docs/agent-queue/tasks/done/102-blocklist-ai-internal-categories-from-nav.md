# TASK 102: blocklist-ai-internal-categories-from-nav

type: Green
status: DONE
mode: implement
builder: codex
reviewer: claude
branch: claude/task-102-blocklist-ai-internal-categories-from-nav
base: master

## Intent *
Prevent machine-generated internal category values (currently `"AI Plan"`) from
appearing as selectable project entries in the projects rail, the
`#categoryFilter` dropdown, and the create-form project picker — without
modifying any stored todo data.

## Scope
- Add a client-side blocklist constant `AI_INTERNAL_CATEGORIES` in
  `public/app.js`.
- Filter it inside `getAllProjects()` (line ~2869), which is the single upstream
  source for all three navigation surfaces.
- No backend changes.
- No DB / Prisma schema changes.
- No new npm dependencies.

## Out of Scope
- Changing what value is stored in `todos.category` — existing data is preserved.
- Modifying `src/routes/aiRouter.ts` or any backend file.
- Any lint-first / AI UX changes (those are Task 103).
- Visual / snapshot changes.

## Files Allowed
- `public/app.js`

## Acceptance Criteria *
- [ ] `"AI Plan"` does not appear as an option in `#categoryFilter` even when
      todos with `category: "AI Plan"` are loaded.
- [ ] `"AI Plan"` does not appear as a button in the projects rail even when such
      todos exist.
- [ ] `"AI Plan"` does not appear in the create-form project picker dropdown.
- [ ] Todos that already have `category: "AI Plan"` are not mutated, deleted, or
      hidden from the main task list — they remain visible under "All Tasks".
- [ ] Selecting "All Tasks" (empty `#categoryFilter`) still shows todos whose
      category is `"AI Plan"`.
- [ ] `setSelectedProjectKey("AI Plan")` gracefully falls through to the default
      "All" selection (no JS error).
- [ ] All existing Playwright fast-suite tests continue to pass
      (`CI=1 npm run test:ui:fast`).
- [ ] `npx tsc --noEmit` passes (no TypeScript errors).
- [ ] `npm run format:check` passes.

## Constraints
- Do **not** modify the `filterTodos()` / `setSelectedProjectKey()` call
  signatures or their internal logic.
- Do **not** attach new event listeners to dynamic child elements (preserve event
  delegation pattern).
- The blocklist must be a named constant so it is easy to extend later
  (e.g., future machine-generated category names).

## Deliverable
- PR URL
- Commit SHA(s)
- Files changed
- PASS/FAIL matrix

## Outcome *
(filled after completion)
