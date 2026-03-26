# Architecture Summary for Agents

**Repository:** `todos-api`  
**Version:** 1.6.0  
**Last Updated:** 2026-03-25  
**Stack:** Express 5 + TypeScript + Prisma + PostgreSQL + Vanilla JS (no framework)

---

## Quick Reference

| Aspect       | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| **Frontend** | `client/` — Vanilla ES6 modules, no build step, no framework         |
| **Backend**  | `src/` — TypeScript, Express 5, Prisma ORM                           |
| **Database** | PostgreSQL 16 (14 models, 15+ enums)                                 |
| **Testing**  | Jest (unit/integration), Playwright (UI), Custom (AI evals)          |
| **Auth**     | JWT + refresh rotation, Google OAuth, Apple Sign-In, Phone SMS OTP   |
| **AI**       | OpenAI-compatible API (planning, critique, suggestions)              |
| **MCP**      | Remote Model Context Protocol for AI assistant connectors            |
| **Worker**   | Python (`agent-runner/`) — scheduled automation jobs on Railway cron |

---

## Load-Bearing Patterns (DO NOT BREAK)

### Frontend

1. **Event Delegation** — `app.js` uses delegated listeners via `data-onclick` attributes. Never attach listeners directly to dynamic child elements.

2. **Filter Pipeline** — `#categoryFilter` + `filterTodos()` is the canonical filter path. All project/category/status filtering routes through it.

3. **Project Selection** — Use `setSelectedProjectKey(...)` for all project selection entry points. Do not bypass it.

4. **DOM-Ready Signal** — After auth/navigation, wait for `#todosView.active` + `#todosContent` visible + no `.loading` children. Use `waitForTodosViewIdle()` from `tests/ui/helpers/todos-view.ts`.

5. **Hooks Registry** — `hooks.*` object breaks circular dependencies. Modules call `hooks.X()` instead of importing directly.

6. **State Actions** — `stateActions.js` implements named state transitions (`applyUiAction`, `applyAsyncAction`, `applyDomainAction`).

### Backend

1. **Service Interfaces** — All services implement interfaces (`ITodoService`, `IProjectService`) for testability.

2. **Dual Implementation** — `TodoService` (in-memory for tests) vs `PrismaTodoService` (database-backed for runtime).

3. **Idempotency** — Agent actions use `AgentIdempotencyRecord` for retry safety (SHA-256 input hashing, 7-day TTL).

4. **Rate Limiting** — Per-route limits: auth (5/15min), email, API (100/15min), MCP (60/min).

5. **Structured Errors** — `HttpError` class with MCP-compatible error format.

---

## Directory Structure

```
todos-api/
├── client/                          # Frontend (static, no build step)
│   ├── app.js                       # Composition root (1,791 lines)
│   ├── index.html                   # SPA shell + landing + auth forms
│   ├── styles.css                   # All styles (dark mode support)
│   ├── bootstrap/                   # App initialization modules
│   ├── features/                    # Feature-domain modules
│   ├── modules/                     # Domain JS modules (32 files, 18K+ lines)
│   ├── utils/                       # Shared utilities (13 files)
│   ├── platform/                    # Platform abstractions
│   └── vendor/                      # Synced vendor assets (chrono-node)
│
├── src/                             # Backend TypeScript source
│   ├── server.ts                    # Entry point
│   ├── app.ts                       # Express app composition
│   ├── config.ts                    # Environment configuration
│   ├── routes/                      # Express routers (14 files, 138 routes)
│   ├── services/                    # Domain services (49 files, 13,882 lines)
│   ├── middleware/                  # Express middleware (4 files)
│   ├── interfaces/                  # Service contracts (4 files)
│   ├── validation/                  # Validation schemas
│   ├── agent/                       # Agent executor (3,362 lines)
│   ├── mcp/                         # MCP protocol (5 files)
│   └── infra/                       # Logging, metrics
│
├── prisma/
│   ├── schema.prisma                # Database schema (26 models, 15+ enums)
│   └── migrations/                  # Database migrations
│
├── agent-runner/                    # Python worker (scheduled jobs)
│   └── agent_runner/                # 7 job types: daily, weekly, inbox, watchdog, etc.
│
├── tests/
│   └── ui/                          # Playwright specs (40 files)
│       └── helpers/                 # UI test helpers (auth, DOM waits)
│
├── test/                            # Jest setup/teardown
│   ├── setup.ts                     # Global test DB setup
│   └── teardown.ts                  # Prisma disconnect
│
├── evals/                           # AI evaluation suites
│   ├── agent/                       # Agent evals
│   ├── decision-assist/             # AI decision evals
│   ├── mcp/                         # MCP connector evals
│   └── planner/                     # Planner evals
│
├── docs/                            # Documentation (27+ files)
│   ├── adr/                         # Architecture Decision Records (5 ADRs)
│   ├── agent-ops/                   # Agent operations
│   ├── architecture/                # Current/target state
│   ├── harness/                     # Test harness docs
│   ├── memory/                      # Context compaction
│   ├── ops/                         # Deployment runbooks
│   └── ui-revamp/                   # UI redesign specs
│
└── .github/workflows/
    ├── ci.yml                       # Unit + integration CI
    ├── mcp.yml                      # MCP protocol tests
    ├── ui-tests.yml                 # Playwright fast suite
    └── ui-visual.yml                # Visual snapshot tests
```

---

## Frontend Architecture

### Composition Model

```
┌─────────────────────────────────────────────────────────────┐
│ app.js (1,791 lines)                                        │
│ - Imports 420 named exports from 22+ modules                │
│ - Wires 137 hooks entries                                   │
│ - Binds delegated DOM events via data-onclick               │
│ - Exposes ~120 functions to window.*                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌─────────────────┐  ┌───────────────┐
│ store.js      │  │ todosService.js │  │ projectsState │
│ - state       │  │ - API calls     │  │ - Project CRUD│
│ - hooks       │  │ - Todo ops      │  │ - Headings    │
└───────────────┘  └─────────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Feature Modules (32 total)                                  │
│ - filterLogic.js (canonical filter pipeline)                │
│ - authUi.js (social/phone auth handlers)                    │
│ - aiWorkspace.js (AI plan/critique/brain-dump)              │
│ - drawerUi.js (todo edit drawer, 2,146 lines)               │
│ - railUi.js (projects sidebar navigation)                   │
│ - homeDashboard.js (AI-powered focus dashboard)             │
│ - commandPalette.js (Ctrl+K navigation)                     │
│ - quickEntry.js (natural date parsing)                      │
└─────────────────────────────────────────────────────────────┘
```

### State Management

**Single shared state object** (`store.js`, 342 lines, ~100 properties):

```javascript
state = {
  // Auth
  currentUser: null,
  accessToken: null,
  refreshToken: null,

  // Todos
  todos: [],
  filteredTodos: [],
  selectedTodoIds: new Set(),

  // Projects
  projects: [],
  selectedProjectKey: null,
  expandedHeadings: new Set(),

  // Drawer
  drawerOpen: false,
  drawerMode: null, // 'create' | 'edit' | 'view'
  draftTodo: null,

  // AI
  aiWorkspaceOpen: false,
  aiCriticResponse: null,
  aiPlanDraft: null,

  // UI
  darkMode: false,
  commandPaletteOpen: false,
  quickEntryOpen: false,
  // ... 80+ more properties
};
```

**Mutation pattern:** Direct mutation within named actions:

```javascript
// stateActions.js
function applyUiAction(actionType, payload) {
  switch (actionType) {
    case "TODO_CREATED":
      state.todos.push(payload.todo);
      state.filteredTodos = filterTodos();
      break;
    case "DRAWER_OPEN":
      state.drawerOpen = true;
      state.drawerMode = payload.mode;
      state.draftTodo = payload.todo;
      break;
    // ... 50+ action types
  }
  EventBus.dispatch("state:changed", { action: actionType, payload });
}
```

### Event System

**EventBus** (17 lines, pub-sub):

```javascript
// platform/events/eventBus.js
const listeners = new Map();

export function subscribe(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  return () => listeners.get(event).delete(callback);
}

export function dispatch(event, payload) {
  if (listeners.has(event)) {
    listeners.get(event).forEach((cb) => cb(payload));
  }
}

// In use:
EventBus.dispatch("todos:changed"); // Triggers filter + render
EventBus.dispatch("todos:render"); // Render only
```

### DOM Rendering

**Full list replacement** (common pattern):

```javascript
// filterLogic.js
export function renderTodos() {
  const container = document.getElementById("todosContent");
  const html = state.filteredTodos.map((todo) => renderTodoRow(todo)).join("");
  container.innerHTML = html; // Full replacement
}

// Micro-patches for single-todo updates:
// todosViewPatches.js (378 lines)
export function patchTodoRowCompletion(todoId, completed) {
  const row = document.querySelector(`[data-todo-id="${todoId}"]`);
  const checkbox = row.querySelector(".todo-checkbox");
  checkbox.checked = completed;
  row.classList.toggle("completed", completed);
}
```

---

## Backend Architecture

### Request Flow

```
┌─────────────────────────────────────────────────────────────┐
│ server.ts (entry point)                                     │
│ - Creates services (Prisma-backed)                          │
│ - Boots Express app                                         │
│ - Graceful shutdown handling                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ app.ts (composition root)                                   │
│ - Middleware stack (CORS, helmet, rate limiting, logging)   │
│ - Route registration                                        │
│ - Service injection                                         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌─────────────────┐  ┌───────────────┐
│ /auth         │  │ /todos          │  │ /projects     │
│ /ai           │  │ /users          │  │ /agent        │
│ /mcp          │  │ /capture        │  │ /feedback     │
│ /preferences  │  │ /admin          │  │               │
└───────────────┘  └─────────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Services Layer (49 files, 13,882 lines)                     │
│ - AuthService, SocialAuthService, PhoneAuthService          │
│ - PrismaTodoService, TodoService (in-memory for tests)      │
│ - ProjectService, HeadingService                            │
│ - AiPlannerService, AiSuggestionStore                       │
│ - AgentExecutor, McpOAuthService                            │
│ - FeedbackService (triage, duplicate, promotion, automation)│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Prisma ORM Layer                                            │
│ - schema.prisma (26 models, 15+ enums)                      │
│ - Auto-generated client                                     │
└─────────────────────────────────────────────────────────────┘
```

### Middleware Stack (in order)

```typescript
// app.ts
app.use(requestIdMiddleware); // Adds X-Request-ID
app.use(routeLatencyMetrics); // Prometheus metrics
app.use(cors({ origin: CORS_ORIGINS }));
app.use(
  helmet({
    // Security headers
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'nonce-<random>'"],
        // ...
      },
    },
  }),
);
app.use(rateLimiters.authLimiter); // 5 req / 15 min
app.use(rateLimiters.apiLimiter); // 100 req / 15 min
app.use(rateLimiters.mcpLimiter); // 60 req / min
app.use(cookieParser());
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

// Routes
app.use("/auth", authRouter);
app.use("/todos", todosRouter);
app.use("/projects", projectsRouter);
// ...
```

### Agent Architecture

**Dual-mode execution:**

```
┌─────────────────────────────────────────────────────────────┐
│ Scheduled Jobs (Python worker - agent-runner/)              │
│ - Deployed on Railway cron                                  │
│ - 7 job types: daily, weekly, inbox, watchdog, etc.         │
│ - Enrollment-based auth (refresh token → short-lived JWT)   │
│ - Calls Node API via HTTP                                   │
│ - Persists results to AgentJobRun table                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ On-Demand Jobs (sync - agentExecutor.ts)                    │
│ - User-triggered via API (POST /agent/write/*)              │
│ - 98 actions dispatched synchronously                       │
│ - Long-running LLM calls block Express event loop ⚠️        │
│ - Idempotency via AgentIdempotencyRecord                    │
└─────────────────────────────────────────────────────────────┘
```

**Agent executor** (`agentExecutor.ts`, 3,362 lines):

```typescript
// Simplified structure
export async function executeAgentAction(
  action: AgentAction,
  userId: string,
  input: unknown,
) {
  // 1. Validate input with Zod
  const validated = actionValidators[action].parse(input);

  // 2. Check idempotency (SHA-256 hash of action + input)
  const idempotencyKey = hashActionInput(action, validated);
  const existing = await checkIdempotency(idempotencyKey);
  if (existing) return existing.result;

  // 3. Dispatch to handler (98 actions)
  let result: unknown;
  switch (action) {
    case "plan_today":
      result = await handlePlanToday(userId, validated);
      break;
    case "break_down_project":
      result = await handleBreakDownProject(userId, validated);
      break;
    // ... 96 more cases
  }

  // 4. Persist audit log
  await persistAuditLog(userId, action, result);

  // 5. Cache result for idempotency
  await cacheIdempotencyResult(idempotencyKey, result);

  return result;
}
```

### Database Schema (Key Models)

```prisma
// Core models
model User {
  id            String    @id @default(uuid())
  email         String?   @unique
  password      String?   // nullable for social/phone users
  phoneE164     String?   @unique
  role          UserRole  @default(USER)
  plan          UserPlan  @default(FREE)
  socialAccounts SocialAccount[]
  refreshTokens RefreshToken[]
  todos         Todo[]
  projects      Project[]
  // ...
}

model SocialAccount {
  id                      String   @id @default(uuid())
  userId                  String
  provider                String   // "google" | "apple"
  providerSubject         String   // Provider's stable user ID
  emailAtProvider         String?
  emailVerifiedAtProvider Boolean  @default(false)
  user                    User     @relation(fields: [userId], references: [id])

  @@unique([provider, providerSubject])
}

model Todo {
  id              String         @id @default(uuid())
  userId          String
  title           String
  description     String?
  status          TodoStatus     @default(INBOX)
  priority        TodoPriority   @default(MEDIUM)
  dueDate         DateTime?
  projectId       String?
  headingId       String?
  dependsOnTaskIds String[]
  recurrenceType  TodoRecurrenceType?
  recurrenceRule  String?
  tags            String[]
  energy          TodoEnergy?
  source          TodoSource     @default(MANUAL)
  user            User           @relation(fields: [userId], references: [id])
  project         Project?       @relation(fields: [projectId], references: [id])
  heading         Heading?       @relation(fields: [headingId], references: [id])
  subtasks        Subtask[]
  aiSuggestions   AiSuggestion[]
  // ...
}

// AI/Agent models
model AiSuggestion {
  id          String             @id @default(uuid())
  userId      String
  type        AiSuggestionType   // "critique" | "plan" | "brain_dump"
  status      AiSuggestionStatus // "pending" | "applied" | "dismissed"
  input       Json
  output      Json
  appliedTodoIds String[]
  createdAt   DateTime           @default(now())
  user        User               @relation(fields: [userId], references: [id])
}

model AgentJobRun {
  id          String   @id @default(uuid())
  userId      String
  jobType     String   // "daily" | "weekly" | "inbox" | etc.
  status      String   // "pending" | "running" | "completed" | "failed"
  input       Json
  output      Json?
  startedAt   DateTime?
  completedAt DateTime?
  // ...
}

// MCP models
model McpAssistantSession { /* ... */ }
model McpAuthorizationCode { /* ... */ }
model McpRefreshToken { /* ... */ }
```

---

## Testing Strategy

### Test Pyramid

```
                    ┌─────────────────┐
                    │   UI (40 specs) │  Playwright (fast + visual)
                   ─├─────────────────┤─
                  │  Integration (6)  │  Jest + supertest + PostgreSQL
                 ──├─────────────────┤──
                │    Unit (17)        │  Jest (in-memory services)
               ───┴─────────────────┴───
```

### Required CI Checks

```bash
# All must pass for PR merge
npx tsc --noEmit                    # Type checking
npm run format:check                # Prettier
npm run lint:html                   # HTML validation
npm run lint:css                    # CSS linting
npm run test:unit                   # Unit tests (300+ tests)
CI=1 npm run test:ui:fast           # Fast UI suite (excludes @visual)
```

### UI Test Rules

1. **Fast suite** (`test:ui:fast`) — PR-gating tier, excludes `@visual` tests
2. **Full suite** (`test:ui`) — Includes visual snapshots
3. **Snapshot rules:**
   - Tests with `toHaveScreenshot()` MUST include `@visual` tag
   - CI runs on `ubuntu-latest` (macOS screenshots won't match)
   - Update snapshots in Docker for consistency
4. **Auth setup:** Use `openTodosViewWithStorageState()` or `bootstrapTodosContext()` from `tests/ui/helpers/todos-view.ts`
5. **DOM waits:** Use `waitForTodosViewIdle()` — never `page.waitForTimeout()`

### Test Database Strategy

- **Isolation:** Separate `todos_test` database
- **Setup:** `prisma migrate reset --force --skip-seed` before integration tests
- **Safety guards:**
  - Refuses URLs without "test" in name
  - Refuses non-local hosts (unless `ALLOW_REMOTE_TEST_DB=true`)
  - Validates PostgreSQL URL format

---

## Known Issues & Technical Debt

### Critical Hotspots

| File                         | Lines | Issue                                                              |
| ---------------------------- | ----- | ------------------------------------------------------------------ |
| `client/app.js`              | 1,791 | Imports 420 exports, wires 137 hooks, assigns 120 window functions |
| `client/drawerUi.js`         | 2,146 | Mixes rendering, draft management, AI assist, kebab menu           |
| `client/projectsState.js`    | 1,391 | Handles CRUD, headings, dialogs, rail updates                      |
| `client/aiWorkspace.js`      | 1,517 | Owns critique, plan, brain-dump in one module                      |
| `src/agent/agentExecutor.ts` | 3,362 | Dispatches 98 actions synchronously, blocking event loop           |
| `client/stateActions.js`     | 688   | 50+ action types, large switch statements                          |

### Open Issues

1. **8 pre-existing UI test failures** on master (error-state tests)
2. **30+ stale git branches** including worktrees
3. **Dual runtime** — Python worker + Node.js backend
4. **No async agent queue** — ADR-005 accepted but not implemented
5. **Frontend state coupling** — Direct mutation of shared `state` object

---

## Accepted ADRs

| ADR | Title                             | Status                                           |
| --- | --------------------------------- | ------------------------------------------------ |
| 001 | Frontend composition roots        | Accepted (not implemented)                       |
| 002 | Event bus contract                | Accepted                                         |
| 003 | Agent worker queue                | Accepted                                         |
| 004 | Domain-oriented backend structure | Accepted                                         |
| 005 | Agent execution architecture      | Accepted (BullMQ for on-demand, not implemented) |

---

## Environment Variables (Key)

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/todos_dev
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/todos_test

# Auth
JWT_ACCESS_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
ADMIN_BOOTSTRAP_SECRET=<optional>

# CORS
CORS_ORIGINS=https://app.example.com

# AI
AI_PROVIDER_ENABLED=true
AI_PROVIDER_API_KEY=<key>
AI_PROVIDER_MODEL=gpt-4o-mini
AI_DAILY_SUGGESTION_LIMIT=50

# Social Auth
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>
APPLE_CLIENT_ID=<id>
APPLE_TEAM_ID=<team>
TWILIO_ACCOUNT_SID=<sid>

# Feature Flags
GOOGLE_LOGIN_ENABLED=true
APPLE_LOGIN_ENABLED=true
PHONE_LOGIN_ENABLED=true
AI_DECISION_ASSIST=true
```

---

## Common Operations

### Local Development

```bash
# Start PostgreSQL
npm run docker:up

# Run migrations
npm run prisma:migrate

# Start dev server
npm run dev

# Run all checks
npm run check:all
```

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# UI fast suite
CI=1 npm run test:ui:fast

# UI full suite (includes visual)
npm run test:ui

# Update snapshots (in Docker for consistency)
docker run --rm -v "$(pwd)":/work -w /work \
  mcr.microsoft.com/playwright:v1.58.2 \
  /bin/bash -c "npm ci && npx playwright test --update-snapshots"
```

### Database

```bash
# Generate Prisma client
npm run prisma:generate

# Create migration
npm run prisma:migrate

# Deploy migrations (production)
npm run prisma:migrate:deploy

# Open Prisma Studio
npm run prisma:studio

# Reset database (WARNING: deletes all data)
npm run prisma:reset
```

---

## Security Checklist

- [x] JWT rotation on refresh
- [x] OAuth state parameter (CSRF prevention)
- [x] Apple nonce validation
- [x] Rate limiting per route
- [x] Helmet CSP headers
- [x] Input validation with Zod
- [x] Anti-enumeration (generic auth errors)
- [x] Idempotency for agent actions
- [ ] Dependency updates (manual)
- [ ] Security headers audit (periodic)

---

## Deployment

### Production Build

```bash
# Compile TypeScript
npm run build

# Deploy migrations
npm run prisma:migrate:deploy

# Start server
npm start
```

### Railway Deployment

- PostgreSQL via Railway managed database
- Python worker deployed as separate cron service
- Remote MCP surface enabled at `/mcp`

---

## Contact & Support

- **Issues:** https://github.com/karthikg80/todos-api/issues
- **Documentation:** `docs/` directory
- **ADRs:** `docs/adr/` directory
- **Architecture:** `docs/architecture/` directory

---

**Last reviewed:** 2026-03-25  
**Next review:** After ADR-001 implementation
