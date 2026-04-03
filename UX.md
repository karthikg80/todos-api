# UX Principles

This document defines the UX baseline for the Todos repo across the vanilla web client, React client, and iOS app.

It is intentionally practical. These are not abstract design values for a brand deck. They are the decision rules we use when designing new screens, revising flows, and reviewing UI changes in PRs.

## Scope

- Applies to `client/`, `client-react/`, and `ios/TodosApp/`
- Covers interaction design, visual system choices, and UX review criteria
- Complements architectural guidance in `AGENTS.md` and surface-specific guidance in client `AGENTS.md` files

## Core Principles

### 1. Clarity Over Decoration

The interface should make the next meaningful action obvious.

- Use hierarchy, spacing, typography, and color to emphasize what matters now
- Prefer calm, legible layouts over dense decoration
- Avoid adding visual treatments that do not improve comprehension

### 2. Fast Capture, Low Friction

This is a productivity product. Common actions should feel immediate.

- Creating, editing, completing, filtering, and navigating should require minimal effort
- Keep input flows short and forgiving
- Preserve momentum; do not interrupt the user with avoidable confirmations or hidden steps

### 3. Strong Signifiers, Predictable Controls

Interactive elements must look interactive, and similar actions must behave consistently.

- Buttons, links, chips, toggles, drag handles, menus, and editable fields need clear visual signifiers
- Repeated patterns should keep the same placement, styling, and behavior across surfaces
- Secondary and destructive actions should remain easy to identify without competing with the primary action

### 4. Visible System State

Users should never need to guess what the system is doing.

- Hover, focus, active, selected, disabled, loading, empty, success, warning, and error states must be explicit
- Long-running actions need visible progress or pending feedback
- Changes triggered by user input should have immediate acknowledgment

### 5. Accessibility Is Baseline UX

Accessibility is not a polish pass. It is part of the core interaction contract.

- Ensure keyboard access, focus visibility, semantic labels, and sufficient contrast
- Support touch-friendly target sizes and readable type scales
- Do not rely on color alone to communicate meaning
- Hidden UI should be truly hidden from assistive technologies when inactive

### 6. Consistency Through Shared Tokens

Consistency should come from system decisions, not copy-pasted styling.

- Reuse shared spacing, type, color, radius, elevation, and motion tokens where available
- Extend the existing visual system before introducing new one-off values
- If a new pattern repeats, promote it into a reusable token or component convention

### 7. Motion With Purpose

Animation should confirm intent, preserve orientation, or clarify change.

- Use motion to show cause and effect, not to decorate idle UI
- Keep transitions short and unobtrusive
- Reduce or remove motion that slows repeated task workflows

## Visual System Guidance

### Affordances and Signifiers

- Make clickability, editability, and drag/drop affordances obvious without relying on instructional text
- Use shape, contrast, spacing, iconography, and pointer behavior to signal interaction
- Destructive actions should be visually distinct and never easy to hit accidentally

### Visual Hierarchy

- Every surface should have one primary focal point
- Use size, position, contrast, grouping, and whitespace to direct attention
- Important information should appear first; secondary metadata should support, not compete

### Grids, Layout, and Spacing

- Use grids as flexible alignment guides, not rigid cages
- Prefer the existing spacing scale and a 4-point rhythm for consistent density
- Whitespace is functional; it separates groups, reduces scanning effort, and increases confidence
- When choosing between tighter density and clearer grouping, default to clearer grouping unless the workflow demands higher information density

### Typography

- Prefer one high-quality sans-serif family per surface unless there is a deliberate reason to mix
- Keep the type scale small, consistent, and purposeful
- Tune line height and letter spacing for readability, especially in dense lists and compact controls
- Do not use typography changes as decoration when spacing or grouping would solve the problem better

### Color

- Start from a restrained palette with one primary accent
- Use semantic colors consistently: success, warning, danger, info, and muted states should mean the same thing everywhere
- Reserve high-saturation color for emphasis, state, and action
- Never rely on color alone; pair it with labels, icons, or structure where needed

### Dark Mode

- Preserve hierarchy and readability when shadows are less effective
- Adjust contrast, brightness, borders, and surface layering rather than inverting light-mode values mechanically
- Dark surfaces should retain depth without becoming muddy or overly high-contrast

### Shadows and Elevation

- Use subtle elevation to distinguish layers, not to call attention to components
- Prefer lower opacity and broader blur over hard, dark shadows
- Border, contrast, and background layering are often better than stronger shadows

### Icons and Buttons

- Align icon size with text line height and control size
- Use icons to reinforce meaning, not replace labels when clarity would suffer
- Primary buttons should be unmistakable
- Secondary actions can use quieter treatments, including ghost buttons, when the hierarchy remains clear

### Overlays

- Dialogs, sheets, menus, and image overlays must preserve context without sacrificing readability
- Use scrims, gradients, and blur progressively to keep foreground content legible
- Modal layers should feel deliberate and easy to dismiss without creating ambiguity about current focus

## Interaction and State Rules

### Feedback and States

Every interactive element should define, at minimum, the states that matter for its role.

- Hover: confirms interactivity on pointer-based platforms
- Focus: visible and accessible for keyboard users
- Active/Pressed: acknowledges input immediately
- Selected: clearly indicates current choice or current view
- Disabled: communicates non-availability without looking broken
- Loading: shows that work is in progress and prevents accidental repeat actions
- Success/Error: explains the outcome and what to do next when relevant

### Micro-Interactions

- Use short motion or state changes to confirm saves, completions, reveals, and transitions
- Prefer subtle opacity, position, or scale changes over flashy effects
- Repeated workflows should stay fast; animation must not stack latency onto routine actions

## Product-Specific Guidance

### Task Flow First

For Todos, the UX should optimize for completing work, not showcasing interface chrome.

- Make the current task, next action, and workflow state easy to scan
- Support interruption-friendly behavior; users often enter mid-stream, switch context, and return later
- Reduce the cost of incomplete information by allowing quick capture first and structure second

### Cross-Surface Consistency

- Shared concepts such as priority, status, energy, due dates, waiting state, and recurrence should keep the same meaning across web and iOS
- Equivalent flows do not need pixel parity, but they should preserve the same mental model
- If API or shared type changes alter user-visible semantics, review UX impact across all clients

## PR Review Checklist

Use this checklist for UI-affecting changes.

- Is the primary action obvious?
- Are interactive elements clearly signified?
- Are hierarchy and grouping easy to scan?
- Are spacing and density consistent with the existing system?
- Are hover, focus, active, selected, disabled, loading, and error states defined where relevant?
- Is keyboard and screen-reader behavior preserved?
- Is meaning conveyed by more than color alone?
- Does motion clarify the interaction instead of slowing it down?
- Does the change reduce friction in common workflows?
- Does it preserve shared semantics across web and iOS where applicable?

## Implementation Notes

- In the vanilla web client, prefer extending shared tokens and patterns in `client/styles.css` over adding one-off values
- In React and iOS, preserve the same product semantics even when platform-native controls differ
- When a UI change introduces a new repeated pattern, document it here or promote it into the local surface guide
