# Accessibility Plan (M2)

## Drawer/Sheet Semantics
- Use dialog semantics for drawer/sheet container:
  - `role="dialog"`
  - `aria-modal="true"` for modal sheet mode
  - `aria-labelledby` pointing to drawer title
- Keep panel in DOM and control visibility with classes/attributes.

## Focus Management
- On open: move focus to drawer title input (Essentials).
- On close (`Escape` or close button): return focus to triggering row element.
- Ensure tab order stays inside drawer while open in modal/sheet mode.

## Background Interaction
- Desktop drawer mode:
  - allow contextual list visibility
  - prevent ambiguous double focus targets while drawer has active edit focus
- Mobile sheet/full-screen mode:
  - lock background scroll while open

## Keyboard
- `Escape`: closes drawer and restores focus.
- `Enter` on row/content opens drawer.
- `Space` on checkbox toggles completion only.
- Kebab remains keyboard reachable and operable.

## Messages / Live Regions
- Reuse existing message + `aria-live` infrastructure for:
  - save success
  - save error
  - delete confirmations/errors

## Hit Targets and Contrast
- Maintain >= 40px interactive hit targets on mobile.
- Keep contrast compliant under both light/dark token themes from M0.
