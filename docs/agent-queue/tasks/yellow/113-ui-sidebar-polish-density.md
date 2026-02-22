# TASK 113: ui-sidebar-polish-density

type: Yellow
status: REVIEW
mode: implement
builder: codex
reviewer: claude
branch: codex/ui-sidebar-polish-density
base: master

## Intent \*

Polish the Todos shell density and hierarchy so the sidebar feels more stable/Notion-like while preserving existing UI behavior and tests.

## Scope

- Tighten sidebar spacing and hierarchy styling in `public/styles.css`
- Pin bottom nav to Settings-only and reduce visual prominence of top tabs via CSS/markup
- Reduce vertical bloat in the main todos header/properties area using CSS-first compaction
- Hide `AI Plan` from sidebar project/category UI lists without breaking selection fallback behavior

## Out of Scope

- Backend/API changes
- Filter pipeline rewrites (`filterTodos()`)
- Project selection contract changes (`setSelectedProjectKey()`)
- Test modifications
- New dependencies

## Files Allowed

- public/styles.css
- public/index.html
- public/app.js
- docs/agent-queue/tasks/yellow/113-ui-sidebar-polish-density.md

## Acceptance Criteria \*

- [x] Sidebar bottom shows only `Settings` pinned to bottom; no redundant `Todos` item
- [x] Sidebar sections are visually separated and spacing is tighter
- [x] Project rows look like flatter list items and badges are less prominent
- [x] Main header/properties area is visually shorter and first todo rows start higher without clipping
- [x] `AI Plan` does not appear in sidebar project list or category selectors, and filtered selections fall back safely
- [ ] Existing tests remain unchanged and required checks pass (integration blocked locally: PostgreSQL test DB unavailable)

## Constraints

- Preserve existing IDs/classes used by tests
- Preserve event delegation and current DOM structure unless strictly needed
- CSS-first approach preferred for density changes

## MIC-Lite (Yellow/Red)

### Motivation

Current shell spacing and pill-heavy sidebar styling push content down and make navigation hierarchy feel less stable, especially on smaller laptop viewports.

### Impact

Visual presentation changes across the todos shell and sidebar list rendering. Risk is accidental selector/behavior regressions in project/category filtering and test hooks.

### Checkpoints

- [x] UI polish implemented with minimal file touch count and no test selector breakage
- [x] `AI Plan` hidden from list/select surfaces with safe fallback behavior preserved

## Scope Escalation Triggers

If any of these occur, set status to BLOCKED and request re-approval:

- Change touches >10 files
- Introduces a new architectural pattern
- Adds a new dependency
- Changes cross-module behavior contracts
- Modifies data model (Prisma schema)

## Deliverable

- PR URL: pending (to be filled after push)
- Commit SHA(s): pending (to be filled after commit)
- Files changed: `public/app.js`, `public/styles.css`, `docs/agent-queue/tasks/yellow/113-ui-sidebar-polish-density.md`, memory docs (brief/index)
- PASS/FAIL matrix: `tsc` PASS, `format:check` PASS, `lint:html` PASS, `lint:css` PASS, `test:unit` PASS, `test:integration` FAIL (local PostgreSQL unavailable), `test:ui:fast` PASS

## Outcome \*

Implemented sidebar density polish and top-panel compaction with a minimal behavior change to render only `Settings` in the pinned sidebar bottom nav. Kept IDs/classes and event delegation intact, preserved filter pipeline and `setSelectedProjectKey()` paths, and relied on existing `AI Plan` internal-category filtering/fallback behavior (validated by UI tests). Required checks passed except `npm run test:integration`, which failed due missing local PostgreSQL test DB (`todos_test`) in this environment.
