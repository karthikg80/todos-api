# More Filters Surface (M1)

## Chosen Pattern
**Option A: inline collapsible panel below top bar** (preferred).

Why:
- Minimal engineering change in current vanilla HTML/CSS/JS setup.
- No overlay/drawer state complexity.
- Works naturally with delegated `data-on*` patterns.

## Panel Content (Default Collapsed)
Inside "More filters":
- Full date view pills/buttons:
  - All (`setDateView('all')`)
  - Today (`setDateView('today')`)
  - Upcoming (`setDateView('upcoming')`)
  - Next Month (`setDateView('next_month')`)
  - Someday (`setDateView('someday')`)
- `Clear filters` action (`clearFilters()`)
- `Export .ics` action (`exportVisibleTodosToIcs()`)
- Optional helper copy for ICS export (can move here from always-visible area)

## Default State
- Collapsed on first render and on regular navigation into Todos.
- Optional persistence is out of scope for M1 (keep deterministic default collapsed).

## Accessibility + Keyboard Behavior
- Toggle button (`More filters`) requirements:
  - `aria-expanded="false|true"` synchronized with state
  - `aria-controls="moreFiltersPanel"`
- Panel container:
  - `id="moreFiltersPanel"`
  - hidden via class/`hidden` attribute when collapsed
- Keyboard:
  - `Enter`/`Space` on toggle opens/closes panel
  - `Escape` closes panel when open and returns focus to toggle button
- Focus management:
  - On open: leave focus on toggle (minimal-risk) or optionally move to first control; pick one and keep consistent
  - On close via Escape: restore focus to toggle

## Visual Behavior
- Low-contrast bordered panel using M0 tokens.
- Subtle spacing and divider rules.
- No modal/overlay behavior in M1.
