-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('bug', 'feature', 'general');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'triaged', 'closed');

-- CreateTable
CREATE TABLE "feedback_requests" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "screenshot_url" VARCHAR(2000),
    "attachment_metadata" JSONB,
    "page_url" VARCHAR(2000),
    "user_agent" VARCHAR(2000),
    "app_version" VARCHAR(50),
    "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
    "triage_summary" TEXT,
    "severity" VARCHAR(20),
    "dedupe_key" VARCHAR(255),
    "github_issue_number" INTEGER,
    "github_issue_url" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_requests_user_id_status_created_at_idx" ON "feedback_requests"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "feedback_requests_user_id_type_created_at_idx" ON "feedback_requests"("user_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "feedback_requests_dedupe_key_idx" ON "feedback_requests"("dedupe_key");

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
