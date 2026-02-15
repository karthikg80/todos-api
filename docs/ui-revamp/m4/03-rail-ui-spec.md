# M4 Rail UI Spec

## Desktop Behavior
- Expanded default width: ~240px.
- Collapsed width: ~56-64px (icons/count dots only, labels hidden).
- Collapse toggle pinned at rail top.
- Active rail item uses accent border + subtle surface tint.

## Mobile Behavior
- Rail appears as left sheet overlay (off-canvas).
- Open via top-left rail button (new, minimal icon button).
- Reuse existing body scroll lock pattern (`is-drawer-open`-style class approach).
- Escape or backdrop tap closes sheet.

## Project Row Anatomy
- Leading: project icon/glyph.
- Label: project name (truncate with tooltip/title attr).
- Trailing: count badge.
- Overflow trigger: kebab (visible on active/hover/focus desktop; always visible mobile).

## Visual Rules (Calm)
- Use M0 tokens for surfaces, text, borders, shadows.
- Dividers low contrast, one-pixel border.
- Focus ring always tokenized (`--focus-ring`).
- No saturated fills for inactive rows.

## Stable IDs / Selectors to Add
- `#projectsRail`
- `#projectsRailToggle`
- `#projectsRailMobileOpen`
- `#projectsRailMobileClose`
- `#projectsRailBackdrop`
- `#projectsRailCreateButton`
- `#projectsRailList`
- Row: `[data-project-key]`
- Row active: `.projects-rail-item--active`
