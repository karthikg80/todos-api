# State and Render Plan (No Framework)

## State Additions
Add minimal UI selection state in `public/app.js`:
- `selectedTodoId: string | null`
- `selectedTodoSnapshot` (optional lightweight reference for dirty-check/restore focus context)
- `lastFocusedTodoTrigger` (element or id for focus restoration)

No changes to filtering/business state required.

## Render Strategy
Maintain current imperative model:
- `renderTodos()` continues full list render.
- Add `renderDetailsDrawer()` as a sibling render path driven by `selectedTodoId`.
- `renderTodos()` marks active row when `todo.id === selectedTodoId`.

## Event Delegation Approach
Continue delegated `data-onclick` pattern:
- Add handlers to open/close drawer and toggle details accordion.
- Keep checkbox/action handler `event.stopPropagation()` where required to prevent accidental drawer open.

## Data Update Strategy
- Reuse existing update flow from edit modal logic (currently via `saveEditedTodo()` and `/todos/:id` update request).
- Avoid introducing duplicate validation or parallel save code paths.
- Recommended path:
  - extract shared payload build + save helper from modal logic
  - modal and drawer call same helper until modal is retired

## Existing Hotspots Likely to Change
- `renderTodos()`
- `openEditTodoModal(todoId)`
- `closeEditTodoModal()`
- `saveEditedTodo()`
- `handleTodoKeyPress(event)`
- `renderSubtasks(todo)`
- More-filters functions must remain unaffected:
  - `openMoreFilters()`
  - `closeMoreFilters()`
  - `toggleMoreFilters()`

## Non-Goals in State Layer
- No new filter logic
- No backend contract changes
- No router/view architecture rewrite
