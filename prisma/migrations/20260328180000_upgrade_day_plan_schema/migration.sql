-- CreateEnum
CREATE TYPE "DayPlanStatus" AS ENUM ('draft', 'active', 'finalized', 'reviewed', 'abandoned');

-- CreateEnum
CREATE TYPE "DayPlanTaskOutcome" AS ENUM ('pending', 'completed', 'deferred', 'removed');

-- CreateTable
CREATE TABLE "day_plans" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DayPlanStatus" NOT NULL DEFAULT 'draft',
    "mode" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "energy_level" VARCHAR(20),
    "available_minutes" INTEGER,
    "total_minutes" INTEGER,
    "remaining_minutes" INTEGER,
    "headline" JSONB,
    "budget_breakdown" JSONB,
    "decision_run_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finalized_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "day_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_plan_tasks" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "todo_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "committed" BOOLEAN NOT NULL DEFAULT true,
    "outcome" "DayPlanTaskOutcome" NOT NULL DEFAULT 'pending',
    "estimated_minutes" INTEGER,
    "score" DOUBLE PRECISION,
    "explanation" JSONB,
    "attribution" JSONB,
    "manually_added" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "day_plan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "day_plans_user_id_status_idx" ON "day_plans"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "day_plans_user_id_date_key" ON "day_plans"("user_id", "date");

-- CreateIndex
CREATE INDEX "day_plan_tasks_plan_id_order_idx" ON "day_plan_tasks"("plan_id", "order");

-- CreateIndex
CREATE INDEX "day_plan_tasks_todo_id_idx" ON "day_plan_tasks"("todo_id");

-- CreateIndex
CREATE UNIQUE INDEX "day_plan_tasks_plan_id_todo_id_key" ON "day_plan_tasks"("plan_id", "todo_id");

-- AddForeignKey
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_plan_tasks" ADD CONSTRAINT "day_plan_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "day_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_plan_tasks" ADD CONSTRAINT "day_plan_tasks_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
