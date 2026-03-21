ALTER TABLE "feedback_requests"
ADD COLUMN "promotion_decision" VARCHAR(20),
ADD COLUMN "promotion_reason" TEXT,
ADD COLUMN "promotion_run_id" VARCHAR(120),
ADD COLUMN "promotion_decided_at" TIMESTAMP(3);

CREATE INDEX "feedback_requests_promotion_decision_promotion_decided_at_idx"
ON "feedback_requests"("promotion_decision", "promotion_decided_at");

CREATE INDEX "feedback_requests_promotion_run_id_idx"
ON "feedback_requests"("promotion_run_id");

ALTER TABLE "agent_configs"
ADD COLUMN "feedback_automation_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "feedback_auto_promote_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "feedback_auto_promote_min_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.9;
