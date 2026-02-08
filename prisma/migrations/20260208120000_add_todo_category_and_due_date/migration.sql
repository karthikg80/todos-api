-- AlterTable: Add category and due date to todos
ALTER TABLE "todos" ADD COLUMN "category" VARCHAR(50);
ALTER TABLE "todos" ADD COLUMN "due_date" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "todos_user_id_category_idx" ON "todos"("user_id", "category");

-- CreateIndex
CREATE INDEX "todos_user_id_due_date_idx" ON "todos"("user_id", "due_date");
