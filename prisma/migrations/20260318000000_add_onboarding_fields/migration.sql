-- AlterTable
ALTER TABLE "users" ADD COLUMN "onboarding_step" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);
