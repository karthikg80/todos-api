#!/usr/bin/env bash
set -euo pipefail

UAT_BRANCH="uat"
PROD_BRANCH="production"
TODAY=$(date -u +'%Y.%m.%d')
BASE_TAG="v${TODAY}"
IS_HOTFIX=${IS_HOTFIX:-false}

echo "Starting Release Train process for $TODAY..."

git fetch origin "$UAT_BRANCH" --tags

# 1. Bootstrap Check — safe on first run (production may not exist yet)
if ! git ls-remote --exit-code --heads origin "$PROD_BRANCH" > /dev/null 2>&1; then
  echo "🐣 '$PROD_BRANCH' does not exist yet. Bootstrapping from '$UAT_BRANCH'..."
  git checkout -B "$PROD_BRANCH" "origin/$UAT_BRANCH"
  git tag -a "$BASE_TAG" -m "Initial release $BASE_TAG"
  git push origin "$PROD_BRANCH"
  git push origin "$BASE_TAG"
  echo "✅ Initial production bootstrap complete."
  exit 0
fi

git fetch origin "$PROD_BRANCH"

# 2. Check for new commits
COMMITS_BEHIND=$(git rev-list --count "origin/$PROD_BRANCH..origin/$UAT_BRANCH")
if [ "$COMMITS_BEHIND" -eq 0 ]; then
  echo "✅ No new commits on $UAT_BRANCH since last release. Skipping."
  exit 0
fi

# 3. Rate Limit Enforcement
EXISTING_TAGS=$(git tag -l "${BASE_TAG}*")
if [ -n "$EXISTING_TAGS" ] && [ "$IS_HOTFIX" != "true" ]; then
  echo "🚨 ERROR: A release already exists for today: $EXISTING_TAGS"
  echo "To release again, you must explicitly trigger a Hotfix."
  exit 1
fi

# 4. Determine Tag Name
if [ "$IS_HOTFIX" == "true" ]; then
  HOTFIX_COUNT=$(echo "$EXISTING_TAGS" | grep -c "hotfix" || true)
  NEXT_HOTFIX=$((HOTFIX_COUNT + 1))
  NEW_TAG="${BASE_TAG}-hotfix.${NEXT_HOTFIX}"
  echo "🔥 Hotfix mode: Creating $NEW_TAG"
else
  NEW_TAG="${BASE_TAG}"
  echo "🏷️  Daily Release mode: Creating $NEW_TAG"
fi

# 5. Fast-Forward Production
if ! git merge-base --is-ancestor "origin/$PROD_BRANCH" "origin/$UAT_BRANCH"; then
  echo "❌ ERROR: $PROD_BRANCH has diverged from $UAT_BRANCH. Fast-forward failed."
  exit 1
fi

git checkout -B "$PROD_BRANCH" "origin/$PROD_BRANCH"
git merge --ff-only "origin/$UAT_BRANCH"
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"

# 6. Push (no --force)
git push origin "$PROD_BRANCH"
git push origin "$NEW_TAG"

echo "✅ Production release $NEW_TAG successful!"
