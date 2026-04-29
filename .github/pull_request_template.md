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

## Shared contract

Check all that apply. Skip this section if the change does not touch the API wire format or transport DTOs. See [ADR-006](../docs/adr/006-transport-contract-source-of-truth.md) and [ADR-007](../docs/adr/007-ios-python-contract-sync.md) for context.

- [ ] My change does not affect transport DTOs. (Skip the rest.)
- [ ] If transport DTOs changed, I updated the iOS DTOs in `ios/TodosApp/TodosApp/Core/Models/*.swift`.
- [ ] If transport DTOs changed, I updated the affected `@dataclass` entries in `agent-runner/agent_api_types.py` (or flagged that the change does not touch any action `agent-runner` consumes).
- [ ] If transport DTOs changed, I mentioned the cross-client impact in the PR description so reviewers can flag any client that needs a follow-up.

## Verification

- [ ] `npx tsc --noEmit`
- [ ] `npm run check:architecture`
- [ ] `npm run format:check`
- [ ] `npm run lint:html`
- [ ] `npm run lint:css`
- [ ] `npm run test:unit`
- [ ] `CI=1 npm run test:ui:fast`
- [ ] Additional manual validation notes, if applicable

## Design system check

For PRs that add or change a shared UI primitive under `client-react/src/components/ui/`, walk through the [Gallery PR checklist](../UX.md#gallery-pr-checklist) in `UX.md`. Skip otherwise.

## Brief / Protocol Impact

- [ ] No
- [ ] Yes

If yes, which doc changed?
