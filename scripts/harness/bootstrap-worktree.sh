#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <issue-number> <short-feature-name> [base-branch]" >&2
  echo "Example: $0 259 harness-scripts" >&2
  exit 1
fi

ISSUE_NUMBER="$1"
SHORT_NAME="$2"
BASE_BRANCH="${3:-origin/master}"
BRANCH_NAME="codex/issue-${ISSUE_NUMBER}-${SHORT_NAME}"
WORKTREE_DIR="/private/tmp/todos-api-issue-${ISSUE_NUMBER}-${SHORT_NAME}"

cd "${REPO_ROOT}"

echo "==> repo root: ${REPO_ROOT}"
git status --porcelain
git fetch origin

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  echo "Local branch already exists: ${BRANCH_NAME}" >&2
  exit 1
fi

if [[ -e "${WORKTREE_DIR}" ]]; then
  echo "Worktree path already exists: ${WORKTREE_DIR}" >&2
  exit 1
fi

echo "==> creating worktree ${WORKTREE_DIR} on ${BRANCH_NAME} from ${BASE_BRANCH}"
git worktree add "${WORKTREE_DIR}" -b "${BRANCH_NAME}" "${BASE_BRANCH}"

cd "${WORKTREE_DIR}"
echo "==> installing dependencies"
npm ci

echo "==> starting session harness"
HARNESS_REPO_ROOT="${WORKTREE_DIR}" "${SCRIPT_DIR}/session-start.sh" "${ISSUE_NUMBER}"
