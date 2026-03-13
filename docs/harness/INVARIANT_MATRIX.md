# Invariant Matrix

Map of load-bearing repo rules to their current enforcement points.

| Invariant | Source | Current enforcement | Gap / follow-up |
| --------- | ------ | ------------------- | --------------- |
| Work only in a fresh worktree per issue | `AGENTS.md` | manual today | session bootstrap script and drift check planned |
| Run `git status --porcelain` before start and before rebase/merge | `AGENTS.md` | manual today | session-start script planned |
| Event delegation only for dynamic UI | `AGENTS.md`, `docs/architecture/AGENT_RULES.md` | review + existing app architecture | no mechanical check yet |
| `#categoryFilter` + `filterTodos()` is the canonical filter path | `AGENTS.md`, `docs/architecture/AGENT_RULES.md` | review + regression tests | add drift check later |
| Always use `setSelectedProjectKey(...)` for project selection | `AGENTS.md`, `docs/architecture/AGENT_RULES.md` | review + UI regression coverage | add drift check later |
| No `page.waitForTimeout()` in UI tests | `AGENTS.md` | review today | add mechanical check later |
| No native browser prompts in app code | repo issue direction, UI conventions | review today | add mechanical check later |
| Fast UI suite is the CI gate | `AGENTS.md`, `package.json` | `CI=1 npm run test:ui:fast` | keep explicit in harness smoke |
| MCP and agent behavior should stay aligned with docs/contracts | `docs/agent-accessibility.md`, `docs/assistant-mcp.md`, `src/api.contract.test.ts` | contract tests + route tests | add stronger drift checks later |
| Task state lives in GitHub, not markdown docs | `docs/WORKFLOW.md` | docs + issue templates | local `.codex/` files must remain session-only |
| Session context should be acknowledged before edits | harness issue scope | none yet | local context ack file and later drift check |

## Usage

Use this matrix as the single place to answer:

- what invariant exists
- where it is documented
- how it is currently enforced
- what still needs to become mechanical

When a new guard or test lands, update this matrix so the harness map stays
current.
