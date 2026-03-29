## Closes

Closes #<issue>

## Why

Explain why this change is needed.

## What Changed

Summarize the user-facing and technical changes.

## Architecture

- Target layer/domain:
- Relevant invariant/ADR:
- [ ] I kept routes, entrypoints, and other orchestrators thin.
- [ ] I reused the canonical code path instead of adding a parallel flow.
- [ ] If I introduced or changed a boundary, I updated the relevant durable doc/ADR.

## Verification

- [ ] `npx tsc --noEmit`
- [ ] `npm run check:architecture`
- [ ] `npm run format:check`
- [ ] `npm run lint:html`
- [ ] `npm run lint:css`
- [ ] `npm run test:unit`
- [ ] `CI=1 npm run test:ui:fast`
- [ ] Additional manual validation notes, if applicable

## Brief / Protocol Impact

- [ ] No
- [ ] Yes

If yes, which doc changed?
