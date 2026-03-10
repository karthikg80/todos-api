# TASK 160: p2-state-templates-async

type: Yellow
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/p2-state-templates-async
pr: https://github.com/karthikg80/todos-api/pull/203
sha: 027148d

## Problem
Three categories of structural duplication remained after the P1 sprint:
1. Ad-hoc boolean writes scattered across state for high-churn UI entry points
2. Duplicated load/error/empty async state flow across taskDrawerAssist, onCreateAssist, todayPlan
3. Repeated inline HTML string construction for row, panel, and drawer section markup

## What Changed

**stateActions.js** (new, 402 lines)
- Explicit `applyUiAction(type, payload)` dispatcher for UI/domain entry points
- Covers: quickEntry, drawerUi, onCreateAssist, commandPalette, railUi state transitions
- Eliminates scattered ad-hoc boolean writes into state

**asyncLifecycle.js** (new, 27 lines)
- `runAsyncLifecycle({ start, run, success, failure, finalize })` helper
- Normalises the load/error/empty state flow pattern
- Applied to taskDrawerAssist, onCreateAssist, todayPlan load flows

**uiTemplates.js** (new, 206 lines)
- Shared string-template helpers: renderPanelHeader, renderRowItem, renderDrawerSection, etc.
- Replaces duplicated inline HTML string construction
- Applied across drawerUi, onCreateAssist, todayPlan, projectsState

Filter/render pipeline untouched. No new dependencies.

## Files Changed (13)
- client/modules/stateActions.js (new)
- client/modules/asyncLifecycle.js (new)
- client/modules/uiTemplates.js (new)
- client/modules/drawerUi.js
- client/modules/onCreateAssist.js
- client/modules/todayPlan.js
- client/modules/filterLogic.js
- client/modules/commandPalette.js
- client/modules/railUi.js
- client/modules/projectsState.js
- client/modules/quickEntry.js
- client/modules/homeDashboard.js
- client/modules/aiWorkspace.js

## Verification
- npx tsc --noEmit: PASS
- npm run format:check: PASS
- npm run lint:html: PASS
- npm run lint:css: PASS
- npm run test:unit: PASS
- CI=1 npm run test:ui:fast: PASS (205 passed, 33 skipped)

## Outcome
Merged as PR #203 (SHA 0550a15). stateActions.js (402 lines), asyncLifecycle.js (27 lines),
and uiTemplates.js (206 lines) added to client/modules/. 10 existing modules rewired to use
explicit state transitions, shared async lifecycle, and centralized template helpers.
All checks green: tsc, format, test:unit, test:ui:fast (205 passed, 33 skipped).
