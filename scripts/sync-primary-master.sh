#!/usr/bin/env bash
# Fast-forward local master in the primary checkout to match origin/master.
# Must be run from the primary (main) worktree — not from a linked worktree path.
#
# Usage (from repo root of the primary clone):
#   scripts/sync-primary-master.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

git_dir=$(git rev-parse --git-dir)
case "$git_dir" in
  */worktrees/*)
    echo "ERROR: run this script from the primary repository checkout, not a linked worktree." >&2
    echo "  Primary path is the main clone (git-dir should not contain .../worktrees/...)." >&2
    exit 1
    ;;
esac

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: working tree or index is not clean. Commit, stash, or discard changes first." >&2
  exit 1
fi

current=$(git rev-parse --abbrev-ref HEAD)
if [[ "${current}" != "master" ]]; then
  echo "==> switching to master (was ${current})"
  git switch master
fi

echo "==> git fetch origin --prune"
git fetch origin --prune

echo "==> git pull --ff-only origin master"
git pull --ff-only origin master

echo "==> primary master is up to date with origin/master"
