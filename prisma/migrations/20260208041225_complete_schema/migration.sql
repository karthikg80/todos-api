-- AddColumnsToUsers
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_verified') THEN
    ALTER TABLE "users" ADD COLUMN "is_verified" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='verification_token') THEN
    ALTER TABLE "users" ADD COLUMN "verification_token" VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_token') THEN
    ALTER TABLE "users" ADD COLUMN "reset_token" VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_token_expiry') THEN
    ALTER TABLE "users" ADD COLUMN "reset_token_expiry" TIMESTAMP(3);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
    ALTER TABLE "users" ADD COLUMN "role" VARCHAR(20) NOT NULL DEFAULT 'user';
  END IF;
END $$;

-- AddIndexesToUsers
CREATE UNIQUE INDEX IF NOT EXISTS "users_verification_token_key" ON "users"("verification_token");
CREATE UNIQUE INDEX IF NOT EXISTS "users_reset_token_key" ON "users"("reset_token");

-- AddColumnsToTodos
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='category') THEN
    ALTER TABLE "todos" ADD COLUMN "category" VARCHAR(50);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='due_date') THEN
    ALTER TABLE "todos" ADD COLUMN "due_date" TIMESTAMP(3);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='order') THEN
    ALTER TABLE "todos" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='priority') THEN
    ALTER TABLE "todos" ADD COLUMN "priority" VARCHAR(10) NOT NULL DEFAULT 'medium';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='todos' AND column_name='notes') THEN
    ALTER TABLE "todos" ADD COLUMN "notes" TEXT;
  END IF;
END $$;

-- AddIndexesToTodos
CREATE INDEX IF NOT EXISTS "todos_user_id_category_idx" ON "todos"("user_id", "category");
CREATE INDEX IF NOT EXISTS "todos_user_id_due_date_idx" ON "todos"("user_id", "due_date");
CREATE INDEX IF NOT EXISTS "todos_user_id_order_idx" ON "todos"("user_id", "order");
CREATE INDEX IF NOT EXISTS "todos_user_id_priority_idx" ON "todos"("user_id", "priority");

-- CreateSubtasksTable
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

-- AddIndexAndForeignKeyToSubtasks
CREATE INDEX IF NOT EXISTS "subtasks_todo_id_order_idx" ON "subtasks"("todo_id", "order");

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'subtasks_todo_id_fkey'
  ) THEN
    ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_todo_id_fkey" 
      FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
