CREATE TABLE "_project_id_uuid_map" (
  "old_id" TEXT PRIMARY KEY,
  "new_id" UUID NOT NULL UNIQUE
);

INSERT INTO "_project_id_uuid_map" ("old_id", "new_id")
SELECT
  p."id",
  CASE
    WHEN p."id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN p."id"::UUID
    ELSE (
      SUBSTRING(md5('legacy-project:' || p."id") FROM 1 FOR 8) || '-' ||
      SUBSTRING(md5('legacy-project:' || p."id") FROM 9 FOR 4) || '-' ||
      '5' || SUBSTRING(md5('legacy-project:' || p."id") FROM 14 FOR 3) || '-' ||
      SUBSTRING(
        '89ab'
        FROM ((get_byte(decode(SUBSTRING(md5('legacy-project:' || p."id") FROM 17 FOR 2), 'hex'), 0) % 4) + 1)
        FOR 1
      ) ||
      SUBSTRING(md5('legacy-project:' || p."id") FROM 19 FOR 3) || '-' ||
      SUBSTRING(md5('legacy-project:' || p."id") FROM 21 FOR 12)
    )::UUID
  END
FROM "projects" p;

ALTER TABLE "headings"
  DROP CONSTRAINT IF EXISTS "headings_project_id_fkey";

ALTER TABLE "todos"
  DROP CONSTRAINT IF EXISTS "todos_project_id_fkey",
  DROP CONSTRAINT IF EXISTS "todos_heading_id_fkey";

ALTER TABLE "subtasks"
  DROP CONSTRAINT IF EXISTS "subtasks_todo_id_fkey";

ALTER TABLE "ai_suggestion_applied_todos"
  DROP CONSTRAINT IF EXISTS "ai_suggestion_applied_todos_todo_id_fkey";

UPDATE "headings" h
SET "project_id" = map."new_id"::TEXT
FROM "_project_id_uuid_map" map
WHERE h."project_id" = map."old_id";

UPDATE "todos" t
SET "project_id" = map."new_id"::TEXT
FROM "_project_id_uuid_map" map
WHERE t."project_id" = map."old_id";

UPDATE "projects" p
SET "id" = map."new_id"::TEXT
FROM "_project_id_uuid_map" map
WHERE p."id" = map."old_id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "projects"
    WHERE NOT ("id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization expected all projects.id values to be UUID-compatible after remapping';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "headings"
    WHERE NOT ("id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization requires headings.id values to already be UUID-compatible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "headings"
    WHERE NOT ("project_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization expected all headings.project_id values to be UUID-compatible after project remapping';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "todos"
    WHERE NOT ("id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization requires todos.id values to already be UUID-compatible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "todos"
    WHERE "project_id" IS NOT NULL
      AND BTRIM("project_id") <> ''
      AND NOT ("project_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization expected all todos.project_id values to be UUID-compatible after project remapping';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "todos"
    WHERE "heading_id" IS NOT NULL
      AND BTRIM("heading_id") <> ''
      AND NOT ("heading_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization requires todos.heading_id values to already be UUID-compatible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "subtasks"
    WHERE NOT ("id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization requires subtasks.id values to already be UUID-compatible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "subtasks"
    WHERE NOT ("todo_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization requires subtasks.todo_id values to already be UUID-compatible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ai_suggestion_applied_todos"
    WHERE NOT ("todo_id" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ) THEN
    RAISE EXCEPTION 'UUID normalization requires ai_suggestion_applied_todos.todo_id values to already be UUID-compatible';
  END IF;
END $$;

ALTER TABLE "projects"
  ALTER COLUMN "id" TYPE UUID USING "id"::UUID;

ALTER TABLE "headings"
  ALTER COLUMN "id" TYPE UUID USING "id"::UUID,
  ALTER COLUMN "project_id" TYPE UUID USING "project_id"::UUID;

ALTER TABLE "todos"
  ALTER COLUMN "id" TYPE UUID USING "id"::UUID,
  ALTER COLUMN "project_id" TYPE UUID USING CASE
    WHEN "project_id" IS NULL OR BTRIM("project_id") = '' THEN NULL
    ELSE "project_id"::UUID
  END,
  ALTER COLUMN "heading_id" TYPE UUID USING CASE
    WHEN "heading_id" IS NULL OR BTRIM("heading_id") = '' THEN NULL
    ELSE "heading_id"::UUID
  END;

ALTER TABLE "subtasks"
  ALTER COLUMN "id" TYPE UUID USING "id"::UUID,
  ALTER COLUMN "todo_id" TYPE UUID USING "todo_id"::UUID;

ALTER TABLE "ai_suggestion_applied_todos"
  ALTER COLUMN "todo_id" TYPE UUID USING "todo_id"::UUID;

ALTER TABLE "headings"
  ADD CONSTRAINT "headings_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "todos"
  ADD CONSTRAINT "todos_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "todos_heading_id_fkey"
  FOREIGN KEY ("heading_id") REFERENCES "headings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subtasks"
  ADD CONSTRAINT "subtasks_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_suggestion_applied_todos"
  ADD CONSTRAINT "ai_suggestion_applied_todos_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "_project_id_uuid_map";
