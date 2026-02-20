# Todos REST API

A production-ready REST API for managing todos with JWT auth, PostgreSQL persistence, input validation, and automated tests.

## Features

- 🔒 Full CRUD operations (Create, Read, Update, Delete)
- 💾 PostgreSQL database with Prisma ORM for persistence
- 🐳 Docker Compose for local development
- ✅ Input validation with detailed error messages
- 📘 TypeScript for type safety
- 🧪 Comprehensive unit + integration test suite
- 🏗️ Clean architecture with dependency injection
- 🔄 Graceful shutdown handling
- 🌍 Environment-based configuration (dev/test/prod)
- 🔐 Refresh token rotation and auth route protection
- 🤖 AI-assisted task critique and goal-to-plan suggestions

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL (via Docker or local installation)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd todos-api
npm install
```

### 2. Set Up Environment

Copy the example environment file:

```bash
cp .env.example .env
```

The `.env` file contains:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/todos_dev"
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/todos_test"
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_ACCESS_SECRET=your-access-jwt-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-jwt-secret-change-in-production
ADMIN_BOOTSTRAP_SECRET=
EMAIL_FEATURES_ENABLED=true
CORS_ORIGINS=
```

Production notes:

- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be set to strong, different values.
- `JWT_SECRET` is supported as a backward-compatibility fallback only.
- `CORS_ORIGINS` must be set (comma-separated allowlist).
- `ADMIN_BOOTSTRAP_SECRET` is optional, and enables first-admin provisioning from the Profile UI.
- `DATABASE_URL` must be set in production.
- If `EMAIL_FEATURES_ENABLED=true`, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `BASE_URL`.
- AI model integration is optional: set `AI_PROVIDER_ENABLED=true` and configure `AI_PROVIDER_API_KEY` to call a live provider.
- Configure `AI_DAILY_SUGGESTION_LIMIT` to cap daily AI generations per user (default: `50`).
- Optional per-plan caps: `AI_DAILY_SUGGESTION_LIMIT_FREE`, `AI_DAILY_SUGGESTION_LIMIT_PRO`, `AI_DAILY_SUGGESTION_LIMIT_TEAM`.

### 3. Start Database

```bash
npm run docker:up
```

This starts a PostgreSQL 16 container with both development and test databases.

### 4. Run Migrations

```bash
npm run prisma:migrate
```

This creates the database schema and generates the Prisma client.

### 5. Start the Server

```bash
npm run dev
```

The API will be available at http://localhost:3000

## Available Scripts

### Development

- `npm run dev` - Start server with auto-reload (nodemon)
- `npm start` - Start server in production mode

### Database Management

- `npm run db:setup` - One-command setup: start Docker + run migrations
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Create and apply new migration
- `npm run prisma:migrate:deploy` - Deploy migrations (production)
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:reset` - Reset database (WARNING: deletes all data)

### Docker

- `npm run docker:up` - Start PostgreSQL container
- `npm run docker:down` - Stop PostgreSQL container
- `npm run docker:reset` - Reset Docker volumes (deletes all data)
- `npm run docker:logs` - View PostgreSQL logs

### Testing

- `npm test` - Run all tests
- `npm run test:integration` - Run integration tests with deterministic local test DB setup
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

Integration test DB behavior:

- If `TEST_DATABASE_URL` or `DATABASE_URL_TEST` is set, integration tests use that URL.
- If neither is set, integration tests default to:
  - `postgresql://postgres:postgres@localhost:5432/todos_test?schema=public`
- The test bootstrap runs `prisma migrate reset --force --skip-seed --skip-generate` for a deterministic schema.
- Safety guardrails:
  - Refuses URLs that do not look like a test database.
  - Refuses non-local DB hosts by default (`localhost`, `127.0.0.1`, `::1` only).
  - Set `ALLOW_REMOTE_TEST_DB=true` only when you intentionally need a remote test DB.

### Build

- `npm run build` - Build TypeScript + generate Prisma client

## API Endpoints

### Create a Todo

```http
POST /todos
Content-Type: application/json

{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread"
}

# Response: 201 Created
{
  "id": "uuid",
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "completed": false,
  "createdAt": "2026-02-07T...",
  "updatedAt": "2026-02-07T..."
}
```

### Get All Todos

```http
GET /todos

# Optional query parameters
# completed=true|false
# priority=low|medium|high
# category=<exact-category-name>
# sortBy=order|createdAt|updatedAt|dueDate|priority|title
# sortOrder=asc|desc
# page=<positive-integer>        # requires limit
# limit=<1-100>

# Response: 200 OK
[
  {
    "id": "uuid",
    "title": "Buy groceries",
    "description": "Milk, eggs, bread",
    "completed": false,
    "createdAt": "2026-02-07T...",
    "updatedAt": "2026-02-07T..."
  }
]
```

### Get a Single Todo

```http
GET /todos/:id

# Response: 200 OK
{
  "id": "uuid",
  "title": "Buy groceries",
  ...
}

# Response: 404 Not Found
{
  "error": "Todo not found"
}
```

### Update a Todo

```http
PUT /todos/:id
Content-Type: application/json

{
  "title": "Buy groceries and cook dinner",
  "description": "Updated description",
  "completed": true
}

# Response: 200 OK
{
  "id": "uuid",
  "title": "Buy groceries and cook dinner",
  "description": "Updated description",
  "completed": true,
  "createdAt": "2026-02-07T...",
  "updatedAt": "2026-02-07T..."
}

# Response: 404 Not Found
{
  "error": "Todo not found"
}
```

### Delete a Todo

```http
DELETE /todos/:id

# Response: 204 No Content

# Response: 404 Not Found
{
  "error": "Todo not found"
}
```

## Validation Rules

### Title

- ✅ Required
- ✅ Must be a string
- ✅ Cannot be empty (after trimming whitespace)
- ✅ Maximum 200 characters

### Description

- ✅ Optional
- ✅ Must be a string if provided
- ✅ Maximum 1000 characters

### Completed

- ✅ Must be a boolean if provided

## Testing

The project has three testing layers:

- Unit tests for core validation/business logic (`npm run test:unit`)
- Integration API tests against PostgreSQL (`npm run test:integration`)
- Playwright UI coverage for end-to-end browser behavior (`npm run test:ui:fast` / `npm run test:ui`)

Test totals change over time. Use command output as the source of truth rather than fixed counts in docs.

### Run Tests

```bash
# Unit tests (default test command)
npm run test:unit

# Watch mode
npm run test:watch

# Unit coverage
npm run test:coverage

# API integration tests (requires test DB)
npm run test:integration
```

### UI Testing (Playwright)

```bash
# Run full UI suite (includes visual snapshot tests)
npm run test:ui

# Run fast deterministic UI suite (excludes @visual snapshot tests)
npm run test:ui:fast

# Update baseline screenshots
npm run test:ui:update

# Run in headed mode locally
npm run test:ui:headed
```

#### Fast vs Full UI suites

- `npm run test:ui:fast`
  - Runs the PR-gating tier.
  - Excludes tests tagged `@visual`.
  - Intended for fast, deterministic DOM/state validation.
- `npm run test:ui`
  - Runs the full suite, including `@visual` snapshot assertions.
  - Intended for local visual verification and dedicated visual CI runs.

#### Linux-consistent visual runs

For screenshot consistency with CI, run visual tests in a Linux environment (container/CI) before updating snapshots:

```bash
# Full suite in CI-like mode
CI=1 npm run test:ui
```

### UI Quality Checks

```bash
# CSS lint (inline <style> blocks in HTML)
npm run lint:css

# HTML validation
npm run lint:html

# Local link crawl
npm run test:links
```

### Test Database

Tests automatically use a separate test database (`todos_test`) to avoid affecting development data. The test setup:

1. Runs migrations on test database before all tests
2. Cleans test data before each test
3. Disconnects Prisma client after all tests

## Project Structure

```
todos-api/
├── public/                  # Static frontend (HTML/CSS/vanilla JS)
├── prisma/                  # Prisma schema + migrations
├── src/
│   ├── routes/              # Express routers (auth/todos/projects/ai/users/admin)
│   ├── interfaces/          # Service contracts
│   ├── *Service.ts          # Domain/services (todos, projects, auth, AI)
│   ├── app.ts               # App composition
│   └── server.ts            # Entrypoint
├── test/                    # Jest setup/teardown helpers
├── tests/ui/                # Playwright UI specs
├── scripts/                 # Utility scripts (lint/test helpers)
└── docs/                    # Architecture + agent protocol docs
```

## Architecture

The app is route-modular and service-oriented:

- `src/app.ts` wires middleware and route modules.
- `src/routes/*.ts` own HTTP contracts and validation boundaries.
- Service modules handle domain behavior (todos, projects, auth, AI flows).
- Prisma-backed services provide persistent behavior for runtime/integration tests.
- A deterministic in-memory todo service is retained for focused unit scenarios.

## Database Schema

The canonical schema is in `prisma/schema.prisma` and includes auth/user tables, projects, todos, subtasks, and AI suggestion tracking tables.

## Environment Variables

| Variable                 | Description                               | Default                                                    |
| ------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`           | PostgreSQL connection for dev/prod        | `postgresql://postgres:postgres@localhost:5432/todos_dev`  |
| `DATABASE_URL_TEST`      | PostgreSQL connection for tests           | `postgresql://postgres:postgres@localhost:5432/todos_test` |
| `PORT`                   | Server port                               | `3000`                                                     |
| `NODE_ENV`               | Environment (development/test/production) | `development`                                              |
| `EMAIL_FEATURES_ENABLED` | Enable verification/reset email delivery  | `true`                                                     |

## Deployment

### Build for Production

```bash
npm run build
```

This compiles TypeScript and generates the Prisma client.

### Run in Production

1. Set environment variables:

   ```bash
   export DATABASE_URL="postgresql://user:password@host:5432/todos_prod"
   export NODE_ENV="production"
   export PORT="3000"
   ```

2. Run migrations:

   ```bash
   npm run prisma:migrate:deploy
   ```

3. Start server:
   ```bash
   npm start
   ```

### Docker Deployment

The PostgreSQL container is configured for local development. For production, use a managed database service (AWS RDS, Google Cloud SQL, etc.) and update the `DATABASE_URL` accordingly.

## Troubleshooting

### Port 5432 Already in Use

If you have a local PostgreSQL instance running:

```bash
# Stop local PostgreSQL (macOS with Homebrew)
brew services stop postgresql@18

# Or change the port in docker-compose.yml
ports:
  - '5433:5432'
```

### Docker Not Running

```bash
# macOS
open -a Docker

# Wait for Docker to start, then:
npm run docker:up
```

### Prisma Client Not Found

```bash
npm run prisma:generate
```

### Migration Issues

```bash
# Reset database (WARNING: deletes all data)
npm run prisma:reset

# Or manually:
npm run docker:reset
npm run prisma:migrate
```

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Language**: TypeScript 5
- **Database**: PostgreSQL 16
- **ORM**: Prisma 6
- **Testing**: Jest + Supertest
- **Containerization**: Docker + Docker Compose
- **Dev Tools**: Nodemon, ts-node

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Create a pull request

## Support

For issues and questions, please open a GitHub issue.
