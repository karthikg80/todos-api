-- Alter feedback status enum to support admin review workflow
ALTER TYPE "FeedbackStatus" RENAME TO "FeedbackStatus_old";

CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'triaged', 'promoted', 'rejected');

ALTER TABLE "feedback_requests"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "FeedbackStatus"
  USING (
    CASE
      WHEN "status"::text = 'closed' THEN 'triaged'
      ELSE "status"::text
    END
  )::"FeedbackStatus";

DROP TYPE "FeedbackStatus_old";

ALTER TABLE "feedback_requests"
  ALTER COLUMN "status" SET DEFAULT 'new',
  ADD COLUMN "reviewed_by_user_id" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "rejection_reason" TEXT;

CREATE INDEX "feedback_requests_status_type_created_at_idx"
ON "feedback_requests"("status", "type", "created_at");

CREATE INDEX "feedback_requests_reviewed_by_user_id_reviewed_at_idx"
ON "feedback_requests"("reviewed_by_user_id", "reviewed_at");

ALTER TABLE "feedback_requests"
  ADD CONSTRAINT "feedback_requests_reviewed_by_user_id_fkey"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
