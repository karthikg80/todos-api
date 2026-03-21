# ADR-002: Event bus contract for cross-feature communication

## Status

Accepted

## Context

The frontend uses two communication mechanisms:
1. **Direct function calls** via imports or `hooks.*` — tight coupling, obscure dependency graph
2. **EventBus** — only two events in use (`todos:changed`, `todos:render`)

Cross-feature interactions currently go through `app.js` orchestration or the `hooks` service locator. When feature A needs to notify feature B, it either imports B's function directly or goes through a hooks indirection wired in `app.js`.

## Decision

Adopt the EventBus as the primary cross-feature communication mechanism.

1. **Within a feature:** direct function calls are allowed
2. **Cross-feature:** communication goes through EventBus
3. **Event naming:** `{domain}.{entity}.{past-tense-verb}` (e.g., `todo.created`, `project.selected`)
4. **State changes:** happen through named actions (`applyDomainAction`, `applyUiAction`), not direct mutation
5. **Views:** read from selectors, not arbitrary shared objects
6. **Event type constants:** defined in `client/platform/events/eventTypes.js`

## Consequences

- Fewer cross-module imports → lower coupling
- Feature interactions become traceable via event subscriptions
- Debugging requires checking EventBus subscriptions (mitigated by named constants)
- The existing `hooks` pattern can be gradually replaced where hooks are used for cross-feature calls (hooks for infra like `apiCall` or `escapeHtml` stay)
