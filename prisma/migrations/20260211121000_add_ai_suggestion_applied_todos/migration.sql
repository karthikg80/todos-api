-- Create relation table to preserve applied suggestion -> todo links with FK integrity.
CREATE TABLE "ai_suggestion_applied_todos" (
  "id" TEXT NOT NULL,
  "suggestion_id" TEXT NOT NULL,
  "todo_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_suggestion_applied_todos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_suggestion_applied_todos"
  ADD CONSTRAINT "ai_suggestion_applied_todos_suggestion_id_fkey"
  FOREIGN KEY ("suggestion_id") REFERENCES "ai_suggestions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_suggestion_applied_todos"
  ADD CONSTRAINT "ai_suggestion_applied_todos_todo_id_fkey"
  FOREIGN KEY ("todo_id") REFERENCES "todos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ai_suggestion_applied_todos_suggestion_id_todo_id_key"
  ON "ai_suggestion_applied_todos"("suggestion_id", "todo_id");

CREATE INDEX "ai_suggestion_applied_todos_todo_id_idx"
  ON "ai_suggestion_applied_todos"("todo_id");

-- Backfill mapping rows from legacy ai_suggestions.applied_todo_ids JSON where possible.
INSERT INTO "ai_suggestion_applied_todos" ("id", "suggestion_id", "todo_id", "created_at")
SELECT
  s.id || ':' || j.todo_id,
  s.id,
  j.todo_id,
  COALESCE(s.applied_at, s.updated_at, s.created_at)
FROM "ai_suggestions" AS s
CROSS JOIN LATERAL (
  SELECT DISTINCT value::text AS todo_id
  FROM jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(COALESCE(s.applied_todo_ids::jsonb, '[]'::jsonb)) = 'array'
        THEN COALESCE(s.applied_todo_ids::jsonb, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  )
) AS j
INNER JOIN "todos" AS t ON t.id = j.todo_id
ON CONFLICT ("suggestion_id", "todo_id") DO NOTHING;
