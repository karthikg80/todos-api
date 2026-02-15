# Todo Row Spec

## Layout Objective
Make each row scannable in one glance with a stable slot model and minimal action competition.

## Desktop Row Structure
`[checkbox/state] [title + optional description preview] [metadata chips] [actions]`

### Slot 1: State (left)
- Checkbox remains first focusable control.
- Completed rows keep current completed styling semantics but with calmer contrast.

### Slot 2: Content (middle, primary)
- Title: primary text, single line by default with truncation.
- Description preview: optional one-line muted preview if description exists.
- Clicking this content region opens Details drawer.

### Slot 3: Metadata (right-mid)
Render chips only when value exists:
- Due date chip
- Project chip
- Priority chip
Rules:
- Max 3 chips visible.
- No empty placeholders.

### Slot 4: Actions (far right)
- Always visible max: 2 controls
  - `Open details` (explicit affordance or row-click equivalent)
  - `More` kebab menu
- Rare actions (delete, AI breakdown, etc.) move under kebab.

## Mobile Row Structure
Stacked but same slot order intent:
1. State + title on first line
2. Description preview second line (optional)
3. Metadata chips wrap below
4. Kebab remains available, hit target >= 40px

## Interaction Rules
- Row content click opens drawer.
- Checkbox toggles completion and must not open drawer.
- Kebab opens overflow menu and must not open drawer.
- Drag/drop behavior remains unchanged unless collision appears; if collision appears, drag handle becomes explicit in a later pass.

## Keyboard Rules
- Focused row container/content: `Enter` opens drawer.
- Focused checkbox: `Space` toggles checkbox.
- Focused kebab: `Enter` or `Space` opens overflow menu.

## Density
- Comfortable density is default in M2.
- Compact mode is explicitly deferred (post-M2).

## Row Wireframe (ASCII)
`[ ]  Title of task                          [Due] [Project] [P1]   [..]`
`     Optional one-line description preview                          `
