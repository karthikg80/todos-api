-- Create enums if they do not already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('user', 'admin');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TodoPriority') THEN
    CREATE TYPE "TodoPriority" AS ENUM ('low', 'medium', 'high');
  END IF;
END $$;

-- Preserve existing data by casting current string values to enums.
ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole",
  ALTER COLUMN "role" SET DEFAULT 'user';

ALTER TABLE "todos"
  ALTER COLUMN "priority" DROP DEFAULT,
  ALTER COLUMN "priority" TYPE "TodoPriority" USING "priority"::"TodoPriority",
  ALTER COLUMN "priority" SET DEFAULT 'medium';

-- Keep this migration idempotent for environments where the index may already exist.
CREATE INDEX IF NOT EXISTS "todos_user_id_priority_idx" ON "todos"("user_id", "priority");
