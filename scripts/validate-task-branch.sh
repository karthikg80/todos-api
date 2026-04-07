#!/bin/sh
# Validate that the current Git context is safe for task work (commits, pushes, PR prep).
# Used by Husky hooks and can be run manually or from CI helpers.
#
# Usage:
#   scripts/validate-task-branch.sh [--require-linked-worktree]
#
# Environment (escape hatch for rare maintenance; use sparingly):
#   TODOS_API_SKIP_WORKFLOW_GUARDS=1  — skip all checks (not recommended)

set -e

if [ "${TODOS_API_SKIP_WORKFLOW_GUARDS:-}" = "1" ]; then
  exit 0
fi

require_linked=0
for arg in "$@"; do
  case "$arg" in
    --require-linked-worktree) require_linked=1 ;;
    *)
      echo "ERROR: unknown argument: $arg" >&2
      echo "Usage: scripts/validate-task-branch.sh [--require-linked-worktree]" >&2
      exit 1
      ;;
  esac
done

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || {
  echo "ERROR: not a Git repository." >&2
  exit 1
}

if [ "$branch" = "HEAD" ]; then
  echo "ERROR: Detached HEAD. Check out a task branch before continuing." >&2
  exit 1
fi

if [ "$branch" = "master" ]; then
  echo "ERROR: Branch master is reserved for the integration branch. Use a task branch (for example codex/<feature>)." >&2
  exit 1
fi

if [ "$require_linked" -eq 1 ]; then
  git_dir=$(git rev-parse --git-dir)
  case "$git_dir" in
    */worktrees/*) ;;
    *)
      echo "ERROR: This command must be run from a linked Git worktree (not the primary checkout)." >&2
      echo "  Create one with: scripts/new-task-worktree.sh <short-feature-name>" >&2
      exit 1
      ;;
  esac
fi

exit 0
