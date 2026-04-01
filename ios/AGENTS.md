# iOS App

SwiftUI (iOS 17+) in `TodosApp/`. Swift Package — zero third-party dependencies.

## Architecture

- `@Observable` with `@MainActor` on AppState — all auth mutations on main actor
- Actor-based `APIClient` with two paths: `send()` (authenticated + retry) and `sendUnauthenticated()` (raw)
- `SessionCoordinator` actor serializes token refresh (single-flight)
- `AppEnvironment` is the DI container, services conform to protocols for testability

## Shared Contract

`src/types.ts` (repo root) is the source of truth. iOS DTOs live in `TodosApp/TodosApp/Core/Models/`.

When `src/types.ts` changes:
1. Update `Enums.swift` for new enum cases
2. Update the relevant DTO file for new fields (as optionals)
3. Verify `swift build` passes

## Build

```bash
cd TodosApp && swift build      # SPM build (macOS)
```

For iOS simulator, use Xcode: Cmd+B / Cmd+R / Cmd+U.
