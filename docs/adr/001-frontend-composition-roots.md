# ADR-001: Frontend composition roots

## Status

Accepted

## Context

`client/app.js` (1,791 lines) acts as the universal orchestrator: it imports ~420 named exports from 22 modules, assigns ~120 functions to `window`, wires 137 `hooks.*` entries, and binds all delegated DOM events. Any change to any module risks breaking the star topology.

The codebase already has disciplined patterns — event delegation via `data-onclick` attributes, a hooks registry for circular dependency breaking, and `stateActions.js` for named state transitions — but all wiring runs through `app.js`.

## Decision

Refactor `app.js` into a thin composition root that calls feature initializers.

1. Create `client/bootstrap/` with `initApp.js`, `initShell.js`, `initGlobalListeners.js`
2. Create `client/features/{name}/init{Name}Feature.js` for each major feature area
3. Each feature initializer owns its listeners, subscriptions, and hooks wiring
4. `app.js` becomes: import bootstrap → call initializers → done

## Constraints

- Preserve existing event delegation pattern (`data-onclick` + `window.*` bridge)
- Preserve `hooks` registry for circular dependency breaking
- Preserve `filterTodos()` as the canonical filter pipeline entry point
- Preserve `setSelectedProjectKey()` as the project selection entry point
- No behavioral change — purely structural

## Consequences

- `app.js` shrinks to ~100–200 lines of import + init calls
- Feature boundaries become explicit (who owns what listeners)
- New features add an initializer instead of editing `app.js`
- `window.*` bridge persists until a build step is adopted
