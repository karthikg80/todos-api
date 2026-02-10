-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('free', 'pro', 'team');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "plan" "UserPlan" NOT NULL DEFAULT 'free';

-- AlterTable
ALTER TABLE "ai_suggestions"
ADD COLUMN "applied_at" TIMESTAMP(3),
ADD COLUMN "applied_todo_ids" JSONB;
