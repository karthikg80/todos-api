# Agent Guardrails (Codex + Claude Code)
Follow these rules **every time**. If any rule can't be followed, STOP and ask me.
## 1) Only one agent acts at a time
- If Claude is running commands, Codex must **not** run commands or edit.
- If Codex is implementing, Claude must **not** run commands.
- Hand off explicitly with the "Handoff Block" below.
## 2) Never work on `master` directly
- Always create/use a feature branch.
- Never commit to `master`.
- Never push to `master` unless I explicitly say so.
## 3) Forbidden commands unless I explicitly say "yes, do it"
Do **not** run any of these unless I explicitly approve in the same session:
- `git reset --hard`
- `git clean -fd` / `git clean -xdf`
- `git push --force*`
- `git rebase` (including `rebase -i`)
- deleting branches (local or remote)
## 4) Allowed commands (safe default set)
You may run only these without asking:
- `git status -sb`
- `git diff` / `git diff --stat`
- `git log -5 --oneline`
- `git fetch origin`
- `npx tsc --noEmit`
- `npm run format:check`
- `npm run lint:html`
- `npm run lint:css`
- `npm run test:unit`
- `CI=1 npm run test:ui`
If you need something else, STOP and ask.
## 5) Merge discipline
- Never merge unless all required checks are green.
- For stacked PRs: merge in order (PR1 → PR2 → PR3). No skipping.
## 6) UI snapshot rule (ui-quality)
If ui-quality fails due to snapshots:
- Regenerate snapshots **only** in the Linux Playwright container used by CI.
- Mention in PR: "snapshots regenerated in Playwright Linux container".
## 7) Handoff Block (required at every handoff)
Before stopping, the active agent must paste this block:
HANDOFF
- Branch:
- HEAD SHA:
- PR link (or PR creation URL):
- What changed (bullets):
- Commands run + results (PASS/FAIL):
- CI status snapshot:
- Next action requested:
- Risks/notes (optional):
That's it. No other agent action until the handoff block is provided.
