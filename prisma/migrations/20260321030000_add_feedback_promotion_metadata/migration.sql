ALTER TABLE "feedback_requests"
ADD COLUMN "promoted_at" TIMESTAMP(3);

CREATE INDEX "feedback_requests_promoted_at_idx"
ON "feedback_requests"("promoted_at");
