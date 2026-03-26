# Product Review GitHub Backlog

GitHub-ready epic and issue set derived from the product review on 2026-03-26.

This file is a drafting artifact for GitHub Issues and Projects. It is not intended to replace live issue tracking in GitHub.

## Recommended Labels

- `epic`
- `story`
- `product`
- `frontend`
- `backend`
- `ai`
- `mcp`
- `planning`
- `ux`
- `docs`
- `p0`
- `p1`
- `p2`

## Execution Model

- Default implementation owner: `Codex`
- Default review owner: `Claude`
- For research/spec-heavy stories, invert ownership:
  - implementation/spec owner: `Claude`
  - review owner: `Codex`

## Epic 1: Reposition The Product Around Planning, Not CRUD

### Epic Issue

**Title**
`Epic: reposition Todos as an AI planning workspace`

**Labels**
`epic`, `product`, `ux`, `docs`, `p0`

**Suggested owner**
`Claude`

**Problem**
The product is still presented as "Todos REST API" / "Todo App" even though the real experience is a planning workspace with home focus, inbox capture, weekly review, AI assistance, and MCP connectivity.

**Goal**
Align landing copy, app naming, IA, and product language with the actual differentiated value.

**Success criteria**
- Landing page copy matches the actual product surface.
- App chrome stops sounding like a generic todo app.
- README and docs explain the planning workspace and assistant positioning.
- Navigation and empty states reinforce the new product story.

### Story 1.1

**Title**
`Story: define the product narrative, naming, and messaging architecture`

**Labels**
`story`, `product`, `docs`, `p0`

**Suggested owner**
`Claude`

**Dependencies**
- None

**Scope**
- Define primary product category, one-line description, homepage headline/subhead, and feature hierarchy.
- Decide whether to keep "Todo App" as an internal code name only.
- Produce a concise messaging guide for future UI and docs work.

**Acceptance criteria**
- A single approved positioning statement exists.
- A naming decision exists for app title, landing hero, and README lead.
- A messaging hierarchy exists for Home, Inbox, Planning, Review, AI, and MCP.

### Story 1.2

**Title**
`Story: update landing page and shell copy to reflect planning workspace positioning`

**Labels**
`story`, `frontend`, `ux`, `p0`

**Suggested owner**
`Codex`

**Dependencies**
- Story 1.1

**Scope**
- Update landing hero, feature cards, nav labels, app title, and major empty states.
- Preserve current visual structure unless copy changes require small UI adjustments.

**Acceptance criteria**
- Landing page clearly communicates planning, review, and assistant workflows.
- Generic "Todo App" phrasing is removed from user-facing primary surfaces.
- No broken layout regressions on desktop or mobile.

### Story 1.3

**Title**
`Story: rewrite README and assistant docs around the actual product surface`

**Labels**
`story`, `docs`, `mcp`, `p1`

**Suggested owner**
`Claude`

**Dependencies**
- Story 1.1

**Scope**
- Rewrite README lead and feature summary.
- Add a product-level overview that explains Home, Inbox, Weekly Review, AI, and MCP.
- Keep implementation details, but move them below the product overview.

**Acceptance criteria**
- README explains the current product honestly.
- Assistant docs describe MCP as part of the product, not an isolated technical add-on.

## Epic 2: Build A World-Class Command Layer

### Epic Issue

**Title**
`Epic: expand command palette into a first-class control surface`

**Labels**
`epic`, `frontend`, `ux`, `planning`, `p0`

**Suggested owner**
`Codex`

**Problem**
The current command palette is too shallow for a product with this many surfaces and workflows.

**Goal**
Make keyboard-first control a core strength, on par with the best command surfaces in Linear, Raycast, and Superhuman.

**Success criteria**
- Users can navigate, create, filter, and trigger planning/review flows from the command palette.
- Palette coverage includes all major workspaces and key actions.
- Search results are richer, faster to scan, and more actionable.

### Story 2.1

**Title**
`Story: design the command taxonomy for navigation, actions, and workflow commands`

**Labels**
`story`, `product`, `ux`, `p0`

**Suggested owner**
`Claude`

**Dependencies**
- None

**Scope**
- Define command groups:
  - navigation
  - task actions
  - project actions
  - planning actions
  - review actions
  - assistant actions
- Define ranking and naming rules.

**Acceptance criteria**
- A documented command taxonomy exists.
- Every primary workspace and daily workflow has a command entry.

### Story 2.2

**Title**
`Story: add workspace and workflow commands to the command palette`

**Labels**
`story`, `frontend`, `ux`, `p0`

**Suggested owner**
`Codex`

**Dependencies**
- Story 2.1

**Scope**
- Add commands for Home, Inbox, Unsorted, All tasks, Today, Upcoming, Weekly Review, Feedback, and settings.
- Add workflow triggers for run weekly review, generate day plan, open task composer, open AI workspace, and refresh priorities.

**Acceptance criteria**
- Users can reach all major workspaces via the palette.
- Users can trigger primary planning flows without pointer input.
- UI tests cover the new command coverage.

### Story 2.3

**Title**
`Story: upgrade task search results with richer metadata and direct actions`

**Labels**
`story`, `frontend`, `ux`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- Story 2.1

**Scope**
- Improve task matches with status, project, due state, and action affordances.
- Add direct-open and direct-complete/archive actions where safe.

**Acceptance criteria**
- Task search results are more informative than title-only plus minimal meta.
- Keyboard-only flows can open or act on a task quickly.

## Epic 3: Turn Rich Schema Into Visible Workflows

### Epic Issue

**Title**
`Epic: expose the full planning model through opinionated user workflows`

**Labels**
`epic`, `frontend`, `backend`, `planning`, `p0`

**Suggested owner**
`Codex`

**Problem**
The task and project schema already supports areas, goals, dependencies, recurrence, waiting, review cadence, effort, energy, and emotional state, but most of that is not surfaced as product workflows.

**Goal**
Move from hidden metadata to visible, useful user journeys.

**Success criteria**
- Waiting, scheduled, someday, dependencies, goals, and areas all have clear homes in the product.
- Home and review flows use this metadata more explicitly.
- Users understand why entering richer metadata helps them.

### Story 3.1

**Title**
`Story: design the visible workflow model for waiting, scheduled, someday, dependencies, goals, and areas`

**Labels**
`story`, `product`, `planning`, `p0`

**Suggested owner**
`Claude`

**Dependencies**
- None

**Scope**
- Define which concepts deserve first-class navigation.
- Define which concepts stay in the drawer but gain stronger summaries and entry points.
- Specify interactions between Home, Today, Upcoming, Weekly Review, and projects.

**Acceptance criteria**
- A workflow spec exists with decisions for each major metadata concept.
- The spec includes IA, user benefit, and not just data modeling.

### Story 3.2

**Title**
`Story: surface goals and areas in navigation and project workflows`

**Labels**
`story`, `frontend`, `planning`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- Story 3.1

**Scope**
- Add visible area/group affordances beyond passive project grouping.
- Add goal-aware project/task affordances where justified.
- Improve project creation/edit flows so goals and areas feel intentional.

**Acceptance criteria**
- Areas and goals are visible product concepts, not hidden fields.
- Users can understand how a project maps to broader life/work structure.

### Story 3.3

**Title**
`Story: make dependency and waiting workflows first-class`

**Labels**
`story`, `frontend`, `backend`, `planning`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- Story 3.1

**Scope**
- Improve waiting task views and follow-up actions.
- Show dependency relationships more clearly in drawer and list contexts.
- Reuse existing planner/work-graph logic where possible.

**Acceptance criteria**
- Waiting tasks are easier to manage than a plain filtered list.
- Blocked tasks expose what they depend on and what is blocked downstream.

### Story 3.4

**Title**
`Story: make recurrence, effort, and energy useful in daily planning`

**Labels**
`story`, `frontend`, `planning`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- Story 3.1

**Scope**
- Improve quick entry and drawer summaries for recurrence, effort, and energy.
- Surface why those fields change plan suggestions.
- Strengthen Today/Home explanations using the actual metadata.

**Acceptance criteria**
- Users can see why a task appears in a plan.
- Effort and energy fields feel operational, not decorative.

## Epic 4: Unify The AI Experience Into One Assistant Loop

### Epic Issue

**Title**
`Epic: unify AI surfaces into a coherent assistant experience`

**Labels**
`epic`, `ai`, `frontend`, `backend`, `p0`

**Suggested owner**
`Claude`

**Problem**
The product has multiple AI surfaces, but they feel like separate features: on-create assist, task-drawer assist, home focus, plan drafting, priorities brief, and AI workspace.

**Goal**
Create a single mental model for the assistant: clarify, prioritize, plan, review, and improve.

**Success criteria**
- AI surfaces share common language, controls, and explanation patterns.
- Users can understand what the assistant is for without learning each feature independently.
- Home, drawer, and planning flows feel like one system.

### Story 4.1

**Title**
`Story: define the unified assistant model, tone, and surface architecture`

**Labels**
`story`, `ai`, `product`, `ux`, `p0`

**Suggested owner**
`Claude`

**Dependencies**
- None

**Scope**
- Define the assistant's core jobs.
- Decide what belongs in ambient assist versus dedicated workspace.
- Define shared UI language for suggestions, confidence, apply, dismiss, undo, and rationale.

**Acceptance criteria**
- A cross-surface assistant spec exists.
- Shared terminology is defined for all AI interactions.

### Story 4.2

**Title**
`Story: consolidate AI entry points and align their interaction patterns`

**Labels**
`story`, `frontend`, `ai`, `ux`, `p0`

**Suggested owner**
`Codex`

**Dependencies**
- Story 4.1

**Scope**
- Harmonize suggestion cards, labels, empty states, and action verbs.
- Reduce redundant or confusing AI entry points.
- Preserve existing capability while making the experience feel unified.

**Acceptance criteria**
- Drawer assist, on-create assist, Home AI, and AI workspace use a shared interaction language.
- Users do not encounter conflicting AI metaphors across surfaces.

### Story 4.3

**Title**
`Story: add assistant memory and continuity across capture, planning, and review`

**Labels**
`story`, `backend`, `ai`, `planning`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- Story 4.1

**Scope**
- Reuse existing suggestion history, feedback, and planner context to create continuity.
- Let assistant reasoning build on prior user choices where safe.

**Acceptance criteria**
- The assistant can reference prior accepted/rejected guidance in product-visible ways.
- Repeat interactions feel cumulative rather than stateless.

## Epic 5: Add Real Calendar And Timeboxing Workflows

### Epic Issue

**Title**
`Epic: evolve today planning into true scheduling and timeboxing`

**Labels**
`epic`, `planning`, `frontend`, `backend`, `p1`

**Suggested owner**
`Codex`

**Problem**
The product can recommend a day plan and export `.ics`, but it does not yet deliver a strong scheduling workflow comparable to top planning products.

**Goal**
Bridge the gap between recommendation and execution with lightweight, opinionated scheduling.

**Success criteria**
- Users can convert plans into timeboxed blocks.
- Calendar-related decisions are visible in Home and Today.
- Existing planning metadata feeds scheduling decisions.

### Story 5.1

**Title**
`Story: define the MVP scheduling model and interaction pattern`

**Labels**
`story`, `planning`, `product`, `ux`, `p1`

**Suggested owner**
`Claude`

**Dependencies**
- None

**Scope**
- Define whether the first version is:
  - suggested blocks only
  - drag-to-schedule
  - calendar import/export plus block preview
- Define how scheduled tasks differ from due tasks.

**Acceptance criteria**
- A clear MVP scheduling scope is chosen.
- Success metrics and non-goals are documented.

### Story 5.2

**Title**
`Story: add plan-to-timebox flow on Today/Home`

**Labels**
`story`, `frontend`, `planning`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- Story 5.1

**Scope**
- Add UI to convert recommended tasks into blocks.
- Show estimated duration and scheduling fit.
- Reuse `estimateMinutes`, availability windows, and day context where possible.

**Acceptance criteria**
- Users can move from "today's plan" to scheduled work without leaving the app.
- UI tests cover the timeboxing flow.

### Story 5.3

**Title**
`Story: deepen calendar integration beyond filtered ICS export`

**Labels**
`story`, `frontend`, `backend`, `planning`, `p2`

**Suggested owner**
`Codex`

**Dependencies**
- Story 5.1

**Scope**
- Improve export semantics or add richer calendar interoperability.
- Preserve the current filtered export path while making scheduling more useful.

**Acceptance criteria**
- Calendar integration supports the scheduling MVP rather than living as an isolated utility.

## Epic 6: Productize MCP As A Core User-Facing Capability

### Epic Issue

**Title**
`Epic: make MCP and assistant connectivity a polished product surface`

**Labels**
`epic`, `mcp`, `backend`, `frontend`, `docs`, `p0`

**Suggested owner**
`Claude`

**Problem**
The MCP backend is strong, but its product layer is incomplete. It is technically capable, but not yet packaged like a premium assistant integration.

**Goal**
Make assistant connectivity easy to understand, configure, trust, and manage.

**Success criteria**
- Users can connect, inspect, and revoke assistants from within the app.
- MCP docs and examples are simple enough for real-world setup.
- Tool surface and scopes feel intentional rather than sprawling.

### Story 6.1

**Title**
`Story: define the user-facing MCP product surface and scope model`

**Labels**
`story`, `mcp`, `product`, `docs`, `p0`

**Suggested owner**
`Claude`

**Dependencies**
- None

**Scope**
- Decide how the product explains assistant connectivity.
- Define the supported use cases for Claude, ChatGPT, and similar clients.
- Review current tool sprawl and identify high-level workflows to spotlight.

**Acceptance criteria**
- A product spec exists for assistant connectivity.
- Recommended scopes and connector use cases are documented.

### Story 6.2

**Title**
`Story: build an in-app assistant sessions management UI`

**Labels**
`story`, `frontend`, `mcp`, `p0`

**Suggested owner**
`Codex`

**Dependencies**
- Story 6.1

**Scope**
- Add UI for listing active assistant sessions.
- Support revoke-one and revoke-all actions.
- Show assistant name, scopes, last used time, and helpful status copy.

**Acceptance criteria**
- Users can manage assistant sessions without API knowledge.
- The UI feels productized, not operational-only.

### Story 6.3

**Title**
`Story: publish connector quickstarts and high-signal examples for top assistant workflows`

**Labels**
`story`, `docs`, `mcp`, `p1`

**Suggested owner**
`Claude`

**Dependencies**
- Story 6.1

**Scope**
- Write quickstarts for common workflows:
  - ask what is due this week
  - capture a task
  - run weekly review
  - create next action for a project
- Keep examples grounded in the current tool surface.

**Acceptance criteria**
- A new user can connect a top assistant and perform a useful workflow with minimal confusion.

### Story 6.4

**Title**
`Story: refine MCP tool packaging around high-level assistant jobs`

**Labels**
`story`, `backend`, `mcp`, `p1`

**Suggested owner**
`Codex`

**Dependencies**
- Story 6.1

**Scope**
- Review whether the public tool catalog should expose additional composite jobs or better descriptions.
- Preserve backward compatibility where practical.

**Acceptance criteria**
- Tool discovery is clearer for assistant clients.
- High-value jobs are easier to invoke than low-level primitives alone.

## Cross-Epic Delivery Issues

### Issue A

**Title**
`Create a phased delivery roadmap for the product review backlog`

**Labels**
`product`, `planning`, `p0`

**Suggested owner**
`Claude`

**Scope**
- Convert these epics into 3 phases:
  - Phase 1: repositioning + command layer + MCP sessions UI
  - Phase 2: visible workflows + AI unification
  - Phase 3: scheduling/timeboxing

**Acceptance criteria**
- Every epic has an intended phase.
- Dependencies and risks are explicit.

### Issue B

**Title**
`Define success metrics for the planning workspace transformation`

**Labels**
`product`, `ai`, `mcp`, `p1`

**Suggested owner**
`Claude`

**Scope**
- Define measurable outcomes for:
  - Home usage
  - Inbox capture-to-promote conversion
  - Weekly review completion
  - command palette usage
  - assistant session activation
  - AI suggestion acceptance and undo

**Acceptance criteria**
- Metrics are concrete enough to instrument against existing telemetry patterns.

## Suggested GitHub Creation Order

1. Create all epic issues first.
2. Create Story 1.1, 2.1, 3.1, 4.1, 5.1, and 6.1.
3. After spec stories are approved, create implementation stories in dependency order.
4. Add all issues to one product transformation project board.

## Suggested First Sprint

- Story 1.1
- Story 1.2
- Story 2.1
- Story 2.2
- Story 6.1
- Story 6.2

This first sprint improves the product story, discoverability, and MCP polish without requiring a deep data-model refactor.
