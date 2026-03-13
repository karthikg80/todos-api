#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

echo "==> typecheck"
npx tsc --noEmit

echo "==> visual tagging guard"
npm run test:ui:check-visual-tags

echo "==> harness browser smoke"
PLAYWRIGHT_AUTH_DIR=.playwright/.auth npx playwright test tests/ui/harness-smoke.spec.ts --project=chromium
