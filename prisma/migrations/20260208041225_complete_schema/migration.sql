-- Add new columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "verification_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reset_token_expiry" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" VARCHAR(20) NOT NULL DEFAULT 'user';

-- Add unique constraints to users
CREATE UNIQUE INDEX IF NOT EXISTS "users_verification_token_key" ON "users"("verification_token");
CREATE UNIQUE INDEX IF NOT EXISTS "users_reset_token_key" ON "users"("reset_token");

-- Add new columns to todos table
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50);
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMP(3);
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(10) NOT NULL DEFAULT 'medium';
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Add indexes to todos
CREATE INDEX IF NOT EXISTS "todos_user_id_category_idx" ON "todos"("user_id", "category");
CREATE INDEX IF NOT EXISTS "todos_user_id_due_date_idx" ON "todos"("user_id", "due_date");
CREATE INDEX IF NOT EXISTS "todos_user_id_order_idx" ON "todos"("user_id", "order");
CREATE INDEX IF NOT EXISTS "todos_user_id_priority_idx" ON "todos"("user_id", "priority");

-- Create subtasks table
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

-- Add indexes and foreign key to subtasks
CREATE INDEX IF NOT EXISTS "subtasks_todo_id_order_idx" ON "subtasks"("todo_id", "order");
ALTER TABLE "subtasks" ADD CONSTRAINT IF NOT EXISTS "subtasks_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
