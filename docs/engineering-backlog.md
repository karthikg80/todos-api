# Engineering Backlog

GitHub-ready engineering backlog grounded in the repository state as verified on 2026-04-19.

This file is a drafting artifact for GitHub Issues and Projects. It is not intended to replace live issue tracking in GitHub.

## Verified Baseline

- API health probes already exist in `src/server.ts` at `GET /healthz` and `GET /readyz`.
- The backend already has structured request correlation and baseline latency logging in `src/infra/logging/logger.ts`, `src/infra/logging/requestId.ts`, and `src/infra/metrics/routeLatency.ts`.
- CI already has path-based change detection, separate unit/integration/UI tiers, shared-contract cross-client checks, and 4-way Playwright sharding in `.github/workflows/ci.yml`.
- The shared contract is duplicated across multiple surfaces:
  - canonical TypeScript domain model in `src/types.ts`
  - separate OpenAPI description in `src/swagger.ts`
  - separate React transport types in `client-react/src/types/index.ts`
  - hand-maintained Swift DTOs in `ios/TodosApp/TodosApp/Core/Models/*.swift`
  - loose Python dict-based client code in `agent-runner/mcp_client.py`
- `agent-runner/` is about 3.1k LOC across `main.py`, `jobs/*.py`, and `storage/*.py`, but there are no tests, no lint config, no typing config, and no Python CI workflow.
- iOS has only a narrow `swift build` check in CI when shared contracts change, and only three test files under `ios/TodosApp/TodosAppTests/`.
- Coverage ratchet baseline is still modest in `.coverage-baseline.json`:
  - statements `37.56`
  - branches `27.95`
  - functions `35.12`
  - lines `38.75`

## Do Not Queue Blindly

- Do not open a backlog item for adding `/healthz` or `/readyz`; they already exist in `src/server.ts`.
- Do not describe the repo as having "zero observability"; it already has structured logs, request IDs, and latency logging. The actual gap is error aggregation and tracing.
- Do not open a generic "replace hash routing with react-router" task without a focused product or architecture problem statement. The app currently mixes pathname-based surface selection in `client-react/src/App.tsx` with narrow hash helpers in `client-react/src/hooks/useHashRoute.ts`.
- Do not treat all `as any` uses as equally urgent. Most are in tests. Runtime cleanup should target production paths first.

## Recommended Labels

- `epic`
- `story`
- `backend`
- `frontend`
- `ios`
- `agent-runner`
- `ci`
- `docs`
- `observability`
- `contracts`
- `p0`
- `p1`
- `p2`

## Epic 1: Establish A Single Transport Contract Strategy

### Epic Issue

**Title**
`Epic: collapse cross-client contract drift`

**Labels**
`epic`, `contracts`, `backend`, `frontend`, `ios`, `agent-runner`, `p0`

**Problem**
The repo currently maintains the same API shape in at least five places. `src/types.ts` is treated as canonical in docs, but it is not the only source that clients actually consume.

**Goal**
Define one durable transport contract strategy and eliminate accidental drift between backend, React, iOS, and Python consumers.

**Success criteria**
- There is a written decision for domain types vs transport DTOs.
- The backend, web, iOS, and Python surfaces all consume the same transport contract source.
- Shared-contract changes fail fast in CI when any client falls out of sync.

### Story 1.1

**Title**
`Story: define the source of truth for transport DTOs and separate it from backend domain types`

**Labels**
`story`, `contracts`, `backend`, `docs`, `p0`

**Suggested owner**
`Claude`

**Dependencies**
- None

**Scope**
- Decide whether OpenAPI or generated transport DTOs become the source of truth for client-facing payloads.
- Document how transport DTOs differ from backend domain types in `src/types.ts`.
- Explicitly address `Date` vs ISO string handling.

**Acceptance criteria**
- A short ADR or equivalent doc exists.
- The repo no longer describes `src/types.ts` as the only canonical source without qualification.
- The decision names migration steps for React, iOS, and Python consumers.

### Story 1.2

**Title**
`Story: replace hand-maintained React transport types with generated or shared transport DTOs`

**Labels**
`story`, `contracts`, `frontend`, `backend`, `p0`

**Suggested owner**
`Codex`

**Dependencies**
- Story 1.1

**Scope**
- Replace `client-react/src/types/index.ts` with generated or centrally shared transport types.
- Update API helpers in `client-react/src/api/*.ts` to consume the same DTO layer.
- Keep browser behavior unchanged.

**Acceptance criteria**
- React no longer hand-maintains duplicate core todo/project/user transport fields.
- Typecheck remains green for both root and `client-react`.
- Shared-contract CI catches drift through actual generated or shared files.

### Story 1.3

**Title**
`Story: define the iOS and Python sync path for transport contracts`

**Labels**
`story`, `contracts`, `ios`, `agent-runner`, `p1`

**Suggested owner**
`Claude`

**Dependencies**
- Story 1.1

**Scope**
- Choose whether iOS consumes generated models or a documented manual sync layer.
- Choose whether `agent-runner` stays dict-based temporarily or adopts generated typed models.
- Document the minimum acceptable sync guarantees for both clients.

**Acceptance criteria**
- There is an explicit, reviewed path for iOS DTO maintenance.
- There is an explicit, reviewed path for Python payload typing.
- The repo no longer relies on implied manual sync across four surfaces.

## Epic 2: Bring Non-Node Surfaces Into CI

### Epic Issue

**Title**
`Epic: make iOS and agent-runner first-class CI citizens`

**Labels**
`epic`, `ci`, `ios`, `agent-runner`, `p0`

**Problem**
The Node/React surfaces have meaningful CI coverage, but iOS and Python do not. That makes shared-contract and background-job regressions easier to ship.

**Goal**
Add lightweight, reliable CI gates for iOS and `agent-runner` without expanding scope into broad platform rewrites.

**Success criteria**
- Python lint/type/test checks run in CI.
- iOS tests run in CI on relevant changes.
- Failing client drift is caught before merge, not by manual review.

### Story 2.1

**Title**
`Story: add agent-runner lint, typing, and smoke tests to CI`

**Labels**
`story`, `ci`, `agent-runner`, `p0`

**Suggested owner**
`Codex`

**Dependencies**
- None

**Scope**
- Add Python project config for linting and typing.
- Add a minimal pytest suite around `agent-runner/main.py`, `mcp_client.py`, and one or two core jobs.
- Add a CI workflow or CI job for the Python checks.

**Acceptance criteria**
- `agent-runner` has a reproducible lint/type/test command set.
- CI runs the checks on Python-relevant changes.
- The first tests cover token exchange, one read action, and one write action boundary.

### Story 2.2

**Title**
`Story: expand iOS CI from build-only to build-plus-test`

**Labels**
`story`, `ci`, `ios`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- None

**Scope**
- Extend current shared-contract `swift build` coverage to run `swift test`.
- Decide trigger rules for iOS-specific changes vs shared-contract changes.
- Keep the workflow narrow and stable; do not introduce broad Xcode automation unless needed.

**Acceptance criteria**
- iOS tests run in CI on at least iOS-path and shared-contract changes.
- A failing model decode or service unit test blocks merge.
- CI still remains comprehensible and change-gated.

## Epic 3: Finish Baseline Observability Without Reopening Solved Problems

### Epic Issue

**Title**
`Epic: add error aggregation and traceable failure paths`

**Labels**
`epic`, `observability`, `backend`, `frontend`, `agent-runner`, `p1`

**Problem**
The repo already has logs and health probes, but it still lacks a durable error aggregation and end-to-end request tracing strategy.

**Goal**
Capture production failures with enough context to debug them across the API, React app, and agent-runner.

**Success criteria**
- Backend and web fatal errors are reported with release/environment context.
- Crash handling has an explicit terminate-or-recover policy.
- Request correlation can follow work from API entrypoint into agent-runner calls.

### Story 3.1

**Title**
`Story: land backend and web error aggregation with an explicit fatal-error policy`

**Labels**
`story`, `observability`, `backend`, `frontend`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- None

**Scope**
- Add or refine error aggregation for Node and React.
- Ensure fatal-process handlers capture and then terminate cleanly instead of leaving the process alive in an undefined state.
- Keep PII defaults conservative.

**Acceptance criteria**
- Fatal backend errors are captured and the process exits intentionally.
- Frontend error reports include release and environment data.
- The implementation does not duplicate existing health or request-ID features.

### Story 3.2

**Title**
`Story: propagate request and job correlation into agent-runner`

**Labels**
`story`, `observability`, `backend`, `agent-runner`, `p2`

**Suggested owner**
`Codex`

**Dependencies**
- Story 3.1

**Scope**
- Standardize one correlation field between `src/infra/logging/requestId.ts` and `agent-runner/mcp_client.py`.
- Ensure background jobs log or emit the originating request or run identifier.
- Prefer a thin implementation over a full tracing platform rewrite.

**Acceptance criteria**
- API logs and agent-runner logs share one stable correlation identifier.
- A single failing agent-triggered workflow can be followed across process boundaries.

## Epic 4: Reduce Production Architectural Hotspots

### Epic Issue

**Title**
`Epic: remove database access and shape drift from hot HTTP paths`

**Labels**
`epic`, `backend`, `contracts`, `p1`

**Problem**
Most routes are reasonably thin, but a few routers still own persistence and response shaping directly. A few runtime paths also still reach for `as any` instead of typed narrowing.

**Goal**
Move the remaining production hotspots toward the same service and type discipline as the stronger parts of the backend.

**Success criteria**
- Targeted routers stop calling Prisma directly.
- Production `as any` usage drops in runtime files that participate in core planning flows.
- Route handlers remain orchestration-only.

### Story 4.1

**Title**
`Story: extract preferences, adaptation, and agent activity persistence out of route handlers`

**Labels**
`story`, `backend`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- None

**Scope**
- Move DB access out of:
  - `src/routes/preferencesRouter.ts`
  - `src/routes/adaptationRouter.ts`
  - `src/routes/agentActivityRouter.ts`
- Preserve API shapes and existing tests.

**Acceptance criteria**
- These routers no longer instantiate or call Prisma queries directly.
- Errors flow through shared error handling instead of custom 500 branches where avoidable.
- Tests cover the extracted service behavior.

### Story 4.2

**Title**
`Story: remove runtime any-casts from planner and agent execution paths`

**Labels**
`story`, `backend`, `contracts`, `p2`

**Suggested owner**
`Codex`

**Dependencies**
- Story 1.1

**Scope**
- Replace runtime `as any` uses in:
  - `src/domains/agent/services/planScorer.ts`
  - `src/services/planner/plannerHeuristics.ts`
  - `src/agent/agentExecutor.ts`
  - other production paths reached by agent/planner execution
- Leave test-only casts for later cleanup.

**Acceptance criteria**
- Core runtime paths stop depending on unsafe casts for goal/project access.
- Types accurately model the data those paths consume.

## Epic 5: Raise Confidence In High-Risk Logic

### Epic Issue

**Title**
`Epic: spend the coverage ratchet on the riskiest behaviors`

**Labels**
`epic`, `backend`, `agent-runner`, `ci`, `p1`

**Problem**
The repo already enforces a coverage ratchet, but the current baseline is still low and not obviously concentrated around the riskiest logic.

**Goal**
Raise confidence in auth/session, planning, preferences, and background-job behaviors before chasing broad percentage wins.

**Success criteria**
- Coverage increases in the highest-risk areas.
- New tests are stable and directly tied to production-sensitive logic.
- The ratchet can be raised without inflating low-value test count.

### Story 5.1

**Title**
`Story: add targeted backend tests for auth, refresh, planning preferences, and planner heuristics`

**Labels**
`story`, `backend`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- None

**Scope**
- Add or strengthen tests around:
  - `src/services/authService.ts`
  - token refresh behavior in the auth flow
  - `src/routes/preferencesRouter.ts` or its extracted service
  - planner heuristics and goal/project selection logic

**Acceptance criteria**
- New tests cover failure modes, not just happy paths.
- Coverage ratchet rises in a measurable way.

### Story 5.2

**Title**
`Story: add first real tests for daily, inbox, watchdog, and decomposer agent jobs`

**Labels**
`story`, `agent-runner`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- Story 2.1

**Scope**
- Add focused tests around job gating, idempotency/state handling, and API call boundaries for:
  - `agent-runner/jobs/daily.py`
  - `agent-runner/jobs/inbox.py`
  - `agent-runner/jobs/watchdog.py`
  - `agent-runner/jobs/decomposer.py`

**Acceptance criteria**
- At least the highest-risk job orchestration paths are covered.
- Tests run in CI and are isolated from live services.

## Epic 6: Clean Up Stale Documentation And Entry Points

### Epic Issue

**Title**
`Epic: make docs match the current product and architecture`

**Labels**
`epic`, `docs`, `p2`

**Problem**
Several top-level docs lag the actual repo state, which makes audits and onboarding noisier than they need to be.

**Goal**
Consolidate entry points and remove stale summaries so docs stop fighting the codebase.

**Success criteria**
- New contributors can find the right starting docs quickly.
- High-level summaries do not mention removed or legacy surfaces as current architecture.
- Durable docs are linked from `docs/README.md`.

### Story 6.1

**Title**
`Story: update stale top-level summaries to reflect the current React-first client architecture`

**Labels**
`story`, `docs`, `p2`

**Suggested owner**
`Claude`

**Dependencies**
- None

**Scope**
- Update stale summaries such as `PROJECT_SUMMARY.md` that still describe the removed `client/` app as current.
- Keep historical references only in archive/reference docs.

**Acceptance criteria**
- Top-level summaries match the actual repo layout.
- Legacy client references are clearly marked as historical.

### Story 6.2

**Title**
`Story: keep one durable engineering backlog and point docs navigation at it`

**Labels**
`story`, `docs`, `p2`

**Suggested owner**
`Codex`

**Dependencies**
- None

**Scope**
- Keep this engineering backlog linked from `docs/README.md`.
- Avoid creating overlapping roadmap/backlog docs for the same engineering scope.

**Acceptance criteria**
- `docs/README.md` points to this file.
- Future engineering planning can reuse this structure instead of creating another orphan backlog.

## Suggested Execution Order

1. `Epic 1 / Story 1.1` — contract-source decision before generator work.
2. `Epic 2 / Story 2.1` — Python CI and first tests.
3. `Epic 3 / Story 3.1` — finish error aggregation with correct fatal-process behavior.
4. `Epic 4 / Story 4.1` — extract the remaining direct Prisma hotspots from routers.
5. `Epic 5 / Story 5.1` and `5.2` — spend test effort on the most failure-prone logic.
6. `Epic 1 / Stories 1.2 and 1.3` — execute the chosen contract migration.
7. `Epic 2 / Story 2.2` and `Epic 6` — broaden platform/docs discipline once the highest-risk backend gaps are covered.
