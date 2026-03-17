-- Migration: add action_policies_json column to agent_configs
ALTER TABLE "agent_configs"
  ADD COLUMN IF NOT EXISTS "action_policies_json" JSONB;
