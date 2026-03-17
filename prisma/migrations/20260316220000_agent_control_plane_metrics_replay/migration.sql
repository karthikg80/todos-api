-- Migration: agent control plane, metrics, and replay support
-- Issues #329 (AgentConfig), #330 (retryCount on AgentJobRun), #332 (AgentMetricEvent)

-- #330: Add retry_count to agent_job_runs for replay tracking
ALTER TABLE "agent_job_runs" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0;

-- #329: Agent control plane — per-user configuration
CREATE TABLE "agent_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "daily_enabled" BOOLEAN NOT NULL DEFAULT true,
    "weekly_enabled" BOOLEAN NOT NULL DEFAULT true,
    "inbox_enabled" BOOLEAN NOT NULL DEFAULT true,
    "watchdog_enabled" BOOLEAN NOT NULL DEFAULT true,
    "decomposer_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_apply" BOOLEAN NOT NULL DEFAULT false,
    "max_write_actions_per_run" INTEGER NOT NULL DEFAULT 20,
    "inbox_confidence_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "stale_threshold_days" INTEGER NOT NULL DEFAULT 14,
    "waiting_follow_up_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_configs_user_id_key" ON "agent_configs"("user_id");

ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- #332: Automation metrics — time-series event log
CREATE TABLE "agent_metric_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "job_name" VARCHAR(100) NOT NULL,
    "period_key" VARCHAR(20) NOT NULL,
    "metric_type" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" VARCHAR(100),
    "value" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_metric_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_metric_events_user_id_recorded_at_idx" ON "agent_metric_events"("user_id", "recorded_at");
CREATE INDEX "agent_metric_events_user_id_job_name_period_key_idx" ON "agent_metric_events"("user_id", "job_name", "period_key");
CREATE INDEX "agent_metric_events_user_id_metric_type_idx" ON "agent_metric_events"("user_id", "metric_type");

ALTER TABLE "agent_metric_events" ADD CONSTRAINT "agent_metric_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
