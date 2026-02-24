-- Create headings table
CREATE TABLE IF NOT EXISTS "headings" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "headings_pkey" PRIMARY KEY ("id")
);

-- Add heading reference to todos
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "heading_id" TEXT;

-- Indexes for project heading lookup and task grouping
CREATE INDEX IF NOT EXISTS "headings_project_id_idx"
  ON "headings"("project_id");
CREATE INDEX IF NOT EXISTS "headings_project_id_sort_order_idx"
  ON "headings"("project_id", "sort_order");
CREATE INDEX IF NOT EXISTS "todos_user_id_heading_id_idx"
  ON "todos"("user_id", "heading_id");

-- Add foreign keys if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'headings_project_id_fkey'
  ) THEN
    ALTER TABLE "headings"
      ADD CONSTRAINT "headings_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'todos_heading_id_fkey'
  ) THEN
    ALTER TABLE "todos"
      ADD CONSTRAINT "todos_heading_id_fkey"
      FOREIGN KEY ("heading_id") REFERENCES "headings"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
