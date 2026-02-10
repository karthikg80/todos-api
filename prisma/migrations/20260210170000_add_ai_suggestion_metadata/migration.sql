-- AlterTable
ALTER TABLE "ai_suggestions"
ADD COLUMN "schema_version" INTEGER,
ADD COLUMN "provider" VARCHAR(100),
ADD COLUMN "model" VARCHAR(100),
ADD COLUMN "prompt_hash" VARCHAR(64),
ADD COLUMN "input_summary" VARCHAR(500);
