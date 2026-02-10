-- CreateEnum
CREATE TYPE "AiSuggestionType" AS ENUM ('task_critic', 'plan_from_goal');

-- CreateEnum
CREATE TYPE "AiSuggestionStatus" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "ai_suggestions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "AiSuggestionType" NOT NULL,
  "input" JSONB NOT NULL,
  "output" JSONB NOT NULL,
  "status" "AiSuggestionStatus" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_suggestions_user_id_created_at_idx" ON "ai_suggestions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_suggestions_user_id_status_idx" ON "ai_suggestions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "ai_suggestions"
ADD CONSTRAINT "ai_suggestions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
