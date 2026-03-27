-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('task_created', 'task_completed', 'task_uncompleted', 'task_deleted', 'task_updated', 'task_status_changed', 'project_created', 'project_archived', 'subtask_completed', 'filter_used', 'bulk_action', 'session_start');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('completion_velocity', 'overcommitment_ratio', 'stale_task_count', 'streak_days', 'most_productive_hour', 'project_health');

-- CreateEnum
CREATE TYPE "InsightPeriodType" AS ENUM ('daily', 'weekly');

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "event_type" "ActivityEventType" NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_insights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "insight_type" "InsightType" NOT NULL,
    "period_type" "InsightPeriodType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_events_user_id_created_at_idx" ON "activity_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_events_user_id_event_type_created_at_idx" ON "activity_events"("user_id", "event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_insights_user_id_insight_type_period_type_period_start_key" ON "user_insights"("user_id", "insight_type", "period_type", "period_start");

-- CreateIndex
CREATE INDEX "user_insights_user_id_computed_at_idx" ON "user_insights"("user_id", "computed_at");

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_insights" ADD CONSTRAINT "user_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
