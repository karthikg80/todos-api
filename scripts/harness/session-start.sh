#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${HARNESS_REPO_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"

cd "${REPO_ROOT}"

ISSUE_NUMBER="${1:-}"
BRANCH_NAME="$(git branch --show-current)"
WORKTREE_DIR="$(pwd)"
CODEX_DIR="${REPO_ROOT}/.codex"
TEMPLATE_DIR="${CODEX_DIR}/templates"
CONTEXT_ACK="${CODEX_DIR}/context-ack.json"
PROGRESS_LOG="${CODEX_DIR}/progress.md"
FEATURE_CHECKLIST="${CODEX_DIR}/feature-checklist.json"
DOCS=(
  "AGENTS.md"
  "docs/WORKFLOW.md"
  "docs/architecture/AGENT_RULES.md"
  "docs/harness/README.md"
  "docs/harness/SESSION_FLOW.md"
  "docs/harness/EVALS.md"
  "docs/harness/INVARIANT_MATRIX.md"
)

echo "==> harness session start"
echo "pwd: ${WORKTREE_DIR}"
echo "branch: ${BRANCH_NAME}"
echo "issue: ${ISSUE_NUMBER:-unassigned}"
echo

echo "==> git status --porcelain"
git status --porcelain
echo

echo "==> recent history"
git log --oneline -5
echo

mkdir -p "${CODEX_DIR}"

if [[ ! -f "${CONTEXT_ACK}" ]]; then
  cp "${TEMPLATE_DIR}/context-ack.json" "${CONTEXT_ACK}"
fi
if [[ ! -f "${PROGRESS_LOG}" ]]; then
  cp "${TEMPLATE_DIR}/progress.md" "${PROGRESS_LOG}"
fi
if [[ ! -f "${FEATURE_CHECKLIST}" ]]; then
  cp "${TEMPLATE_DIR}/feature-checklist.json" "${FEATURE_CHECKLIST}"
fi

python3 - <<'PY' "${CONTEXT_ACK}" "${ISSUE_NUMBER}" "${BRANCH_NAME}" "${WORKTREE_DIR}"
import json
import pathlib
import sys
from datetime import datetime, timezone

path = pathlib.Path(sys.argv[1])
issue = sys.argv[2]
branch = sys.argv[3]
worktree = sys.argv[4]

data = json.loads(path.read_text())
data["issue"] = issue
data["branch"] = branch
data["worktree"] = worktree
if not data.get("startedAt"):
    data["startedAt"] = datetime.now(timezone.utc).isoformat()
path.write_text(json.dumps(data, indent=2) + "\n")
PY

python3 - <<'PY' "${FEATURE_CHECKLIST}" "${ISSUE_NUMBER}" "${BRANCH_NAME}"
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
issue = sys.argv[2]
branch = sys.argv[3]

data = json.loads(path.read_text())
data["issue"] = issue
data["branch"] = branch
if not data.get("title"):
    data["title"] = f"Issue {issue}" if issue else "Unassigned session"
path.write_text(json.dumps(data, indent=2) + "\n")
PY

python3 - <<'PY' "${PROGRESS_LOG}" "${ISSUE_NUMBER}" "${BRANCH_NAME}" "${WORKTREE_DIR}"
import pathlib
import sys
from datetime import datetime, timezone

path = pathlib.Path(sys.argv[1])
issue = sys.argv[2]
branch = sys.argv[3]
worktree = sys.argv[4]
text = path.read_text()
text = text.replace("- Issue:", f"- Issue: {issue}" if issue else "- Issue: unassigned", 1)
text = text.replace("- Branch:", f"- Branch: {branch}", 1)
text = text.replace("- Worktree:", f"- Worktree: {worktree}", 1)
text = text.replace("- Session started:", f"- Session started: {datetime.now(timezone.utc).isoformat()}", 1)
path.write_text(text)
PY

echo "==> required docs"
for doc in "${DOCS[@]}"; do
  echo "--- ${doc}"
  sed -n '1,40p' "${doc}"
  echo
done

echo "==> local session artifacts"
echo "- ${CONTEXT_ACK}"
echo "- ${PROGRESS_LOG}"
echo "- ${FEATURE_CHECKLIST}"
echo
echo "--- feature checklist"
cat "${FEATURE_CHECKLIST}"
echo

echo "==> running harness smoke"
"${SCRIPT_DIR}/smoke.sh"
