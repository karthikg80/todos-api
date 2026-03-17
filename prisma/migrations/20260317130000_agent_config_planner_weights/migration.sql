-- Migration: add planner weight columns to agent_configs
ALTER TABLE "agent_configs"
  ADD COLUMN IF NOT EXISTS "planner_weight_priority"     DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "planner_weight_due_date"     DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "planner_weight_energy_match" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "planner_weight_estimate_fit" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS "planner_weight_freshness"    DOUBLE PRECISION NOT NULL DEFAULT 1.0;
