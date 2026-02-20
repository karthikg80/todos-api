# 05-category-vs-projectId-strategy.md

## Objective

- Support legacy `Todo.category` project usage while migrating toward normalized `Todo.projectId` safely.

## Read/Display Rules

| Condition                                 | Display project label |
| ----------------------------------------- | --------------------- |
| `projectId` present and resolvable        | `Project.name`        |
| `projectId` null and `category` non-empty | `category`            |
| neither present                           | no project label      |

## AI Suggestion Handling Rules

| AI suggests              | System behavior                                                           |
| ------------------------ | ------------------------------------------------------------------------- |
| `projectId`              | validate ownership, set `Todo.projectId`, optional category sync          |
| `projectName`            | lookup `Project` by unique `[userId, name]`                               |
| existing project found   | set `projectId`; keep `category` sync per migration mode                  |
| no project found         | do not set `projectId`; emit explicit `propose_create_project` suggestion |
| `category` only          | set `Todo.category` with length and sanitization checks                   |
| `propose_create_project` | preview-only; create project only after explicit confirmation             |

Explicit rule:

- `set_project` must never imply project creation. Creation intent must use `propose_create_project`.

## Category Sync Decision

- Decision: keep `category` as denormalized compatibility cache during migration.
- Write rule in migration phase:
  - If `projectId` set, mirror `category = Project.name` unless user explicitly edits legacy category mode.
- Benefit: existing frontend paths stay stable while normalized reads become authoritative.

## Minimal Migration Steps

- Phase 1: dual-read, dual-write safety mode.
- Phase 2: UI reads normalized project first, fallback category.
- Phase 3: AI suggestions prefer project mapping and only fallback to category.
- Phase 4: optional cleanup/migration tooling for stale categories.

## Data Integrity Rules

- Never violate `[userId, name]` unique on `Project`.
- Enforce max length 50 for `Project.name` and `Todo.category`.
- Never set foreign `projectId` across users.
- On rename, update denormalized category lazily or via background sync strategy.
- On project deletion (`projectId` nullified), preserve historical `category` string if present.

## Edge Cases

| Scenario                             | Behavior                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `category` present, `projectId` null | show category; AI can propose mapping to existing project                               |
| project deleted, category remains    | keep category display; no broken reference                                              |
| project renamed                      | project chip follows new `Project.name`; category sync updates on touch or batch repair |
| category typo diverges from project  | normalized display wins when `projectId` exists; flag for optional cleanup              |

## Do-No-Harm Defaults

- Prefer no-op over risky mutation when mapping confidence is low.
- Ask one clarification when multiple project matches are plausible.
- Never auto-create projects from AI without explicit confirmation.

## API Contract (Formalized)

### Canonical field

- **`category`** is the public API field for both request and response payloads.
- **`projectId`** is internal; it never appears in API responses or client requests.

### Write path (create/update)

1. Client sends `category` (string or `null`).
2. `PrismaTodoService` normalizes: `normalizeCategory(category)` → trimmed string or `null`.
3. If non-null, `ensureProjectId(tx, userId, category)` upserts a `Project` row and sets `todo.projectId`.
4. If null, both `category` and `projectId` are set to `null`.

### Read path

`mapPrismaToTodo()` resolves the display value with this precedence:

```
project?.name  →  raw category  →  undefined
```

This means the Project name is authoritative when a `projectId` relation exists.

### Invariants

- Every todo with a non-null `category` has a corresponding `projectId` (enforced at write time).
- Every todo with a null `category` has a null `projectId`.
- `Project` rows are created on-demand via upsert; they are never orphaned by todo writes.
- The `[userId, name]` unique constraint on `Project` prevents duplicate project names per user.
- `category` and `Project.name` share the same 50-character max length.
