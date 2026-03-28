-- AlterEnum: Add morning_brief to AiSuggestionType
ALTER TYPE "AiSuggestionType" ADD VALUE 'morning_brief';

-- AlterTable: Add aiOptOut and projectHealthEnabled to agent_configs
ALTER TABLE "agent_configs" ADD COLUMN "ai_opt_out" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "agent_configs" ADD COLUMN "project_health_enabled" BOOLEAN NOT NULL DEFAULT true;
