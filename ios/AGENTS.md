# iOS App

SwiftUI (iOS 17+) in `TodosApp/`. Swift Package — zero third-party dependencies.

## Architecture

- `@Observable` with `@MainActor` on AppState — all auth mutations on main actor
- Actor-based `APIClient` with two paths: `send()` (authenticated + retry) and `sendUnauthenticated()` (raw)
- `SessionCoordinator` actor serializes token refresh (single-flight)
- `AppEnvironment` is the DI container, services conform to protocols for testability

## Shared Contract

iOS DTOs mirror the backend's **transport contract**, not `src/types.ts` directly. Per [ADR-006](../docs/adr/006-transport-contract-source-of-truth.md), transport is defined by Zod schemas in `src/transport/` (backend) and date fields are ISO 8601 strings on the wire. iOS DTOs live in `TodosApp/TodosApp/Core/Models/` and remain hand-maintained.

When the transport contract changes:

1. Update `Enums.swift` for new enum cases
2. Update the relevant DTO file for new fields (as optionals)
3. Verify `swift build` passes

Story 1.3 will add a CI drift check that compares iOS DTO field names against the generated OpenAPI spec.

## Build

```bash
cd TodosApp && swift build      # SPM build (macOS)
```

For iOS simulator, use Xcode: Cmd+B / Cmd+R / Cmd+U.
