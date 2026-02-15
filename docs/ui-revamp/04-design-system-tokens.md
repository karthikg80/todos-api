# Design System Tokens (Proposal)

## Token Strategy
Move toward a small, explicit token set consumed everywhere in `public/styles.css` and inline templates in `public/index.html`/`public/app.js`.

## Color Tokens (single accent model)
Use semantic names (no brand hardcoding in docs):
- `--color-surface-page`
- `--color-surface-card`
- `--color-surface-elevated`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-muted`
- `--color-border-subtle`
- `--color-border-strong`
- `--color-accent`
- `--color-accent-contrast`
- `--color-success`
- `--color-warning`
- `--color-danger`

Rule:
- Accent appears on primary CTA, active states, focus ring accents, and key selection states only.

## Spacing Scale
- `--space-1: 4px`
- `--space-2: 8px`
- `--space-3: 12px`
- `--space-4: 16px`
- `--space-5: 24px`
- `--space-6: 32px`

## Radius Scale
- `--radius-sm: 8px`
- `--radius-md: 12px`
- `--radius-lg: 16px`

## Shadow Levels
- `--shadow-0: none`
- `--shadow-1: subtle elevation for cards/drawers`
- `--shadow-2: modal-level elevation`

## Typography Scale
- `--font-size-h1`
- `--font-size-h2`
- `--font-size-body`
- `--font-size-small`
- `--line-height-tight`
- `--line-height-body`
- `--font-weight-medium`
- `--font-weight-semibold`

## Interaction Tokens
- `--focus-ring-color`
- `--focus-ring-width`
- `--focus-ring-offset`
- `--hover-surface`
- `--active-surface`
- `--disabled-opacity`

## Component Rules

## Buttons
- Primary: accent fill, high contrast text, medium radius.
- Secondary: neutral surface + subtle border.
- Tertiary: text/ghost style for low-emphasis actions.
- Destructive: isolated danger token, not default prominent.

## Pills/Chips
- Neutral fill + subtle border by default.
- Only active selected chip uses accent emphasis.

## Inputs/Selects/Textareas
- 1px subtle border default, stronger border on hover/focus.
- No heavy gradients.
- Consistent heights for input/select controls in same row.

## Cards/Panels
- Prefer border + low shadow instead of strong fills.
- Keep internal spacing on scale tokens.

## Drawers/Modals
- Drawer: `shadow-1`, modal: `shadow-2`.
- Section headers with small labels and divider.

## Dark Mode Rules
- Preserve semantic token names; swap token values only.
- Dark surfaces should remain layered with small luminance steps:
  - page < card < elevated
- Border contrast should remain visible but low-noise.
- Text contrast rules:
  - primary text: strong readable contrast
  - secondary text: reduced emphasis but still compliant
- Focus ring must remain clearly visible against dark surfaces.

## Do / Don't

Do:
- Use one accent channel for primary meaning.
- Use spacing/typography before adding color.
- Keep control heights, radii, and border treatments consistent.

Don't:
- Mix multiple saturated hues for routine metadata.
- Put many equal-weight buttons in one row.
- Introduce inline hardcoded colors for one-off states.
