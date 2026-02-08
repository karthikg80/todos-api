-- AlterTable: Add new columns to users (if they don't exist)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verification_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expiry" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) NOT NULL DEFAULT 'user';

-- CreateIndex (will skip if exists)
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_verification_token_key" ON "users"("verification_token");
CREATE UNIQUE INDEX IF NOT EXISTS "users_reset_token_key" ON "users"("reset_token");

-- AlterTable: Add new columns to todos (if they don't exist)
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50);
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMP(3);
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(10) NOT NULL DEFAULT 'medium';
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- CreateIndex for todos
CREATE INDEX IF NOT EXISTS "todos_user_id_category_idx" ON "todos"("user_id", "category");
CREATE INDEX IF NOT EXISTS "todos_user_id_due_date_idx" ON "todos"("user_id", "due_date");
CREATE INDEX IF NOT EXISTS "todos_user_id_order_idx" ON "todos"("user_id", "order");
CREATE INDEX IF NOT EXISTS "todos_user_id_priority_idx" ON "todos"("user_id", "priority");

-- CreateTable: subtasks (only if not exists)
CREATE TABLE IF NOT EXISTS "subtasks" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "todo_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for subtasks
CREATE INDEX IF NOT EXISTS "subtasks_todo_id_order_idx" ON "subtasks"("todo_id", "order");

-- AddForeignKey (skip if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subtasks_todo_id_fkey'
  ) THEN
    ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_todo_id_fkey" 
      FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
