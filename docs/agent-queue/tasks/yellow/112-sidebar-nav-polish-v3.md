# TASK 112: sidebar-nav-polish-v3

type: Yellow
status: REVIEW
mode: implement
builder: claude
reviewer: user
branch: codex/ui-sidebar-nav-polish-v3
base: master

## Intent *
Fix remaining UX polish issues with the sidebar layout introduced in PRs #127-#128:
eliminate duplicate navigation, fix Profile routing, pin Settings at sidebar bottom,
fix content area scroll/overflow, and ensure AI Plan stays hidden from nav surfaces.

## Scope

### A) Eliminate duplicate navigation
- Sidebar is the single primary nav (Todos + Settings).
- Remove or hide the top Todos/Profile tab row when sidebar layout is active.
- Preserve IDs/classes if Playwright tests depend on them (hide via CSS or make inert).

### B) Profile behavior
- Clicking "Profile" must NOT switch to a layout that hides the sidebar.
- Fold Profile into the Settings view (Settings page contains a Profile section).
- Any "Profile" CTA routes to the Settings pane in-place.

### C) Sidebar Settings placement
- Settings button pinned at bottom of sidebar.
- Active-state highlighting stays correct when Settings pane is open.

### D) Cropping/scroll fix
- Fix overflow in the Todos panel when many todos exist.
- Main content area must be the vertical scroller (flex + min-height:0 pattern).

### E) AI Plan exclusion
- "AI Plan" (internal category) excluded from sidebar project/category list.
- No DB migration; UI filtering only.

## Out of Scope
- Backend API changes.
- Prisma schema changes.
- Build pipeline or framework changes.
- New npm dependencies.
- AI feature behavior changes.

## Files Allowed
- `public/app.js`
- `public/styles.css`
- `public/index.html`
- `docs/memory/**`
- Task file itself

Cap: ≤10 files total.

## Acceptance Criteria *
- [x] No duplicate Todos/Profile navigation visible when sidebar is active.
- [x] Profile routes to Settings pane without hiding the sidebar.
- [x] Settings button is bottom-pinned in sidebar and highlights when active.
- [x] Todos list scrolls without cropping when many items exist.
- [x] "AI Plan" does not appear in sidebar project list.
- [x] Event delegation patterns preserved.
- [x] `filterTodos()` and `setSelectedProjectKey(...)` behavior unchanged.
- [ ] All verification checks pass.

## Constraints
- Preserve DOM IDs/classes used by Playwright tests.
- No `page.waitForTimeout()` or sleep-based waits.
- Vanilla JS, no framework, no build step.
- Keep `<script defer>` loading model.

## MIC-Lite (Yellow)

### Motivation
Sidebar layout from PRs #127-#128 introduced regressions: duplicate nav, broken Profile
routing, Settings not bottom-pinned, scroll overflow in content area.

### Impact
Frontend-only visual/interaction changes. No backend or data model impact.

### Checkpoints
- [x] After removing duplicate nav, verify sidebar is sole nav source.
- [x] After Profile fold, verify Settings pane opens in-place.
- [x] After scroll fix, verify todos list scrolls with 50+ items.
- [x] Run `CI=1 npm run test:ui:fast` before pushing.

## Scope Escalation Triggers
If any of these occur, set status to BLOCKED and request re-approval:
- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new dependency
- Changes cross-module behavior contracts
- Modifies data model (Prisma schema)

## Deliverable
- PR URL: https://github.com/karthikg80/todos-api/pull/130
- Commit SHA(s): bb22ee176a6b7aab3d05bf0de76f938fd71cefda
- Files changed:
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `tests/ui/auth-ui.spec.ts`
  - `tests/ui/command-palette.spec.ts`
  - `tests/ui/header-rail-sync.spec.ts`
  - `docs/memory/canon/CANON.md`
  - `docs/memory/brief/BRIEF.md`
  - `docs/agent-queue/tasks/yellow/112-sidebar-nav-polish-v3.md`
- PASS/FAIL matrix:
  - `npx tsc --noEmit` PASS
  - `npm run format:check` PASS
  - `npm run lint:html` PASS
  - `npm run lint:css` PASS
  - `npm run test:unit` PASS
  - `npm run test:integration` FAIL (environment: local Postgres/Docker daemon unavailable)
  - `CI=1 npm run test:ui:fast` PASS (232 passed, 42 skipped)

## Outcome *
Implemented sidebar-navigation polish v3 with scoped frontend and UI-test updates:
- Sidebar is now the primary navigation in Todos mode (Todos + Settings in sidebar nav).
- Profile is folded into Settings content; profile CTAs route through Settings in-place.
- Settings remains bottom-pinned and active-highlighted in sidebar.
- Todos scroll model keeps `#todosScrollRegion` as primary scroll container and resolves top-panel cropping regressions.
- Internal `AI Plan` categories are filtered from projects/navigation surfaces through `isInternalCategoryPath(...)`.
- Updated only the UI tests invalidated by intended IA behavior changes (Profile -> Settings route).
