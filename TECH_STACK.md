# Tech Stack & Architecture

## Runtime & Language

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 20+ |
| Language | TypeScript | 5.9.3 |
| Compilation target | ES2020 | CommonJS modules |

## Framework & Core Libraries

| Component | Technology | Version |
|-----------|-----------|---------|
| Web framework | Express.js | 5.2.1 |
| ORM | Prisma | 6.19.2 |
| API documentation | Swagger / OpenAPI 3.0.0 | swagger-jsdoc + swagger-ui-express |

## Database

- **Primary database**: PostgreSQL 16 (via Docker Compose, `postgres:16-alpine`)
- **ORM**: Prisma Client with migration-based schema management
- **Schema location**: `prisma/schema.prisma`

### Data Models

- **User** — roles (`user` / `admin`), plans (`free` / `pro` / `team`)
- **RefreshToken** — JWT refresh token storage
- **Project** — grouping container for todos
- **Todo** — core task entity with priority enum
- **Subtask** — child items of a todo
- **AiSuggestion** / **AiSuggestionAppliedTodo** — AI-generated task suggestions

### Enums

`UserRole`, `UserPlan`, `TodoPriority`, `AiSuggestionType`, `AiSuggestionStatus`

## Authentication & Authorization

- **JWT-based authentication** with dual secrets (access + refresh)
  - Access tokens: 15-minute expiry
  - Refresh tokens: 7-day expiry, stored in database
- **Password hashing**: bcrypt with 10 salt rounds
- **Middleware**: `authMiddleware` (JWT verification), `adminMiddleware` (role check)
- **Email verification**: token-based with resend capability
- **Password reset**: time-limited tokens (1-hour expiry)
- **Bootstrap admin**: first-time admin provisioning via secret

## API Design

- **Style**: RESTful with JSON request/response bodies
- **Documentation**: OpenAPI 3.0.0 served at `/api-docs` (Swagger UI) and `/api-docs.json`

### Route Groups

| Path | Purpose |
|------|---------|
| `/auth` | Register, login, refresh, logout, verify email, password reset, bootstrap-admin |
| `/todos` | CRUD, subtasks, filtering, sorting, reordering |
| `/projects` | Project CRUD |
| `/users` | User management and profile |
| `/ai` | AI-powered suggestions (critique, goal-to-plan, breakdown) |
| `/admin` | Admin operations |

## Security

| Concern | Solution |
|---------|----------|
| HTTP headers | Helmet with custom CSP |
| Cross-origin | CORS with origin validation |
| Rate limiting | express-rate-limit (auth: 5/15min, email: 20/15min, API: 100/15min) |
| Input validation | Custom validation layer |
| Error handling | Centralized error handler with `ValidationError` and `HttpError` classes |

## Testing

| Layer | Tool | Config |
|-------|------|--------|
| Unit tests | Jest + ts-jest | `jest.unit.config.js` (no DB, `SKIP_DB_SETUP=true`) |
| Integration tests | Jest + supertest | `jest.integration.config.js` (PostgreSQL service) |
| E2E / UI tests | Playwright | `playwright.config.ts` (Desktop Chrome, mobile Pixel 7) |
| Visual regression | Playwright snapshots | `ui-visual.yml` workflow |

- Test database is separate from development
- Global setup/teardown with database cleanup between tests

## Build & Dev Tooling

| Tool | Purpose |
|------|---------|
| npm | Package manager |
| tsc | TypeScript compilation (`src/` → `dist/`) |
| nodemon | Hot-reload in development |
| ts-node | Direct TypeScript execution |
| Prettier | Code formatting (.ts, .js, .json, .md, .html, .css, .yml) |
| stylelint | CSS linting (standard config, postcss-html syntax) |
| html-validate | HTML validation for `public/*.html` |

### npm Scripts

- `npm run build` — Generate Prisma client + compile TypeScript
- `npm run dev` — Start with nodemon (hot-reload)
- `npm start` — Run Prisma migrations + start compiled server
- `npm test` — Run full test suite
- `npm run test:unit` — Unit tests only
- `npm run test:integration` — Integration tests only
- `npm run format:check` — Prettier format check
- `npm run audit:prod` — Security audit for production dependencies

## CI/CD

### GitHub Actions

- **ci.yml** (push to `master` + PRs):
  - **Unit job**: typecheck, format check, audit, unit tests (no database)
  - **Integration job**: full test suite with PostgreSQL service container
  - Node 20, npm caching, Prisma migrations
- **ui-tests.yml**: Playwright end-to-end tests
- **ui-visual.yml**: Visual regression testing

### Deployment

- **Platform**: Railway (NIXPACKS builder)
- **Build**: `npm install` (production only) → `npm run build`
- **Start**: `npm start` (runs migrations then starts server)
- **Restart policy**: `ON_FAILURE`, max 10 retries
- **Graceful shutdown**: SIGTERM/SIGINT handlers disconnect Prisma client

## Configuration

Environment variables managed via `.env` files (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing keys |
| `PORT` | Server port |
| `NODE_ENV` | Environment mode (`development`, `test`, `production`) |
| `CORS_ORIGIN` | Allowed origins (required in production) |
| `SMTP_*` / `EMAIL_*` | Email delivery configuration |
| `AI_PROVIDER_*` | OpenAI-compatible AI provider settings |
| `ADMIN_BOOTSTRAP_SECRET` | First-time admin provisioning |

Production mode enforces strong JWT secrets, explicit CORS configuration, and validated database URLs.

## Project Structure

```
todos-api/
├── src/
│   ├── app.ts                    # Express app factory
│   ├── server.ts                 # Server entry point
│   ├── config.ts                 # Configuration & validation
│   ├── prismaClient.ts           # Prisma client singleton
│   ├── types.ts                  # Shared TypeScript types
│   ├── interfaces/
│   │   ├── ITodoService.ts       # Todo service contract
│   │   └── IProjectService.ts    # Project service contract
│   ├── routes/
│   │   ├── todosRouter.ts
│   │   ├── authRouter.ts
│   │   ├── usersRouter.ts
│   │   ├── projectsRouter.ts
│   │   ├── aiRouter.ts
│   │   └── adminRouter.ts
│   ├── authService.ts            # Auth business logic
│   ├── prismaTodoService.ts      # Todo service (Prisma impl)
│   ├── projectService.ts         # Project business logic
│   ├── aiService.ts              # AI suggestion engine
│   ├── emailService.ts           # Email delivery
│   ├── authMiddleware.ts         # JWT auth middleware
│   ├── adminMiddleware.ts        # Admin role middleware
│   ├── validation.ts             # Input validation
│   ├── errorHandling.ts          # Centralized error handling
│   └── swagger.ts                # OpenAPI spec definition
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── seed.ts                   # Database seeding
│   └── migrations/               # Migration history
├── test/                         # Test setup & helpers
├── tests/ui/                     # Playwright E2E tests
├── public/                       # Static frontend files
├── scripts/                      # Build & utility scripts
└── dist/                         # Compiled output
```

## Architecture Patterns

- **Service layer**: business logic isolated in service classes (`AuthService`, `PrismaTodoService`, `ProjectService`, `AiService`)
- **Interface-based design**: services implement contracts (`ITodoService`, `IProjectService`)
- **Dependency injection**: services passed into route handler factories
- **Factory pattern**: `createApp()` assembles the Express application; routers created via factory functions
- **Centralized error handling**: custom error classes mapped to HTTP responses
- **Strict typing**: TypeScript strict mode with no implicit any
