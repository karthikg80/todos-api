# Workflow Guide

How tasks flow through the dual-agent system.

## Creating a Task

1. Decide the type based on blast radius:

   | Type   | When                                  | Example                          |
   |--------|---------------------------------------|----------------------------------|
   | Green  | Local change, ≤~5 files, no new patterns | Fix a CSS bug, add a test       |
   | Yellow | Bounded but meaningful, single module  | New UI component, refactor filter|
   | Red    | Cross-module, new dependency, schema   | Auth system, new API endpoint   |

2. Copy `docs/agent-queue/TEMPLATE_V2.md` into the matching folder:
   - `docs/agent-queue/tasks/green/NNN-name.md`
   - `docs/agent-queue/tasks/yellow/NNN-name.md`
   - `docs/agent-queue/tasks/red/NNN-name.md`

3. Fill the required fields. For Green, only fill: Intent, Acceptance Criteria, Files Allowed.

## Green vs Yellow vs Red

**Green (fast path, ~2 min ceremony):**
Delete the MIC-Lite and Pre-Mortem sections. Just describe intent and acceptance criteria. Start immediately.

**Yellow (~10 min ceremony):**
Include MIC-Lite (Motivation, Impact, Checkpoints). Delete Pre-Mortem. Review the checkpoints during implementation.

**Red (~20 min ceremony):**
Include both MIC-Lite and Pre-Mortem. The pre-mortem must be answered *before* implementation starts. Reviewer confirms pre-mortem adequacy.

**Survival mode (any type):**
When time-pressured, only three fields matter: Intent, Acceptance Criteria, Outcome.

## Scope Escalation

If work grows beyond the original scope (>10 files, new pattern, new dependency, cross-module change):
1. Set task status to `BLOCKED`.
2. Note which threshold was crossed.
3. Wait for re-approval. A Green may become Yellow; a Yellow may become Red.

## Handoff Between Agents

Codex and Claude alternate builder/reviewer roles per task.

**Builder finishes → hands off to Reviewer:**
- Push branch, open PR.
- Post handoff block (branch, SHA, files changed, PASS/FAIL matrix).

**Reviewer finishes → hands off to Builder (if fixes needed):**
- Post findings ranked by severity (P1/P2/P3) or `NO_FINDINGS`.
- Builder fixes and re-pushes.

**Merge:**
- All required checks green + reviewer approval.
- Move task file to `tasks/done/`.

## Memory Compaction

When `docs/memory/brief/BRIEF.md` exceeds ~2 pages:
1. Extract any new universal rules → `docs/memory/canon/CANON.md`.
2. Archive the old brief → `docs/memory/archive/`.
3. Write a fresh brief with current context only.
4. Update `docs/memory/index/INDEX.md` if pointers changed.
