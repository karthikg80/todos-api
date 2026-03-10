# TASK 159: overlay-centralization-safe-todo-patches

type: Yellow
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/p1-overlay-safe-patches (merged as PR #202)
pr: https://github.com/karthikg80/todos-api/pull/202
merged: 2026-03-10
sha: be84802

## Problem
Overlay coordination was scattered: drawer, rail, quick-entry, and project flows each
managed open/close state independently with no shared contract. Full rerenders were
triggered for cases where only a targeted view patch was needed (e.g. a single row
updating after a drawer save), causing avoidable flicker and render sweeps.

## What Changed
- Introduced selector layer: canonical CSS selector constants for all major overlay surfaces
- Added todosViewPatches: safe, targeted todo-row patching that avoids a full rerender
  when the visible set is unchanged and only content needs updating
- Expanded overlayManager: all 4 main surfaces (drawer, rail, quick-entry, projects)
  now coordinate open/close through a single OverlayManager instance
- Rewired drawer, rail, quick-entry, and project flows to use OverlayManager open/close
- Full rerender fallbacks preserved for cases where visibility can change

## Files Changed
- client/modules/overlayManager.js (expanded)
- client/modules/selectorLayer.js (new)
- client/modules/todosViewPatches.js (new)
- client/modules/drawerUi.js
- client/modules/railUi.js
- client/modules/quickEntry.js
- client/modules/projectsState.js

## Verification
- npx tsc --noEmit: PASS
- npm run format:check: PASS
- npm run lint:html: PASS
- npm run lint:css: PASS
- npm run test:unit: PASS
- CI=1 npm run test:ui:fast: PASS (205 passed, 33 skipped)

## Outcome
P1 sprint complete. Overlay coordination is centralized. Targeted row patching
reduces avoidable full rerenders. Full rerender fallbacks intact where needed.
Combined with PR #199 (EventBus), domain modules no longer command renders or
manage overlay state independently.
