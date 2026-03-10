# TASK 152: extract-rate-limit-middleware

type: Yellow
status: READY
mode: refactor
builder: codex
reviewer: claude
branch: codex/task-152-extract-rate-limit-middleware
base: master

## Intent
Extract the inline rate-limit configuration from `src/app.ts` into a dedicated `src/middleware/rateLimitMiddleware.ts` file, making it testable, documented, and consistent with the existing middleware pattern.

## Background
`express-rate-limit` is already installed and three limiters are already defined inline in `src/app.ts` (lines ~155–195):

- `authLimiter` — 5 requests per 15 min on `/auth` routes
- `emailActionLimiter` — 20 requests per 15 min on email action routes
- `apiLimiter` — 100 requests per 15 min on `/api`, `/todos`, `/users`, `/ai`, `/projects`

The limiters are used correctly. The issue is they live inline in the application bootstrap file alongside routing and swagger config, rather than in the `middleware/` directory where `authMiddleware.ts` and `adminMiddleware.ts` live.

## Scope

1. Create `src/middleware/rateLimitMiddleware.ts` that exports:
   ```typescript
   export const authLimiter: RequestHandler
   export const emailActionLimiter: RequestHandler
   export const apiLimiter: RequestHandler
   ```
   Each limiter should be identical in behavior to the current inline versions.
   The `isTest` bypass (`process.env.NODE_ENV === 'test'` → noLimit) must be preserved.

2. Update `src/app.ts` to import from the new file and remove the inline definitions.

3. Add a JSDoc comment block at the top of `rateLimitMiddleware.ts` documenting:
   - Purpose of each limiter
   - Window and max values
   - Which routes each applies to

4. Update `docs/memory/brief/BRIEF.md` — "Open Tech Debt" section: mark this item resolved
5. Update `docs/next-enhancements.md` — mark resolved

## Out of Scope
- Changing any rate limit values or window durations
- Adding new limiters or routes
- Redis-backed distributed rate limiting
- Per-user rate limiting
- Any changes to auth or API behavior

## Files Allowed
- `src/middleware/rateLimitMiddleware.ts` (new file)
- `src/app.ts`
- `docs/memory/brief/BRIEF.md`
- `docs/next-enhancements.md`

## Acceptance Criteria
- [ ] `src/middleware/rateLimitMiddleware.ts` exists and exports all three limiters
- [ ] `src/app.ts` imports from `rateLimitMiddleware.ts` (no inline limiter definitions remain)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run test:unit` passes
- [ ] `CI=1 npm run test:ui:fast` passes
- [ ] Rate limit behavior is identical to current behavior (verified by existing tests)

## Constraints
- No behavior changes — pure extraction
- `isTest` bypass logic must be preserved in the new file
- Do not introduce any new npm dependencies
- All three limiters must remain in a single new file (do not split further)

## MIC-Lite

### Motivation
`src/app.ts` is already long. Rate limit config is middleware — it belongs with the other middleware files. Having it inline makes it harder to find, document, and test independently. The extraction also sets a clean pattern for any future limiter additions (e.g. per-route AI limiter).

### Impact
- No behavior change
- `src/app.ts` becomes shorter and cleaner
- Future middleware additions have a clear home

### Checkpoints
- [ ] `npx tsc --noEmit` passes after extraction
- [ ] Unit tests pass (existing rate limit behavior preserved)
- [ ] UI tests pass (no regressions in authenticated flows)

## Scope Escalation Triggers
If any of these occur, set status to BLOCKED and request re-approval:
- Change touches >4 files
- Any rate limit values change
- New npm dependency required

## Deliverable
- PR URL
- Commit SHA(s)
- Files changed (should be: new rateLimitMiddleware.ts, updated app.ts, docs)
- PASS/FAIL matrix

## Outcome
(filled after completion)
