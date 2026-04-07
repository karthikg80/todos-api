#!/bin/sh
# Validate compliant context for feature work (commits, pushes, PR prep).
# Compliant iff: linked Git worktree, non-detached HEAD, branch is not master.
# Used by Husky hooks, scripts/open-task-pr.sh, and manual checks.
#
# Usage:
#   scripts/validate-task-branch.sh
#
# Skipped in CI/automation (checkout is never a linked worktree):
#   CI=true or GITHUB_ACTIONS=true
#
# Emergency bypass — explicitly authorized maintenance only; not for routine development:
#   TODOS_API_SKIP_WORKFLOW_GUARDS=1

set -e

if [ "${CI:-}" = "true" ] || [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  exit 0
fi

if [ "${TODOS_API_SKIP_WORKFLOW_GUARDS:-}" = "1" ]; then
  exit 0
fi

if [ "$#" -gt 0 ]; then
  echo "ERROR: unknown argument: $1" >&2
  echo "Usage: scripts/validate-task-branch.sh" >&2
  exit 1
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || {
  echo "ERROR: not a Git repository." >&2
  exit 1
}

if [ "$branch" = "HEAD" ]; then
  echo "ERROR: Detached HEAD. Check out a task branch in a linked worktree." >&2
  exit 1
fi

git_dir=$(git rev-parse --git-dir)
case "$git_dir" in
  */worktrees/*) ;;
  *)
    echo "ERROR: Feature work must happen in a linked Git worktree, not the primary checkout." >&2
    echo "  Create one with: scripts/new-task-worktree.sh <short-feature-name>" >&2
    exit 1
    ;;
esac

if [ "$branch" = "master" ]; then
  echo "ERROR: Branch master is reserved for the integration branch in the primary clone. Use a task branch in a linked worktree (for example codex/<feature>)." >&2
  exit 1
fi

exit 0
