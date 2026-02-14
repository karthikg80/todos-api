# 06-guardrails-recovery-accessibility.md

## Guardrails

- Disallow delete or bulk operation suggestions unless user explicitly requests.
- Cap generated subtasks to 5.
- Past due-date suggestions must set `requiresConfirmation=true`; otherwise reject suggestion.
- Escalation to `high` priority requires `requiresConfirmation=true` unless explicit user intent is present.
- Reject suggestions that exceed field lengths or invalid enums.
- Enforce one clarification question maximum.
- Enforce deterministic rationale constraints:
  - max 120 chars
  - plain text, no markdown
  - no long quoted user text fragments (>40 chars)

## Recovery

- Every applied suggestion surfaces immediate undo.
- Track `quick revert` window (for example, 10 minutes) as negative signal.
- Record revert events in telemetry linked to source `AiSuggestion` and `suggestionId`.
- Adaptive throttle:
  - Reduce suggestion frequency after repeated rejects/undos.
  - Increase only after consistent accepts without quick revert.

Telemetry additions:

- Track suggestion view rate.
- Track time-to-first-apply.
- Track abstain rate per surface.
- Track undo rate by suggestion type.

## Accessibility

- Full keyboard navigation in drawer/sheet:
  - tab order predictable.
  - enter/space activate Apply/Dismiss.
- ARIA labels for all suggestion actions and rationale text.
- Screen reader friendly structure:
  - suggestion title.
  - concise rationale.
  - confidence descriptor (for example, `high confidence`).
- Ensure focus management on open/close and after apply/undo.
- Preserve mobile usability with proper sheet scroll lock and focus trapping.

## Interaction Risks and Mitigations

| Risk                                    | Mitigation                                                   |
| --------------------------------------- | ------------------------------------------------------------ |
| Row click conflicts with checkbox/kebab | explicit event boundaries; non-overlapping click targets     |
| Accidental apply on mobile              | larger action spacing + confirmation for high-impact changes |
| Sheet scroll lock bugs                  | standard lock/unlock lifecycle tests on open/close           |
| Suggestion overload                     | max 3-6 cards, ranked and collapsible rationale              |
