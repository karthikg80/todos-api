---
name: ios-app
description: Conventions for the SwiftUI iOS app in ios/TodosApp/
---

# iOS App Conventions

## Architecture

- **iOS 17+**, SwiftUI, Observation framework (`@Observable`)
- **MVVM** with feature-based folders and explicit dependency injection
- **Zero third-party dependencies** — URLSession, Security (Keychain), native SwiftUI
- **Actor-based networking:** `APIClient` (actor) and `SessionCoordinator` (actor)

## Key Design Decisions

- `AppState` is `@MainActor @Observable` — all auth status mutations happen on main actor
- `APIClient` has two paths: `send()` (authenticated + retry) and `sendUnauthenticated()` (raw, for login/register/refresh)
- `SessionCoordinator` serializes token refresh — multiple concurrent 401s coalesce into one refresh request
- `TokenStorage` uses Keychain via Security framework — stores access + refresh tokens together
- `AppEnvironment` is the DI container, injected via SwiftUI `.environment()`
- Services conform to protocols (`TodoServicing`, `ProjectServicing`, etc.) for testability

## Shared Contract

`src/types.ts` is the source of truth. iOS models live in `ios/TodosApp/TodosApp/Core/Models/`.

When `src/types.ts` changes (new enums, new fields):
1. Update `Enums.swift` for new enum cases
2. Update the relevant DTO file for new fields (as optionals to avoid decoding failures)
3. Verify `swift build` passes

## Build & Test

```bash
cd ios/TodosApp && swift build          # SPM build (macOS)
# For iOS simulator, use Xcode: Cmd+B / Cmd+R / Cmd+U
```

## File Structure

- `TodosApp/App/` — entry point, AppState, AppEnvironment, ContentView
- `TodosApp/Core/Network/` — APIClient, SessionCoordinator, TokenStorage, endpoints
- `TodosApp/Core/Models/` — Codable DTOs mirroring src/types.ts
- `TodosApp/Core/Services/` — Protocol definitions + implementations
- `TodosApp/Features/` — Auth, Todos, Projects, Today, Settings (MVVM)
- `TodosApp/Components/` — Shared UI (StatusPicker, PriorityBadge, etc.)
- `TodosAppTests/` — Unit tests with MockURLProtocol + MockServices
