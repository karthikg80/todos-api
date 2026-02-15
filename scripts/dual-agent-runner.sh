#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUEUE_DIR="$ROOT_DIR/docs/agent-queue/tasks"

# Priority-ordered subdirectories (highest first)
PRIORITY_DIRS=("red" "yellow" "green")

usage() {
  cat <<'EOF'
Usage:
  scripts/dual-agent-runner.sh next
  scripts/dual-agent-runner.sh handoff-builder <task-file>
  scripts/dual-agent-runner.sh handoff-reviewer <task-file>
  scripts/dual-agent-runner.sh set-status <task-file> <STATUS>
  scripts/dual-agent-runner.sh complete <task-file>
  scripts/dual-agent-runner.sh escalate <task-file> <REASON>

Examples:
  scripts/dual-agent-runner.sh next
  scripts/dual-agent-runner.sh handoff-builder docs/agent-queue/tasks/red/001-auth.md
  scripts/dual-agent-runner.sh set-status docs/agent-queue/tasks/green/002-css-fix.md REVIEW
  scripts/dual-agent-runner.sh complete docs/agent-queue/tasks/green/002-css-fix.md
  scripts/dual-agent-runner.sh escalate docs/agent-queue/tasks/green/003-feature.md ">10 files touched"
EOF
}

require_queue_dir() {
  if [[ ! -d "$QUEUE_DIR" ]]; then
    echo "Queue directory missing: $QUEUE_DIR"
    echo "Create it and add task markdown files from docs/agent-queue/TEMPLATE_V2.md"
    exit 1
  fi
}

read_field() {
  local file="$1"
  local key="$2"
  awk -F': ' -v key="$key" '$1==key {print substr($0, index($0,$2)); exit}' "$file"
}

set_field() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}:" "$file"; then
    sed -i.bak "s/^${key}:.*/${key}: ${value}/" "$file"
    rm -f "${file}.bak"
  else
    printf "%s: %s\n" "$key" "$value" | cat - "$file" >"${file}.tmp"
    mv "${file}.tmp" "$file"
  fi
}

print_task_summary() {
  local file="$1"
  local status builder reviewer branch base type
  status="$(read_field "$file" "status")"
  builder="$(read_field "$file" "builder")"
  reviewer="$(read_field "$file" "reviewer")"
  branch="$(read_field "$file" "branch")"
  base="$(read_field "$file" "base")"
  type="$(read_field "$file" "type")"
  echo "Task: $file"
  echo "type: ${type:-<missing>}"
  echo "status: ${status:-<missing>}"
  echo "builder: ${builder:-<missing>}"
  echo "reviewer: ${reviewer:-<missing>}"
  echo "branch: ${branch:-<missing>}"
  echo "base: ${base:-<missing>}"
}

# Scan classified subdirectories in priority order: red → yellow → green.
# Within each directory, pick the oldest READY task by modification time.
next_task() {
  require_queue_dir
  local file=""
  for dir in "${PRIORITY_DIRS[@]}"; do
    local subdir="$QUEUE_DIR/$dir"
    [[ -d "$subdir" ]] || continue
    # Find oldest READY task in this priority bucket (by mtime)
    file="$(rg -l '^status: READY$' "$subdir" 2>/dev/null \
      | xargs -r ls -t 2>/dev/null | tail -n1 || true)"
    if [[ -n "$file" ]]; then
      break
    fi
  done
  # Fallback: also check flat QUEUE_DIR for legacy tasks
  if [[ -z "$file" ]]; then
    file="$(rg -l '^status: READY$' --max-depth 1 "$QUEUE_DIR" 2>/dev/null \
      | xargs -r ls -t 2>/dev/null | tail -n1 || true)"
  fi
  if [[ -z "$file" ]]; then
    echo "No READY tasks in $QUEUE_DIR/{red,yellow,green}"
    exit 0
  fi
  echo "$file"
  print_task_summary "$file"
}

handoff_builder() {
  local file="$1"
  local builder reviewer branch base
  builder="$(read_field "$file" "builder")"
  reviewer="$(read_field "$file" "reviewer")"
  branch="$(read_field "$file" "branch")"
  base="$(read_field "$file" "base")"
  cat <<EOF
=== Builder Handoff ===
Task file: $file
Builder: ${builder:-<missing>}
Reviewer: ${reviewer:-<missing>}
Branch: ${branch:-<missing>}
Base: ${base:-master}

Instructions:
1) Implement only what is in the task scope.
2) Run required commands listed in the task.
3) Open PR to ${base:-master}.
4) Post output with PR URL, commit SHA(s), files changed, PASS/FAIL matrix.
5) Move task to REVIEW once ready.
EOF
}

handoff_reviewer() {
  local file="$1"
  local reviewer
  reviewer="$(read_field "$file" "reviewer")"
  cat <<EOF
=== Reviewer Handoff ===
Task file: $file
Reviewer: ${reviewer:-<missing>}

Review requirements:
1) Focus on bugs/regressions/test gaps/accessibility.
2) Return either:
   - NO_FINDINGS (+ residual risk), or
   - severity-ranked findings (P1/P2/P3) with file refs and repro notes.
3) If findings exist, set task to FIX.
4) If no blocking findings and CI is green, set task to MERGE.
EOF
}

set_status() {
  local file="$1"
  local status="$2"
  case "$status" in
    READY|RUNNING|REVIEW|FIX|MERGE|DONE|BLOCKED) ;;
    *)
      echo "Invalid status: $status"
      exit 1
      ;;
  esac
  set_field "$file" "status" "$status"
  echo "Updated $file -> status: $status"
}

# Move a completed task to the done/ directory.
complete_task() {
  local file="$1"
  local done_dir="$QUEUE_DIR/done"
  mkdir -p "$done_dir"
  set_field "$file" "status" "DONE"
  local basename
  basename="$(basename "$file")"
  mv "$file" "$done_dir/$basename"
  echo "Completed: moved $file -> $done_dir/$basename"
}

# Scope escalation: set BLOCKED, record reason, move to blocked/.
escalate_task() {
  local file="$1"
  local reason="$2"
  local blocked_dir="$QUEUE_DIR/blocked"
  mkdir -p "$blocked_dir"
  set_field "$file" "status" "BLOCKED"
  printf "\n<!-- SCOPE_ESCALATION: %s -->\n" "$reason" >> "$file"
  local dest
  dest="$blocked_dir/$(basename "$file")"
  # Avoid overwrite: append epoch timestamp if destination exists
  if [[ -e "$dest" ]]; then
    local stem ext
    stem="${dest%.md}"
    ext=".md"
    dest="${stem}-$(date +%s)${ext}"
  fi
  mv "$file" "$dest"
  echo "Escalated: moved $file -> $dest (reason: $reason)"
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    next)
      next_task
      ;;
    handoff-builder)
      [[ $# -eq 2 ]] || { usage; exit 1; }
      handoff_builder "$2"
      ;;
    handoff-reviewer)
      [[ $# -eq 2 ]] || { usage; exit 1; }
      handoff_reviewer "$2"
      ;;
    set-status)
      [[ $# -eq 3 ]] || { usage; exit 1; }
      set_status "$2" "$3"
      ;;
    complete)
      [[ $# -eq 2 ]] || { usage; exit 1; }
      complete_task "$2"
      ;;
    escalate)
      [[ $# -eq 3 ]] || { usage; exit 1; }
      escalate_task "$2" "$3"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
