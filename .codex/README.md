# .codex/

Worktree-local harness session files live here.

- `context-ack.json` is the machine-readable record that the current session
  loaded the required docs and constraints before editing code.
- `progress.md` is a local run log for the current worktree session.
- `feature-checklist.json` is the local execution checklist for the current
  task or issue.

These files are intentionally ignored by git and should not be used as the
source of truth for task state. GitHub Issues and GitHub Projects remain the
authoritative task queue.

Use the committed templates under `.codex/templates/` to initialize them in a
fresh worktree.
