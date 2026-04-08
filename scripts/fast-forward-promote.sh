#!/usr/bin/env bash
set -euo pipefail

SOURCE=$1
TARGET=$2

echo "🔍 Checking $TARGET status..."

git fetch origin "$SOURCE" --tags

# 1. Bootstrap Check: If target does not exist on remote, create it from source
if ! git ls-remote --exit-code --heads origin "$TARGET" > /dev/null 2>&1; then
  echo "🐣 Target branch '$TARGET' does not exist. Bootstrapping from '$SOURCE'..."
  git checkout -B "$TARGET" "origin/$SOURCE"
  git push origin "$TARGET"
  echo "✅ Bootstrap complete."
  exit 0
fi

git fetch origin "$TARGET"

# 2. Fast-Forward Check
SOURCE_SHA=$(git rev-parse "origin/$SOURCE")
TARGET_SHA=$(git rev-parse "origin/$TARGET")

if [ "$SOURCE_SHA" == "$TARGET_SHA" ]; then
  echo "✅ Target '$TARGET' is already up to date with '$SOURCE'. No-op."
  exit 0
fi

if ! git merge-base --is-ancestor "origin/$TARGET" "origin/$SOURCE"; then
  echo "❌ ERROR: Target branch '$TARGET' has diverged from '$SOURCE'."
  echo "A fast-forward is not possible. Please manually merge '$TARGET' into '$SOURCE' and resolve conflicts."
  exit 1
fi

echo "🚀 Fast-forwarding '$TARGET' to '$SOURCE'..."
git checkout -B "$TARGET" "origin/$TARGET"
git merge --ff-only "origin/$SOURCE"
git push origin "$TARGET"

echo "✅ Successfully promoted '$SOURCE' to '$TARGET'."
