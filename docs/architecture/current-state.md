# Current Architecture

## Overview

Monolithic Express/PostgreSQL backend (TypeScript, Prisma ORM) with a vanilla JS single-page frontend (no build step). An external Python worker (`agent-runner/`) handles scheduled automation jobs via Railway cron.

## Frontend (`client/`)

### Module layout

| Layer | Files | Purpose |
|-------|-------|---------|
| `app.js` (1,791 lines) | 1 | Composition root: imports ~420 named exports from 22 modules, assigns ~120 functions to `window`, wires `hooks`, binds delegated DOM events |
| `modules/` (18,000+ lines) | 32 | Domain logic: todos, projects, drawer, AI workspace, quick entry, command palette, auth, drag-drop, etc. |
| `utils/` | 10 | Shared helpers: API client, auth session, DOM selectors, theme, project paths, lint heuristics |
| `vendor/chrono-node/` | ~80 | Vendored natural date parsing library |

### Key patterns

- **Event delegation:** `app.js` binds `click`, `submit`, `input`, etc. on `document` and resolves handlers via `data-onclick`, `data-onsubmit`, `data-oninput` attributes. Functions must be on `window` to be callable from HTML.
- **Hooks registry:** `store.js` exports a `hooks` object. `app.js` assigns ~137 functions to `hooks.*` at startup, breaking circular imports. Modules call `hooks.X()` instead of importing directly.
- **EventBus:** Minimal pub-sub (17 lines). Only two events in use: `todos:changed` (triggers filter + render) and `todos:render` (render only).
- **State actions:** `stateActions.js` (688 lines) implements `applyUiAction()`, `applyAsyncAction()`, `applyDomainAction()` with named action types (e.g., `TODO_CREATED`, `DRAWER_OPEN`).
- **DOM patching:** `todosViewPatches.js` (378 lines) provides keyed micro-patches (e.g., `patchTodoRowCompletion`, `patchTodoRowSelection`) to avoid full rerenders for single-todo updates.

### Shared mutable state (`store.js`)

A single `state` object (342 lines, ~100 properties) is imported and mutated directly by all 32 modules. Properties span auth, todos, projects, drawer, rail, AI workspace, command palette, quick entry, home dashboard, and bulk selection.

### Top 10 risky frontend couplings

1. `app.js` imports ~420 named exports — any rename breaks HTML `data-onclick` bindings
2. `drawerUi.js` (2,146 lines) mixes rendering, draft management, AI assist, and kebab menu
3. `filterLogic.js` `renderTodos()` does full innerHTML replacement for the visible list
4. `projectsState.js` (1,391 lines) handles CRUD, headings, catalog, dialogs, and rail updates
5. `aiWorkspace.js` (1,517 lines) owns critique, plan, and brain-dump flows in one module
6. `hooks` object (137 assignments) acts as a service locator, obscuring the dependency graph
7. `state` object is mutated directly — no encapsulation or change notification
8. `window.*` bridge (~120 assignments) couples HTML templates to JS function names
9. `onCreateAssist.js` (1,281 lines) manages complex on-create AI suggestion lifecycle
10. Multiple modules call `EventBus.dispatch("todos:changed")` — render triggers are scattered

## Backend (`src/`)

### Module layout

| Layer | Files | Purpose |
|-------|-------|---------|
| `routes/` | 14 routers | HTTP endpoints (138 routes total) |
| `services/` | 49 files (13,882 lines) | Business logic, persistence, AI orchestration |
| `agent/` | 2 files | Agent executor (3,362 lines) + context |
| `mcp/` | 5 files | MCP protocol (auth, errors, OAuth pages, scopes, tool catalog) |
| `middleware/` | 4 files | Auth, admin, agent auth, rate limiting |
| `interfaces/` | 4 files | Service interfaces (ITodoService, IProjectService, etc.) |

### Route domains

| Mount | Router | Auth | Rate limit |
|-------|--------|------|-----------|
| `/auth` | authRouter | Public | authLimiter (5/15min) |
| `/oauth`, `/.well-known` | mcpPublicRouter | Public | mcpPublicLimiter (60/min) |
| `/todos` | todosRouter | JWT | apiLimiter (100/15min) |
| `/projects` | projectsRouter | JWT | apiLimiter |
| `/ai` | aiRouter + prioritiesBriefRouter | JWT | apiLimiter |
| `/agent` | agentRouter | Agent auth | apiLimiter |
| `/mcp` | mcpRouter | MCP OAuth | apiLimiter |
| `/capture` | captureRouter | JWT | apiLimiter |
| `/feedback` | feedbackRouter | JWT | apiLimiter |
| `/preferences` | preferencesRouter | JWT | apiLimiter |
| `/admin` | adminRouter | JWT + admin | apiLimiter |
| `/api/agent-enrollment` | enrollmentRouter | JWT | apiLimiter |

### Agent executor (`agentExecutor.ts` — 3,362 lines)

Dispatches 98 actions (40 read, 53 write, 5 system) in a single file. All MCP tools and agent API routes delegate to this executor. Features: zod validation per action, idempotency (SHA-256 input hashing, 7-day TTL), structured error envelopes, audit logging.

### Data model (Prisma — 26 models)

**Core:** User, Todo, Project, Heading, Subtask, Area, Goal
**AI:** AiSuggestion, AiSuggestionAppliedTodo, CaptureItem
**Agent:** AgentIdempotencyRecord, AgentActionAudit, AgentJobRun, FailedAutomationAction, AgentConfig, AgentEnrollment, AgentMetricEvent
**OAuth:** RefreshToken, McpAssistantSession, McpAuthorizationCode, McpRefreshToken
**Analytics:** TaskRecommendationFeedback, UserDayContext, LearningRecommendation, UserPlanningPreferences, FeedbackRequest

### Top 5 long-running backend flows

1. `POST /ai/{surface}/generate` — LLM call + DB queries + quota + throttle + normalization
2. `POST /agent/write/weekly_review` — Multi-table analysis + optional LLM + metric aggregation
3. `POST /agent/write/plan_project` — Project decomposition + LLM planning
4. `POST /feedback/admin/promote` — AI triage + GitHub search + issue creation
5. `POST /ai/critique-task` — LLM critique + subtask suggestion + apply

### External dependencies

| Service | Purpose |
|---------|---------|
| PostgreSQL | Primary data store (Prisma ORM) |
| OpenAI-compatible LLM | AI suggestions, critique, planning, decision assist |
| SMTP (Nodemailer) | Email verification, password reset |
| GitHub API | Feedback deduplication, issue search/creation |

## Agent Runner (`agent-runner/`)

A **Python worker** deployed on Railway cron with 7 job types:

| Job | Trigger | Purpose |
|-----|---------|---------|
| `daily` | Cron | Plan today + ensure next action for each enrolled user |
| `weekly` | Cron | Weekly review + safe apply |
| `inbox` | Cron | Classify + apply capture items |
| `watchdog` | Cron | Stale tasks + waiting follow-ups |
| `decomposer` | Cron | Stuck projects + next actions |
| `evaluator_daily` | Cron | Evaluate daily plan quality |
| `evaluator_weekly` | Cron | Evaluate weekly system health |

Architecture: reads enrollment from Postgres → exchanges refresh token for short-lived JWT → calls Node API via HTTP → persists results to AgentJobRun table. Supports dry-run, auto-apply policies, and delivery modes (log/email/slack).

## Testing

| Suite | Files | Runner | Scope |
|-------|-------|--------|-------|
| Unit | 17 `.test.ts` | Jest (SKIP_DB_SETUP=true) | Services, validators, engines |
| Integration | 6 `.integration.test.ts` | Jest + Postgres | API contracts, DB flows |
| MCP | Separate config | Jest | MCP protocol compliance |
| UI | `tests/ui/*.spec.ts` | Playwright | Chromium desktop + mobile |
| Eval | `evals/` | Custom | Agent/planner/decision quality |
