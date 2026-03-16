-- Issue #317: Add job context columns to agent_action_audits
ALTER TABLE "agent_action_audits"
  ADD COLUMN "job_name"       VARCHAR(100),
  ADD COLUMN "job_period_key" VARCHAR(20),
  ADD COLUMN "triggered_by"   VARCHAR(20);

CREATE INDEX "agent_action_audits_job_name_job_period_key_idx"
  ON "agent_action_audits"("job_name", "job_period_key");

-- Issue #314: Server-side job-run locking table
CREATE TABLE "agent_job_runs" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       TEXT NOT NULL,
  "job_name"      VARCHAR(100) NOT NULL,
  "period_key"    VARCHAR(20) NOT NULL,
  "status"        VARCHAR(20) NOT NULL,
  "claimed_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completed_at"  TIMESTAMPTZ,
  "failed_at"     TIMESTAMPTZ,
  "error_message" VARCHAR(500),
  "metadata"      JSONB,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "agent_job_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_job_runs_user_id_job_name_period_key_key"
    UNIQUE ("user_id", "job_name", "period_key"),
  CONSTRAINT "agent_job_runs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "agent_job_runs_user_id_idx" ON "agent_job_runs"("user_id");
CREATE INDEX "agent_job_runs_status_idx"  ON "agent_job_runs"("status");

-- Issue #320: Dead-letter store for failed automation actions
CREATE TABLE "failed_automation_actions" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       TEXT NOT NULL,
  "job_name"      VARCHAR(100) NOT NULL,
  "period_key"    VARCHAR(20) NOT NULL,
  "action_type"   VARCHAR(100) NOT NULL,
  "entity_type"   VARCHAR(50),
  "entity_id"     VARCHAR(100),
  "error_code"    VARCHAR(100),
  "error_message" VARCHAR(1000),
  "payload"       JSONB,
  "retryable"     BOOLEAN NOT NULL DEFAULT FALSE,
  "retry_count"   INTEGER NOT NULL DEFAULT 0,
  "resolved_at"   TIMESTAMPTZ,
  "resolution"    VARCHAR(20),
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "failed_automation_actions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "failed_automation_actions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "failed_automation_actions_user_id_created_at_idx"
  ON "failed_automation_actions"("user_id", "created_at");
CREATE INDEX "failed_automation_actions_user_id_job_name_period_key_idx"
  ON "failed_automation_actions"("user_id", "job_name", "period_key");
CREATE INDEX "failed_automation_actions_resolved_at_idx"
  ON "failed_automation_actions"("resolved_at");
