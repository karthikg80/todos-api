ALTER TABLE "feedback_requests"
ADD COLUMN "duplicate_candidate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "matched_feedback_ids" JSONB,
ADD COLUMN "matched_github_issue_number" INTEGER,
ADD COLUMN "matched_github_issue_url" VARCHAR(2000),
ADD COLUMN "duplicate_of_feedback_id" TEXT,
ADD COLUMN "duplicate_of_github_issue_number" INTEGER,
ADD COLUMN "duplicate_reason" TEXT;

CREATE INDEX "feedback_requests_duplicate_candidate_created_at_idx"
ON "feedback_requests"("duplicate_candidate", "created_at");

CREATE INDEX "feedback_requests_duplicate_of_feedback_id_idx"
ON "feedback_requests"("duplicate_of_feedback_id");

CREATE INDEX "feedback_requests_duplicate_of_github_issue_number_idx"
ON "feedback_requests"("duplicate_of_github_issue_number");
