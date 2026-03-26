# MVP Scheduling Model

> Story 5.1 — #590
> Status: Approved spec

## Decision: Suggested Blocks + Manual Confirm

The first version is **suggested blocks only** — no drag-to-schedule, no two-way calendar sync. The assistant proposes a time-slotted plan; the user confirms, adjusts, or dismisses.

### Why Not Drag-to-Schedule First
- Drag-to-schedule requires a calendar view component — significant UI investment.
- The product already generates time-boxed plans via `plan_today` with `estimateMinutes`.
- Suggested blocks build on existing infrastructure (plan generation, availability windows, day context).
- We can ship value faster and learn whether users want manual scheduling or trust the assistant.

### Why Not Calendar Import
- Two-way calendar sync is complex (OAuth, conflict resolution, polling).
- The ICS export path already exists for outbound.
- Calendar import is Phase 2 — once we know what scheduling data users actually need.

## Interaction Pattern

### Entry Point
1. **Home dashboard → Day Plan tile** (existing) — enhanced with time blocks.
2. **Command palette → "Plan Today"** — generates or refreshes the plan.
3. **Today view → "Timebox" button** — converts today's task list into a slotted plan.

### Flow

```
User opens Home or runs "Plan Today"
  → Assistant generates plan with time slots:
    ┌─────────────────────────────────────────┐
    │ 9:00 – 9:45   Review PR for auth flow   │
    │                45 min · high energy · #work │
    │ 9:45 – 10:00  [break]                   │
    │ 10:00 – 10:30 Reply to Sarah re: budget │
    │                30 min · low energy · #work  │
    │ 10:30 – 11:30 Write integration tests    │
    │                60 min · high energy · #dev  │
    │ ...                                      │
    │ Unscheduled: 2 tasks (no time estimate)  │
    └─────────────────────────────────────────┘
  → User can:
    - Accept all → marks as today's committed plan
    - Remove a task → re-slots remaining
    - Swap order → assistant re-times
    - Dismiss → no plan committed
  → Accepted plan visible in Home + Today views
  → Tasks show their assigned time slot in list rows
```

### Scheduled vs Due

| Field | Meaning | When Set |
|-------|---------|----------|
| `dueDate` | Hard deadline — the task must be done by this date | User-set or imported |
| `scheduledDate` | Soft commitment — the user intends to work on this date | User-set or plan-confirmed |
| `timeSlot` (new, ephemeral) | Time block within a scheduled day | Plan-confirmed only, not persisted in DB |

**Time slots are ephemeral** — stored in the plan response and rendered in the UI, but not persisted as a database field. If the user refreshes the plan, slots regenerate. This avoids schema changes and keeps scheduling lightweight.

### Plan Persistence

- The confirmed plan is stored as a `plan_today` job run with `status: applied`.
- The plan response (with time slots) is cached in the job run's `result` field.
- Home and Today views read from the latest applied plan run for today's date.
- If no plan exists, the views fall back to default due-date ordering.

## Availability Windows Integration

The plan respects `get_availability_windows` output:
- Default: 8 hours (480 min), configurable per user.
- Day context overrides: "travel" → 3 hours, "sprint" → 10 hours, "rescue" → 4 hours on highest-priority only.
- Energy level shapes task ordering: high-energy tasks scheduled for morning, low-energy for afternoon.

## Success Metrics

1. **Plan generation rate**: % of active users who generate a day plan at least 3x/week.
2. **Plan acceptance rate**: % of generated plans that are accepted (not dismissed).
3. **Task completion within plan**: % of planned tasks completed on the planned day.
4. **Re-plan rate**: How often users regenerate (low = good fit, very high = poor suggestions).

## Non-Goals (This Phase)

- No two-way calendar sync (Google Calendar, Outlook).
- No drag-and-drop reordering of time blocks.
- No multi-day planning (plan is always for today).
- No shared/team scheduling.
- No calendar view component (list-based rendering only).
- No persisted time-slot field in the database schema.
