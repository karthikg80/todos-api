-- Migration: recommendation feedback capture (#334) + life state day context (#336)

-- #334: track accept/ignore/snooze/reorder signals on plan_today recommendations
CREATE TABLE "task_recommendation_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "plan_date" VARCHAR(10) NOT NULL,
    "task_id" VARCHAR(100) NOT NULL,
    "signal" VARCHAR(20) NOT NULL,
    "energy" VARCHAR(20),
    "available_minutes" INTEGER,
    "score" DOUBLE PRECISION,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_recommendation_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_recommendation_feedback_user_id_plan_date_idx"
    ON "task_recommendation_feedback"("user_id", "plan_date");
CREATE INDEX "task_recommendation_feedback_user_id_task_id_idx"
    ON "task_recommendation_feedback"("user_id", "task_id");

ALTER TABLE "task_recommendation_feedback"
    ADD CONSTRAINT "task_recommendation_feedback_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- #336: per-user per-day life state context
CREATE TABLE "user_day_contexts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "context_date" VARCHAR(10) NOT NULL,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "energy" VARCHAR(20),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_day_contexts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_day_contexts_user_id_context_date_key"
    ON "user_day_contexts"("user_id", "context_date");
CREATE INDEX "user_day_contexts_user_id_context_date_idx"
    ON "user_day_contexts"("user_id", "context_date");

ALTER TABLE "user_day_contexts"
    ADD CONSTRAINT "user_day_contexts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
