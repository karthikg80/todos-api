# React Test Coverage Improvement Session — Summary

**Date:** April 6, 2026
**Session Goal:** Increase React client test coverage from baseline to "high standards" (70%+ target)

## Session Overview

This session focused on systematically adding unit tests to the React client application (`client-react/`), which previously had minimal test coverage. The approach was phased, starting with the highest-ROI components (core hooks, stores, and API layer) before moving to UI components.

## Coverage Progress

| Phase | Tests Added | Total Tests | Coverage Before | Coverage After | Delta |
|-------|------------|-------------|-----------------|----------------|-------|
| Baseline | — | 172 | 17.04% | 17.04% | — |
| Phase 1 | 67 | 239 | 17.04% | 19.31% | +2.27 pts |
| Phase 2 | 36 | 275 | 19.31% | 20.3% | +0.99 pts |
| Phase 3 | 34 | 309 | 20.3% | 23.89% | +3.59 pts |
| **Total** | **137** | **309** | **17.04%** | **23.89%** | **+6.85 pts** |

## PRs Merged

| PR | Title | Tests | Coverage Impact |
|----|-------|-------|-----------------|
| [#875](https://github.com/karthikg80/todos-api/pull/875) | Phase 1: Core hooks and stores | 67 | +2.27 pts |
| [#877](https://github.com/karthikg80/todos-api/pull/877) | Phase 2: Todo components | 36 | +0.99 pts |
| [#879](https://github.com/karthikg80/todos-api/pull/879) | Phase 3: FilterPanel and TodoDrawer | 34 | +3.59 pts |

## Coverage by Directory (After Session)

| Directory | Coverage | Tests Added |
|-----------|----------|-------------|
| `src/store/` | 96.61% | 14 tests |
| `src/api/client.ts` | 95.24% | 14 tests |
| `src/hooks/` | 46.17% | 49 tests |
| `src/components/todos/` | 19.8% | 73 tests |
| `src/components/layout/` | 13.14% | 0 tests |
| `src/components/shared/` | 9.37% | 0 tests |
| `src/components/home/` | 17% | 0 tests |
| `src/mobile/` | ~2% | 0 tests |
| `src/auth/` | 0% | 0 tests |
| `src/landing/` | 0% | 0 tests |

## New Test Files Created

### Phase 1: Core Hooks and Stores
| File | Tests | Description |
|------|-------|-------------|
| `store/useTodosStore.test.ts` | 11 | Full CRUD with optimistic updates, stale load handling |
| `store/useProjectsStore.test.ts` | 3 | Load + graceful error handling |
| `api/client.test.ts` | 14 | Auth headers, token refresh, 401 flow, URL building |
| `hooks/useHashRoute.test.ts` | 6 | Task routing, hashchange lifecycle |
| `hooks/useDarkMode.test.ts` | 11 | Toggle, persistence, system theme |
| `hooks/useDensity.test.ts` | 9 | Cycle through compact/normal/spacious |
| `hooks/useCaptureRoute.test.ts` | 13 | Debounce, AI suggestions, confidence thresholds |

### Phase 2: Todo Components
| File | Tests | Description |
|------|-------|-------------|
| `components/todos/TodoRow.test.tsx` | 21 | Checkbox, editing, lifecycle actions, kebab menu, previews |
| `components/todos/TodoList.test.tsx` | 8 | Loading/error/empty states, row rendering, toggle, click handlers |
| `components/todos/BulkToolbar.test.tsx` | 7 | Select all, complete, delete, cancel actions |

### Phase 3: FilterPanel and TodoDrawer
| File | Tests | Description |
|------|-------|-------------|
| `components/todos/FilterPanel.test.ts` | 13 | Pure `applyFilters` function covering all date filters |
| `components/todos/FilterPanel.test.tsx` | 10 | UI: date tabs, selects, clear all, close button |
| `components/todos/TodoDrawer.test.tsx` | 11 | Close interactions, save states, delete, no-save edge cases |

## Remaining Gaps (Uncovered or Low Coverage)

### High Priority (Large Components)
| Component | Lines | Coverage | Why Hard |
|-----------|-------|----------|----------|
| `FieldRenderer.tsx` | 647 | 0% | Complex dispatch with 10+ field variants, async loading |
| `SortableTodoList.tsx` | 354 | 0% | dnd-kit integration, drag-and-drop, grouping, sorting |
| `TaskComposer.tsx` | 272 | 0% | Form state, AI assist integration, capture route |
| `TaskFullPage.tsx` | 358 | 0% | Similar to TodoDrawer but with all fields |

### Medium Priority
| Component | Lines | Coverage | Why Medium |
|-----------|-------|----------|------------|
| `FilterPanel.tsx` | 227 | 5.5% | Partially covered in Phase 3 |
| `components/layout/AppShell.tsx` | 1,450 | 0% | Massive component, mobile/desktop variants |
| `components/shared/CommandPalette.tsx` | 439 | 0% | Complex keyboard navigation, fuzzy search |
| `components/shared/OnboardingFlow.tsx` | 623 | 0% | Multi-step wizard with state machine |

### Low Priority (Smaller or Less Critical)
| Component | Lines | Coverage |
|-----------|-------|----------|
| `TodoDrawer.tsx` | 193 | ~40% |
| `hooks/useTuneUp.ts` | 232 | 72.72% |
| `hooks/useViewSnapshot.ts` | 24 | 95.83% |

## Testing Strategy Used

1. **Pure function first** — `applyFilters` was tested as a pure function with no mocking needed
2. **Store hooks** — Used `@testing-library/react`'s `renderHook` + `act` for state management hooks
3. **API client** — Mocked `fetch` and `window.location` to test auth flow, token refresh, 401 handling
4. **UI components** — Used `@testing-library/react` with `createElement` (since the codebase uses `createElement` rather than JSX in tests)
5. **Component integration** — Tested interactions like checkbox clicks, button clicks, keyboard events

## Configuration Added

- **`vitest.config.ts`** — Added coverage configuration with v8 provider, thresholds (15% lines, 10% branches/functions), and exclusions
- **`client-react/package.json`** — Added `test:coverage` script
- **`@vitest/coverage-v8`** — Added as dev dependency

## Next Steps (Future Sessions)

### Phase 4: Large Components
1. `FieldRenderer.tsx` — Test each variant (chips, date-shortcuts, collapsible, presets, select, date)
2. `SortableTodoList.tsx` — Mock dnd-kit, test grouping, sorting, drag handlers
3. `TaskComposer.tsx` — Form validation, AI assist integration, submission

### Phase 5: Layout and Shell
1. `AppShell.tsx` — Mobile vs desktop rendering, navigation, sidebar
2. `CommandPalette.tsx` — Search, navigation, keyboard shortcuts
3. `HomeDashboard.tsx` — Focus brief rendering, panel rendering

### Phase 6: Mobile
1. `MobileShell.tsx` — Tab navigation, overlays, profile sheet
2. Mobile screens — FocusScreen, TodayScreen, ProjectsScreen

## Infrastructure Improvements Made

1. **Vitest coverage config** — Standardized coverage reporting with thresholds
2. **Test organization** — Grouped tests by directory matching source structure
3. **Mock patterns** — Established patterns for mocking `api/client`, `window.location`, `fetch`
4. **Test utilities** — Created `makeTodo` helper factory used across multiple test files

## Lessons Learned

1. **`createElement` pattern** — The codebase uses `createElement` in tests rather than JSX, which requires careful import handling
2. **`window.location` mocking** — Required `vi.spyOn` for hash-based routing tests
3. **`@testing-library/react` compatibility** — Some components don't play well with jsdom's limited CSS/layout support
4. **Focus trap testing** — `useOverlayFocusTrap` is hard to test in jsdom; may need custom hook testing approach
5. **dnd-kit testing** — Drag-and-drop requires significant mock setup; may need `@dnd-kit/testing` utilities

## Conclusion

The session achieved a **6.85 percentage point increase** in overall coverage (17.04% → 23.89%) with **137 new tests** across **13 test files**. The foundation is now solid with core infrastructure (stores, API client, hooks) well-tested at 46%+. The remaining work focuses on large, complex UI components that will require more time and specialized testing strategies.

At the current pace of ~35 tests per phase, reaching 70% coverage would require approximately **10-12 more phases** (350-400 additional tests), primarily targeting the large uncovered components listed above.
