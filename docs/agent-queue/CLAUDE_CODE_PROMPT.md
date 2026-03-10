# Claude Code — Architecture Remediation Execution Prompt

Use this prompt to kick off each task in order. Copy the relevant section into
`claude` at the repo root. Do **not** start a new task until the previous PR is
merged into master and you have pulled the latest master.

---

## How to use

```bash
cd /Users/karthikgurumoorthy/dev/todos-api
claude "<paste prompt for the task below>"
```

---

## TASK 140 — ES6 Module Split (Red · Prerequisites all others)

```
Read docs/agent-queue/tasks/red/140-appjs-es6-module-split.md in full before
doing anything else. Then read CLAUDE.md and docs/memory/canon/CANON.md.

Your job is to execute TASK 140 exactly as specified.

Before touching any code:
1. Create a git worktree as instructed in AGENTS.md:
   BRANCH=claude/task-140-appjs-es6-module-split
   WORKTREE=/private/tmp/todos-api-task-140
   git worktree add "$WORKTREE" -b "$BRANCH" master
   cd "$WORKTREE" && npm ci

2. Map the dependency graph of app.js FIRST — list which functions call which
   other functions across the proposed module boundaries. Identify any circular
   import risks before writing a single line of new code. Output this map as a
   comment block at the top of app.js before splitting.

3. Split into these modules (files allowed listed in task):
   todosService.js, projectsState.js, drawerUi.js, filterLogic.js,
   overlayManager.js
   Keep app.js as a thin entry point / orchestrator.

4. Update public/index.html to load app.js with type="module".

5. Run ALL verification checks before declaring done:
   npx tsc --noEmit
   npm run format:check
   npm run lint:html
   npm run lint:css
   npm run test:unit
   CI=1 npm run test:ui:fast

6. Fill in the Deliverable and Outcome sections of the task file.
   Set status: DONE.

7. Push branch and provide handoff summary.

Constraints (hard stops — set status BLOCKED and stop if hit):
- Any new npm dependency → BLOCKED
- Any behavior change visible in browser → BLOCKED
- Any test that was passing before now fails → fix the code, never the test
- Circular import that cannot be resolved cleanly → BLOCKED, report to user
```

---

## TASK 141 — Centralize Global Mutable State (Yellow · after 140 merged)

```
Pull latest master first. Read docs/agent-queue/tasks/yellow/141-centralize-global-mutable-state.md
in full. Then read CLAUDE.md and docs/memory/canon/CANON.md.

Execute TASK 141 exactly as specified.

1. Create worktree:
   BRANCH=claude/task-141-centralize-global-mutable-state
   WORKTREE=/private/tmp/todos-api-task-141
   git worktree add "$WORKTREE" -b "$BRANCH" master
   cd "$WORKTREE" && npm ci

2. Before touching code, audit and list ALL top-level mutable let/var variables
   in app.js that represent UI state. Output the full list as a comment before
   starting any changes.

3. Create a single appState object with typed getters/setters covering every
   variable in that list. Replace all direct reads/writes throughout app.js
   with accessor calls.

4. filterTodos() and setSelectedProjectKey() must remain as public entry points
   with unchanged signatures.

5. Run ALL verification checks:
   npx tsc --noEmit
   npm run format:check
   npm run lint:html
   npm run lint:css
   npm run test:unit
   CI=1 npm run test:ui:fast

6. Fill in Deliverable and Outcome. Set status: DONE. Push and handoff.

Constraints:
- Touch only public/app.js
- No CSS, no backend, no test rewrites
- >10 files touched → BLOCKED
- Any new dependency → BLOCKED
```

---

## TASK 142 — Replace Native confirm/prompt Dialogs (Green · can run after 140)

```
Pull latest master first. Read docs/agent-queue/tasks/green/142-replace-native-prompt-confirm-dialogs.md
in full. Then read CLAUDE.md.

Execute TASK 142 exactly as specified.

1. Create worktree:
   BRANCH=claude/task-142-replace-native-prompt-confirm-dialogs
   WORKTREE=/private/tmp/todos-api-task-142
   git worktree add "$WORKTREE" -b "$BRANCH" master
   cd "$WORKTREE" && npm ci

2. Audit: grep for confirm( and prompt( in public/app.js. List every call site
   with line number and context before writing any replacement code.

3. Build two reusable vanilla JS helpers:
   - ConfirmDialog(message, onConfirm, onCancel)
   - InputDialog(promptText, onSubmit, onCancel)
   Both must be keyboard-accessible: Enter confirms, Escape cancels.
   Style must match the existing modal/sheet design system in styles.css.

4. Replace every confirm() and prompt() call site with the appropriate helper.

5. Run ALL verification checks:
   npx tsc --noEmit
   npm run format:check
   npm run lint:html
   npm run lint:css
   npm run test:unit
   CI=1 npm run test:ui:fast

6. Fill in Deliverable and Outcome. Set status: DONE. Push and handoff.

Constraints:
- Files allowed: public/app.js, public/styles.css, public/index.html only
- No new npm dependencies
- No backend changes, no test rewrites
```

---

## TASK 143 — Universal Overlay Manager (Yellow · after 141 merged)

```
Pull latest master first. Read docs/agent-queue/tasks/yellow/143-universal-overlay-manager.md
in full. Then read CLAUDE.md and docs/memory/canon/CANON.md.

Execute TASK 143 exactly as specified.

1. Create worktree:
   BRANCH=claude/task-143-universal-overlay-manager
   WORKTREE=/private/tmp/todos-api-task-143
   git worktree add "$WORKTREE" -b "$BRANCH" master
   cd "$WORKTREE" && npm ci

2. Before writing code, inventory all existing overlay surfaces:
   modals, sidebars, sheets, bottom dock (.dock-profile-panel z-index:55).
   List each with its current open/close mechanism and z-index.

3. Implement DialogManager singleton:
   - open(layerId), close(layerId), closeAll()
   - Focus trap: Tab/Shift-Tab cycles within the active layer only
   - Escape: closes topmost layer only (not all layers)
   - Backdrop click: closes active layer
   - z-index stacking: layers stack in open order; dock (z-index:55) must
     never be obscured by a stacked backdrop

4. Wire ALL existing open/close call sites through DialogManager.
   Add aria-modal="true" and role="dialog" to overlay containers.

5. Manual verification checkpoint before running tests:
   Open a modal while the sidebar is open — both should coexist correctly.
   Open the dock, then open a modal — dock should not be obscured.

6. Run ALL verification checks:
   npx tsc --noEmit
   npm run format:check
   npm run lint:html
   npm run lint:css
   npm run test:unit
   CI=1 npm run test:ui:fast

7. Fill in Deliverable and Outcome. Set status: DONE. Push and handoff.

Constraints:
- Files allowed: public/app.js, public/styles.css, public/index.html only
- No new dependencies
- >10 files touched → BLOCKED
- Preserve all existing overlay IDs/classes used by Playwright tests
```

---

## TASK 145 — Pub-Sub State Update Pattern (Yellow · after 141 and 143 merged)

```
Pull latest master first. Read docs/agent-queue/tasks/yellow/145-pubsub-state-update-pattern.md
in full. Then read CLAUDE.md.

Execute TASK 145 exactly as specified.

1. Create worktree:
   BRANCH=claude/task-145-pubsub-state-update-pattern
   WORKTREE=/private/tmp/todos-api-task-145
   git worktree add "$WORKTREE" -b "$BRANCH" master
   cd "$WORKTREE" && npm ci

2. Before writing code, list every call site in app.js where a state mutation
   directly calls a render/filter function (e.g. renderTodos(), filterTodos(),
   applyFiltersAndRender()). This is the subscriber map you will build.

3. Implement a minimal EventBus singleton in app.js:
   EventBus.subscribe(event, handler)
   EventBus.dispatch(event, payload)
   EventBus.unsubscribe(event, handler)
   No external library. ~20 lines max.

4. Route all state mutations from step 2 through dispatch(). Subscribe the
   correct renderers to the correct events. applyFiltersAndRender() must only
   be triggered via subscription, never called directly.

5. filterTodos() and setSelectedProjectKey() remain as public entry points —
   they may dispatch events internally but their signatures do not change.

6. Manual checkpoint: create a todo, edit it, delete it — verify UI updates
   correctly in the browser before running the test suite.

7. Run ALL verification checks:
   npx tsc --noEmit
   npm run format:check
   npm run lint:html
   npm run lint:css
   npm run test:unit
   CI=1 npm run test:ui:fast

8. Fill in Deliverable and Outcome. Set status: DONE. Push and handoff.

Constraints:
- Touch only public/app.js
- No external state library, no new dependencies
- >10 files → BLOCKED
```

---

## TASK 146 — Debounce Render/Filter Triggers (Green · can run after 140)

```
Pull latest master first. Read docs/agent-queue/tasks/green/146-debounce-render-filter-triggers.md
in full. Then read CLAUDE.md.

Execute TASK 146 exactly as specified.

1. Create worktree:
   BRANCH=claude/task-146-debounce-render-filter-triggers
   WORKTREE=/private/tmp/todos-api-task-146
   git worktree add "$WORKTREE" -b "$BRANCH" master
   cd "$WORKTREE" && npm ci

2. Grep for all addEventListener('input'), addEventListener('keyup'), and
   addEventListener('keydown') call sites in app.js that invoke filterTodos()
   or renderTodos(). List each before touching code.

3. Implement a single inline debounce utility (no lodash, ~5 lines):
   const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
   Define DEBOUNCE_MS = 250 as a named constant.

4. Wrap each identified call site with debounce(fn, DEBOUNCE_MS).

5. Run ALL verification checks:
   npx tsc --noEmit
   npm run format:check
   npm run lint:html
   npm run lint:css
   npm run test:unit
   CI=1 npm run test:ui:fast

6. Fill in Deliverable and Outcome. Set status: DONE. Push and handoff.

Constraints:
- Touch only public/app.js
- No new dependencies
```

---

## TASK 144 — Server-Side Filter/Sort/Aggregate (Red · Codex · parallel with frontend tasks)

> **This task is assigned to Codex, not Claude Code.**
> Use the Codex prompt in docs/codex-prompts.md or pass the task file directly:
>
> ```bash
> # From repo root on master:
> cat docs/agent-queue/tasks/red/144-server-side-filter-sort-aggregate.md
> ```
>
> It can run in parallel with Tasks 140–146 since it touches the backend layer
> (src/todoService.ts, src/projectService.ts, src/routes/) independently.
> The frontend changes (thin filterTodos() coordinator) should be coordinated
> with whatever frontend task is in flight at the time.

---

## Execution order summary

```
master (after PR #173 merged)
│
├── Task 146 (Green)  ──────────────────────────────────► merge → master
├── Task 142 (Green)  ──────────────────────────────────► merge → master
│
└── Task 140 (Red) ──► merge → master
         │
         ├── Task 141 (Yellow) ──► merge → master
         │        │
         │        └── Task 143 (Yellow) ──► merge → master
         │                  │
         │                  └── Task 145 (Yellow) ──► merge → master
         │
         └── [Task 144 runs in parallel on backend — Codex]
```

Start with 146 and 142 (they are small, independent, and de-risk the test
suite before the large Red tasks land). Then execute 140, then 141, 143, 145
in strict sequence.
