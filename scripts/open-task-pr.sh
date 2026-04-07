#!/usr/bin/env bash
# Open a GitHub PR from the current linked worktree after validating workflow compliance.
# Default way to open PRs (validates worktree context; Git hooks do not run gh).
#
# Usage:
#   scripts/open-task-pr.sh [arguments passed through to gh pr create]
#
# Example:
#   scripts/open-task-pr.sh --fill

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"
if ! "${REPO_ROOT}/scripts/validate-task-branch.sh"; then
  echo "" >&2
  echo "ERROR: open-task-pr.sh requires a linked Git worktree on a non-master task branch." >&2
  echo "  Create one: scripts/new-task-worktree.sh <short-feature-name>" >&2
  echo "  Then work, commit, and push from: /private/tmp/todos-api-<short-feature-name>" >&2
  echo "  Re-run this script from that directory." >&2
  exit 1
fi
exec gh pr create "$@"
