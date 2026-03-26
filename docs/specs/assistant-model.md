# Unified Assistant Model

> Story 4.1 — #589
> Status: Approved spec

## The Assistant's Identity

**Name**: "the assistant" (lowercase, no brand). Surfaces say "AI" in labels.

**Core jobs** (in order of frequency):
1. **Clarify** — Make vague inputs actionable ("Buy stuff" → "Buy groceries at Trader Joe's by Saturday").
2. **Prioritize** — Rank what matters given deadlines, energy, effort, and goals.
3. **Plan** — Generate day plans, decompose goals, suggest next actions.
4. **Review** — Surface stale work, missing commitments, waiting items, and pattern drift.
5. **Automate** — Run daily plans, weekly reviews, inbox triage, and cleanup on schedule.

## Surface Architecture

### Ambient Assist (inline, contextual)
Triggers automatically. User doesn't ask for it — it shows up when relevant.

| Surface | Trigger | What It Does |
|---------|---------|-------------|
| **On-Create Assist** | Task created with vague title | Suggests clarification, decomposition, or refinement |
| **Home Top Focus** | Home view loaded | Shows AI-ranked top tasks with reasoning |
| **Home Day Plan** | Home view loaded (if plan exists) | Shows today's plan with time allocation |
| **Home Priorities Brief** | Home view loaded (if brief exists) | Shows high-level priorities summary |
| **List Badges** | Tasks with energy/blocked/recurring | Shows inline indicators without interrupting scan |

### Dedicated Assist (user-initiated)
User explicitly asks for help.

| Surface | Entry Point | What It Does |
|---------|------------|-------------|
| **Task Drawer Assist** | Spark icon in drawer | Contextual help for the open task: refine, decompose, re-prioritize |
| **AI Workspace** | Sidebar panel | Brain dump → organized tasks, goal → project plan, plan critique |
| **Weekly Review** | Nav item or command palette | Structured review with findings and one-click apply |
| **Plan Today** | Command palette or home tile | Generate time-boxed day plan |

### Autonomous Assist (background, scheduled)
Runs without user interaction via the agent runner.

| Job | Cadence | What It Does |
|-----|---------|-------------|
| **Daily Plan** | Morning (configurable) | Pre-generate day plan |
| **Weekly Review** | Weekly (configurable) | Run review, surface findings |
| **Inbox Triage** | On new captures | Suggest task/project promotion |
| **Stale Cleanup** | Daily | Flag tasks not updated in 14+ days |
| **Home Prewarm** | On login / periodic | Pre-compute top focus ranking |

## Shared UI Language

All AI surfaces use the same vocabulary and interaction patterns:

### Suggestion Cards
Every AI output uses the same card structure:
- **Header**: What the assistant is suggesting (verb phrase)
- **Body**: The suggestion content
- **Rationale**: Why (collapsible, always available)
- **Confidence**: Visual indicator (high/medium/low) — not a number
- **Actions**: Primary action + dismiss. Always two buttons minimum.

### Action Verbs (standardized)
| Verb | Meaning | Used In |
|------|---------|---------|
| **Apply** | Accept and execute the suggestion | Plans, reviews, triage |
| **Accept** | Agree with the suggestion (no side effect) | Clarifications, critiques |
| **Dismiss** | Hide this suggestion | All surfaces |
| **Snooze** | Hide temporarily, resurface later | Plans, reviews |
| **Undo** | Reverse the last applied action | After any Apply |
| **Refine** | Ask the assistant to try again with more context | Clarifications, plans |

### Confidence Indicators
- **Strong** (green dot): Assistant is confident. One-click apply is safe.
- **Moderate** (yellow dot): Reasonable suggestion, review recommended.
- **Tentative** (gray dot): Best guess. User should verify.

No numeric scores shown to users. Confidence drives which suggestions auto-apply in autonomous mode (via action policies).

### Empty States
When AI has no suggestions:
- Home: "All clear. Your top tasks are up to date."
- Drawer: "This task looks good. No suggestions right now."
- Weekly Review: "Nothing flagged this week. Nice work."
- NOT: "No AI suggestions available" (robotic, unhelpful).

### Continuity Signals
When the assistant references prior context:
- "Last week you deferred this twice — worth reconsidering the priority?"
- "You accepted a similar suggestion for {project} last time."
- Displayed as a subtle footnote on the suggestion card, not as a separate section.

## What Changes

1. All suggestion cards across surfaces adopt the shared card structure.
2. Action verbs are standardized (no more "OK" / "Got it" / "Confirm" inconsistency).
3. Empty states are rewritten to feel like the assistant is present but calm.
4. Confidence indicators replace numeric scores in user-facing contexts.
5. Continuity footnotes appear when the assistant has relevant prior context.

## What Does NOT Change

- Backend AI logic, prompts, and scoring remain as-is.
- MCP tool signatures unchanged.
- Autonomous job cadences and thresholds unchanged.
- On-create assist trigger logic unchanged.
