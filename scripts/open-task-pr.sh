#!/usr/bin/env bash
# Open a GitHub PR from the current linked worktree after validating workflow compliance.
# Prefer this over raw \`gh pr create\` (Git hooks do not run gh).
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
"${REPO_ROOT}/scripts/validate-task-branch.sh"
exec gh pr create "$@"
