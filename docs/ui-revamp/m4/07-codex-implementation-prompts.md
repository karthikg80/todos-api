# M4 Codex Implementation Prompts

## PR1 Prompt: Rail shell + calm layout
Implement M4 PR1 only: add the projects left rail shell and mobile sheet container with token-driven styling, without changing project filter semantics.

- Files:
  - `public/index.html`
  - `public/styles.css`
  - `public/app.js` (minimal mount/render hooks only)
- Exact behaviors:
  - Add `#projectsRail` layout region with `All tasks` and empty dynamic list container.
  - Add mobile sheet controls: `#projectsRailMobileOpen`, `#projectsRailMobileClose`, `#projectsRailBackdrop`.
  - Keep top bar search/add/more-filters intact.
- Constraints:
  - No backend changes.
  - No AI/drawer/drag/bulk behavior changes.
  - Preserve existing IDs/data-on* handlers.
- Verification:
  - `npm run format:check`
  - `npm run lint:html`
  - `npm run lint:css`
  - `CI=1 npm run test:ui`

## PR2 Prompt: Selection wiring + counts + keyboard
Implement M4 PR2 only: wire rail project selection to the existing project filter path and add derived counts.

- Files:
  - `public/app.js`
  - `public/styles.css`
  - `tests/ui/projects-rail.spec.ts` (new)
- Exact behaviors:
  - Add minimal state: `selectedProjectKey`, `isProjectsRailCollapsed`, `isProjectsRailOpenMobile`.
  - Compute counts from `todos` in-memory.
  - Selecting rail item updates existing category filter behavior (no new filter logic).
  - Keyboard support: ArrowUp/ArrowDown/Enter/Escape.
- Constraints:
  - Reuse delegated event approach (`data-on*` + central binding).
  - Avoid duplicate filtering functions.
- Verification:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run test:unit`
  - `CI=1 npm run test:ui`

## PR3 Prompt: Project CRUD UX + overflow menu
Implement M4 PR3 only: replace prompt-based project CRUD interactions with in-app rail controls and stable overflow behavior.

- Files:
  - `public/app.js`
  - `public/styles.css`
  - `tests/ui/projects-rail.spec.ts`
- Exact behaviors:
  - Add create project inline form/modal from `#projectsRailCreateButton`.
  - Add row overflow actions: rename/delete with confirm and validation messaging.
  - Overflow closes on Escape and outside click; focus restores to trigger.
- Constraints:
  - Reuse existing project normalization and messaging functions.
  - No backend/API changes.
  - No drawer/AI behavior changes.
- Verification:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run lint:css`
  - `npm run test:unit`
  - `CI=1 npm run test:ui`

## PR4 Prompt: Mobile sheet + regression hardening
Implement M4 PR4 only: mobile rail sheet polish, focus restoration, and regression hardening.

- Files:
  - `public/app.js`
  - `public/styles.css`
  - `tests/ui/projects-rail.spec.ts`
  - `tests/ui/app-smoke.spec.ts`
- Exact behaviors:
  - Mobile rail opens/closes with backdrop and body scroll lock.
  - Escape priority: rail overflow/menu closes before sheet; sheet closes before unrelated controls.
  - Focus restore to opener when sheet closes.
- Constraints:
  - Reuse existing body-lock pattern from drawer implementation.
  - Keep existing more-filters, drawer, AI, drag, bulk behaviors unchanged.
- Verification:
  - `npx tsc --noEmit`
  - `npm run format:check`
  - `npm run lint:css`
  - `npm run test:unit`
  - `CI=1 npm run test:ui`
