CREATE TYPE "FeedbackClassification" AS ENUM (
  'bug',
  'feature',
  'support',
  'duplicate_candidate',
  'noise'
);

ALTER TABLE "feedback_requests"
ADD COLUMN "classification" "FeedbackClassification",
ADD COLUMN "triage_confidence" DOUBLE PRECISION,
ADD COLUMN "normalized_title" VARCHAR(200),
ADD COLUMN "normalized_body" TEXT,
ADD COLUMN "impact_summary" TEXT,
ADD COLUMN "repro_steps_json" JSONB,
ADD COLUMN "expected_behavior" TEXT,
ADD COLUMN "actual_behavior" TEXT,
ADD COLUMN "proposed_outcome" TEXT,
ADD COLUMN "agent_labels_json" JSONB,
ADD COLUMN "missing_info_json" JSONB;

CREATE INDEX "feedback_requests_classification_triage_confidence_idx"
ON "feedback_requests"("classification", "triage_confidence");
