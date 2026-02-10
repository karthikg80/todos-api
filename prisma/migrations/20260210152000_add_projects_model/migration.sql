-- Create projects table
CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- Add project reference to todos
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "project_id" TEXT;

-- Ensure uniqueness and indexes
CREATE UNIQUE INDEX IF NOT EXISTS "projects_user_id_name_key"
  ON "projects"("user_id", "name");
CREATE INDEX IF NOT EXISTS "projects_user_id_idx"
  ON "projects"("user_id");
CREATE INDEX IF NOT EXISTS "todos_user_id_project_id_idx"
  ON "todos"("user_id", "project_id");

-- Backfill projects from existing todo categories.
INSERT INTO "projects" ("id", "name", "user_id", "created_at", "updated_at")
SELECT
  md5(random()::text || clock_timestamp()::text || t."user_id" || TRIM(t."category")),
  TRIM(t."category"),
  t."user_id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "todos" t
WHERE t."category" IS NOT NULL
  AND TRIM(t."category") <> ''
ON CONFLICT ("user_id", "name") DO NOTHING;

-- Backfill project references on todos.
UPDATE "todos" t
SET "project_id" = p."id"
FROM "projects" p
WHERE t."user_id" = p."user_id"
  AND t."category" = p."name"
  AND t."project_id" IS NULL;

-- Add foreign key if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'todos_project_id_fkey'
  ) THEN
    ALTER TABLE "todos"
      ADD CONSTRAINT "todos_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
