# TASK 153: centralize-localstorage-keys

type: Green
status: DONE
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-153-centralize-localstorage-keys
base: master

## Intent
Extract all scattered localStorage key string constants into a single `client/utils/storageKeys.js` module so no key is hardcoded inline and future renames are a one-line change.

## Background
localStorage keys are currently defined as module-local constants across 5 files:

| File | Constant | Key String |
|------|----------|------------|
| railUi.js | PROJECTS_RAIL_COLLAPSED_STORAGE_KEY | "todos:projects-rail-collapsed" |
| railUi.js | AI_WORKSPACE_COLLAPSED_STORAGE_KEY | "todos:ai-collapsed" |
| railUi.js | AI_WORKSPACE_VISIBLE_STORAGE_KEY | "todos:ai-visible" |
| quickEntry.js | QUICK_ENTRY_PROPERTIES_OPEN_STORAGE_KEY | "todos:quick-entry-properties-open" |
| homeDashboard.js | HOME_TOP_FOCUS_CACHE_KEY | "todos:home-top-focus-cache" |
| onCreateAssist.js | AI_ON_CREATE_DISMISSED_STORAGE_KEY | "todos:ai-on-create-dismissed" |
| featureFlags.js | (inline string) | "feature.enhancedTaskCritic" |
| featureFlags.js | (inline string) | "feature.taskDrawerDecisionAssist" |
| store.js | (inline string) | "feature.taskDrawerDecisionAssist" |
| drawerUi.js | (dynamic key via taskDrawerDismissKey fn) | "todos:task-drawer-dismissed:{id}" |

## Scope

1. Create `client/utils/storageKeys.js` that exports named constants:
   ```js
   export const STORAGE_KEYS = {
     PROJECTS_RAIL_COLLAPSED:       "todos:projects-rail-collapsed",
     AI_WORKSPACE_COLLAPSED:        "todos:ai-collapsed",
     AI_WORKSPACE_VISIBLE:          "todos:ai-visible",
     QUICK_ENTRY_PROPERTIES_OPEN:   "todos:quick-entry-properties-open",
     HOME_TOP_FOCUS_CACHE:          "todos:home-top-focus-cache",
     AI_ON_CREATE_DISMISSED:        "todos:ai-on-create-dismissed",
     FEATURE_ENHANCED_TASK_CRITIC:  "feature.enhancedTaskCritic",
     FEATURE_TASK_DRAWER_ASSIST:    "feature.taskDrawerDecisionAssist",
     TASK_DRAWER_DISMISSED_PREFIX:  "todos:task-drawer-dismissed:",
   };
   ```

2. Update each consumer to import from storageKeys.js and replace local constant with `STORAGE_KEYS.*`:
   - `client/modules/railUi.js` — 3 constants
   - `client/modules/quickEntry.js` — 1 constant
   - `client/modules/homeDashboard.js` — 1 constant
   - `client/modules/onCreateAssist.js` — 1 constant
   - `client/modules/featureFlags.js` — 2 inline strings
   - `client/modules/store.js` — 1 inline string in createInitialTaskDrawerAssistState

3. For `drawerUi.js` — the `taskDrawerDismissKey(todoId)` function should become:
   ```js
   import { STORAGE_KEYS } from "../utils/storageKeys.js";
   function taskDrawerDismissKey(todoId) {
     return `${STORAGE_KEYS.TASK_DRAWER_DISMISSED_PREFIX}${todoId}`;
   }
   ```

4. Add `client/utils/storageKeys.js` to `client/index.html` as a script tag ONLY if it must be loaded as a non-module script — otherwise import it as an ES6 module from each consumer. Prefer ES6 import.

5. Update `docs/memory/brief/BRIEF.md` Open Tech Debt — mark storageKeys item resolved.
6. Update `docs/next-enhancements.md` similarly.

## Out of Scope
- Changing any key string values (no key renames)
- Migrating auth-related keys from authSession.js (those belong to AppState)
- Any logic changes

## Files Allowed
- `client/utils/storageKeys.js` (new)
- `client/modules/railUi.js`
- `client/modules/quickEntry.js`
- `client/modules/homeDashboard.js`
- `client/modules/onCreateAssist.js`
- `client/modules/featureFlags.js`
- `client/modules/store.js`
- `client/modules/drawerUi.js`
- `docs/memory/brief/BRIEF.md`
- `docs/next-enhancements.md`

## Acceptance Criteria
- [ ] `client/utils/storageKeys.js` exists and exports `STORAGE_KEYS`
- [ ] No module-local `*_STORAGE_KEY` or `*_KEY` constant remains for app keys (only the import)
- [ ] No inline key strings remain in featureFlags.js or store.js
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run test:unit` passes
- [ ] `CI=1 npm run test:ui:fast` passes
- [ ] App loads in browser, localStorage behaviors unchanged

## Constraints
- Pure extraction — zero behavior or key-string changes
- Do not add authSession keys (authToken, refreshToken, user) to this file — those belong to AppState
- BLOCKED if any localStorage key string is changed (would break existing stored user preferences)
- BLOCKED if touches >10 files

## Deliverable
- PR URL
- Commit SHA(s)
- Files changed
- PASS/FAIL matrix

## Outcome
Extracted 9 localStorage key strings from 7 modules into client/utils/storageKeys.js.
All consumers updated to import STORAGE_KEYS. Key VALUES preserved unchanged (including
existing TASK_DRAWER_DISMISSED_PREFIX which was taskDrawerAssist:dismissed: in production).
PR #196 merged. Diff against master: exactly the 10 task-153 files, nothing extra.
