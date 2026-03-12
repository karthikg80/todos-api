ALTER TYPE "TodoPriority" ADD VALUE IF NOT EXISTS 'urgent';

CREATE TYPE "TodoStatus" AS ENUM (
  'inbox',
  'next',
  'in_progress',
  'waiting',
  'scheduled',
  'someday',
  'done',
  'cancelled'
);

CREATE TYPE "ProjectStatus" AS ENUM (
  'active',
  'on_hold',
  'completed',
  'archived'
);

CREATE TYPE "TodoEnergy" AS ENUM ('low', 'medium', 'high');

CREATE TYPE "ProjectReviewCadence" AS ENUM (
  'weekly',
  'biweekly',
  'monthly',
  'quarterly'
);

CREATE TYPE "TodoSource" AS ENUM (
  'manual',
  'chat',
  'email',
  'import',
  'automation'
);

CREATE TYPE "TodoRecurrenceType" AS ENUM (
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'rrule'
);

ALTER TABLE "projects"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN "priority" "TodoPriority",
  ADD COLUMN "area" VARCHAR(100),
  ADD COLUMN "goal" TEXT,
  ADD COLUMN "target_date" TIMESTAMP(3),
  ADD COLUMN "review_cadence" "ProjectReviewCadence",
  ADD COLUMN "last_reviewed_at" TIMESTAMP(3),
  ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "todos"
  ADD COLUMN "status" "TodoStatus" NOT NULL DEFAULT 'next',
  ADD COLUMN "context" VARCHAR(100),
  ADD COLUMN "energy" "TodoEnergy",
  ADD COLUMN "start_date" TIMESTAMP(3),
  ADD COLUMN "scheduled_date" TIMESTAMP(3),
  ADD COLUMN "review_date" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "estimate_minutes" INTEGER,
  ADD COLUMN "waiting_on" VARCHAR(255),
  ADD COLUMN "depends_on_task_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recurrence_type" "TodoRecurrenceType" NOT NULL DEFAULT 'none',
  ADD COLUMN "recurrence_interval" INTEGER,
  ADD COLUMN "recurrence_rrule" TEXT,
  ADD COLUMN "recurrence_next_occurrence" TIMESTAMP(3),
  ADD COLUMN "source" "TodoSource",
  ADD COLUMN "created_by_prompt" TEXT;

ALTER TABLE "subtasks"
  ADD COLUMN "completed_at" TIMESTAMP(3);

UPDATE "projects"
SET
  "status" = 'archived',
  "archived_at" = COALESCE("archived_at", "updated_at")
WHERE "archived" = true;

UPDATE "todos"
SET
  "status" = 'done',
  "completed_at" = COALESCE("completed_at", "updated_at")
WHERE "completed" = true;

UPDATE "subtasks"
SET "completed_at" = COALESCE("completed_at", "updated_at")
WHERE "completed" = true;

UPDATE "todos" AS t
SET "project_id" = p."id"
FROM "projects" AS p
WHERE
  t."project_id" IS NULL
  AND t."category" IS NOT NULL
  AND t."user_id" = p."user_id"
  AND t."category" = p."name";

UPDATE "todos" AS t
SET "category" = p."name"
FROM "projects" AS p
WHERE
  t."project_id" = p."id"
  AND t."category" IS DISTINCT FROM p."name";

CREATE INDEX "projects_user_id_status_idx" ON "projects"("user_id", "status");
CREATE INDEX "projects_user_id_archived_idx" ON "projects"("user_id", "archived");
CREATE INDEX "todos_user_id_status_idx" ON "todos"("user_id", "status");
CREATE INDEX "todos_user_id_archived_idx" ON "todos"("user_id", "archived");
CREATE INDEX "todos_user_id_project_id_status_idx" ON "todos"("user_id", "project_id", "status");
CREATE INDEX "todos_user_id_scheduled_date_idx" ON "todos"("user_id", "scheduled_date");
