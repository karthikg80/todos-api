#!/usr/bin/env bash
# Create an isolated worktree and task branch from an up-to-date base.
# Run from any clone; typically invoked from the primary checkout without modifying it beyond git worktree metadata.
#
# Usage:
#   scripts/new-task-worktree.sh <short-feature-name> [base-ref]
#
# Examples:
#   scripts/new-task-worktree.sh fix-login-button
#   scripts/new-task-worktree.sh oauth-scope origin/master
#
# Defaults:
#   branch   — codex/<short-feature-name>
#   path     — /private/tmp/todos-api-<short-feature-name>
#   base_ref — origin/master (fetched first)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <short-feature-name> [base-ref]" >&2
  echo "Example: $0 fix-login-button" >&2
  exit 1
fi

SHORT_NAME="$1"
BASE_REF="${2:-origin/master}"
BRANCH_NAME="codex/${SHORT_NAME}"
WORKTREE_DIR="/private/tmp/todos-api-${SHORT_NAME}"

if [[ "${SHORT_NAME}" =~ / || "${SHORT_NAME}" =~ ^\. || -z "${SHORT_NAME}" ]]; then
  echo "ERROR: short-feature-name must be a single path segment (no slashes)." >&2
  exit 1
fi

cd "${REPO_ROOT}"

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  echo "ERROR: branch already exists locally: ${BRANCH_NAME}" >&2
  exit 1
fi

if [[ -e "${WORKTREE_DIR}" ]]; then
  echo "ERROR: worktree path already exists: ${WORKTREE_DIR}" >&2
  exit 1
fi

echo "==> fetching origin (for ${BASE_REF})"
git fetch origin

if ! git rev-parse --verify "${BASE_REF}" >/dev/null 2>&1; then
  echo "ERROR: base ref not found: ${BASE_REF}" >&2
  exit 1
fi

echo "==> git worktree add ${WORKTREE_DIR} -b ${BRANCH_NAME} ${BASE_REF}"
git worktree add "${WORKTREE_DIR}" -b "${BRANCH_NAME}" "${BASE_REF}"

cd "${WORKTREE_DIR}"
echo "==> installing dependencies (npm ci)"
npm ci
echo "==> installing client-react dependencies (npm ci)"
npm --prefix client-react ci

echo
echo "==> ready: cd ${WORKTREE_DIR}"
echo "    branch: ${BRANCH_NAME}"
echo "    optional: before 'gh pr create', run: scripts/validate-task-branch.sh --require-linked-worktree"
