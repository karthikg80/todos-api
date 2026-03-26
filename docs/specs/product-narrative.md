# Product Narrative, Naming, and Messaging Architecture

> Story 1.1 — #586
> Status: Approved spec

## Positioning Statement

**Todoist for people who think in systems.**

A planning workspace that turns scattered tasks into focused days, reviewed weeks, and clear next actions — with an AI assistant that learns how you work.

## Naming Decision

| Context | Current | Decision |
|---------|---------|----------|
| Internal code name | todos-api | Keep as-is (repo, CI, infra) |
| App title (browser tab, PWA) | "Todo App" | **"Planda"** (working title) or retain "Todos" if renaming is deferred — but drop "App" |
| Landing hero | "Your tasks, your way." | Rewrite to lead with planning, not task management |
| README lead | "Full-stack todo application" | "AI planning workspace" |
| Nav/shell chrome | "Todos" tab | Keep — it's the content type, not the product name |

**Decision**: For this iteration, rename user-facing surfaces from "Todo App" to the product's actual identity. The repo name stays `todos-api`. The app title becomes **"Todos — Planning Workspace"** until a brand name is chosen.

## One-Line Description

> A calm workspace for turning scattered tasks into focused days, reviewed weeks, and clear next actions.

## Homepage Headline & Subhead

**Headline**: "Plan your days. Review your weeks. Focus on what matters."

**Subhead**: "Capture anything, let AI organize it, and wake up to a plan that fits your energy, your calendar, and your goals."

## Feature Hierarchy

The product has six pillars, ranked by differentiation:

### Tier 1 — Core Differentiators
1. **Home Focus** — AI-curated top tasks, due-soon grouping, daily plan, and priorities brief in one dashboard.
2. **AI Planning Assistant** — Clarify vague tasks on capture, decompose goals into steps, generate time-boxed day plans, run weekly reviews — one assistant that learns from your choices.
3. **Assistant Connectivity (MCP)** — Connect Claude, ChatGPT, or any MCP client to manage tasks conversationally. 78 tools across capture, planning, review, and automation.

### Tier 2 — Strong Capabilities
4. **Inbox & Capture** — Dump anything (voice, text, paste). Triage batches with AI suggestions. Promote to tasks or projects.
5. **Weekly Review** — Structured review: stale tasks, missing next actions, waiting items, overdue — with one-click apply.
6. **Projects & Organization** — Projects, areas, goals, headings, tags, contexts. Rich schema that powers smart suggestions.

### Tier 3 — Table Stakes
7. **Task Management** — Create, edit, complete, reorder, drag-drop, subtasks, recurrence, priorities.
8. **Quick Entry** — Natural language parsing: "Call dentist tomorrow 2pm" → task with due date.
9. **Calendar Export** — ICS export for any filtered view.

## Messaging Hierarchy by Surface

| Surface | Core Message | Supporting Detail |
|---------|-------------|-------------------|
| **Home** | "Your day at a glance" | Top focus + due soon + daily plan + stale alerts |
| **Inbox** | "Capture now, organize later" | Brain dump → AI triage → promote to tasks |
| **Today / Upcoming** | "What's on your plate" | Time-scoped views with energy-aware planning |
| **Weekly Review** | "Stay honest about your commitments" | Structured review with actionable findings |
| **AI Assistant** | "A second brain, not another dashboard" | Clarify, plan, decompose, review — one loop |
| **MCP / Connectivity** | "Your assistant already knows your tasks" | Connect once, manage conversationally |
| **Projects** | "From goals to next actions" | Areas → goals → projects → tasks → subtasks |
| **Settings / Automation** | "Set it and forget it" | Daily plans, weekly reviews, cleanup — all on autopilot |

## What This Changes

1. Landing page leads with planning and review, not CRUD.
2. "Todo App" disappears from user-facing primary surfaces.
3. Feature cards reordered: Home Focus → AI Assistant → MCP → Capture.
4. Empty states reinforce the planning story ("No tasks today — that's the goal" vs "Nothing here yet").
5. README opens with the planning workspace identity, implementation details move below.
