# Invariant Matrix

Map of load-bearing repo rules to their current enforcement points.

| Invariant | Source | Current enforcement | Gap / follow-up |
| --------- | ------ | ------------------- | --------------- |
| Work only in a fresh worktree per issue | `AGENTS.md` | bootstrap/session docs + session-start flow | still relies on session discipline |
| Run `git status --porcelain` before start and before rebase/merge | `AGENTS.md` | session-start flow + docs | still relies on session discipline |
| Event delegation only for dynamic UI | `AGENTS.md`, `docs/architecture/AGENT_RULES.md` | review + existing app architecture | add stronger static check later |
| `#categoryFilter` + `filterTodos()` is the canonical filter path | `AGENTS.md`, `docs/architecture/AGENT_RULES.md` | `npm run check:architecture` + regression tests | deeper parallel-path detection can still improve |
| Always use `setSelectedProjectKey(...)` for project selection | `AGENTS.md`, `docs/architecture/AGENT_RULES.md` | `npm run check:architecture` + UI regression coverage | add stronger state-mutation detection later |
| No `page.waitForTimeout()` in UI tests | `AGENTS.md` | `npm run check:architecture` | none |
| No native browser prompts in app code | repo issue direction, UI conventions | `npm run check:architecture` for new usage + cleanup report warning for current fallback | retire overlay-manager fallback fully |
| Fast UI suite is the CI gate | `AGENTS.md`, `package.json` | `CI=1 npm run test:ui:fast` | keep explicit in harness smoke |
| MCP and agent behavior should stay aligned with docs/contracts | `docs/agent-accessibility.md`, `docs/assistant-mcp.md`, `src/api.contract.test.ts` | contract tests + route tests + `npm run check:harness-drift` | expand beyond tool-name coverage later |
| Task state lives in GitHub, not markdown docs | `docs/WORKFLOW.md` | docs + issue templates | local `.codex/` files must remain session-only |
| Session context should be acknowledged before edits | harness issue scope | `npm run check:architecture` enforces local `.codex/context-ack.json` when app code changes | CI intentionally skips local-only session state |

## Cleanup loop

- `npm run harness:cleanup-report` writes a local actionable report under
  `artifacts/harness/cleanup-report/`
- report findings should feed back into:
  - new eval cases
  - new mechanical guards
  - or durable docs updates

## Usage

Use this matrix as the single place to answer:

- what invariant exists
- where it is documented
- how it is currently enforced
- what still needs to become mechanical

When a new guard or test lands, update this matrix so the harness map stays
current.
