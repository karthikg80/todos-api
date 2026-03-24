ALTER TYPE "TodoSource" ADD VALUE IF NOT EXISTS 'system_seed';

ALTER TABLE "todos"
ADD COLUMN "first_step" VARCHAR(255),
ADD COLUMN "emotional_state" VARCHAR(20);

ALTER TABLE "user_planning_preferences"
ADD COLUMN "soul_profile" JSONB;
