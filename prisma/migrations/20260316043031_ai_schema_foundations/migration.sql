-- CreateEnum
CREATE TYPE "CaptureLifecycle" AS ENUM ('new', 'triaged', 'discarded');

-- DropIndex
DROP INDEX "projects_user_id_archived_idx";

-- DropIndex
DROP INDEX "projects_user_id_status_idx";

-- AlterTable
ALTER TABLE "mcp_assistant_sessions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "area_id" UUID,
ADD COLUMN     "goal_id" UUID;

-- AlterTable
ALTER TABLE "todos" ADD COLUMN     "area_id" UUID,
ADD COLUMN     "blocked_reason" VARCHAR(500),
ADD COLUMN     "confidence_score" INTEGER,
ADD COLUMN     "do_date" TIMESTAMP(3),
ADD COLUMN     "effort_score" INTEGER,
ADD COLUMN     "goal_id" UUID,
ADD COLUMN     "source_text" TEXT;

-- CreateTable
CREATE TABLE "capture_items" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" VARCHAR(100),
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifecycle" "CaptureLifecycle" NOT NULL DEFAULT 'new',
    "triage_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capture_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "target_date" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_planning_preferences" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "max_daily_tasks" INTEGER,
    "preferred_chunk_minutes" INTEGER,
    "deep_work_preference" VARCHAR(20),
    "weekends_active" BOOLEAN NOT NULL DEFAULT true,
    "preferred_contexts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "waiting_follow_up_days" INTEGER NOT NULL DEFAULT 7,
    "work_windows_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_planning_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capture_items_user_id_lifecycle_idx" ON "capture_items"("user_id", "lifecycle");

-- CreateIndex
CREATE INDEX "capture_items_user_id_captured_at_idx" ON "capture_items"("user_id", "captured_at");

-- CreateIndex
CREATE INDEX "areas_user_id_idx" ON "areas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "areas_user_id_name_key" ON "areas"("user_id", "name");

-- CreateIndex
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_planning_preferences_user_id_key" ON "user_planning_preferences"("user_id");

-- CreateIndex
CREATE INDEX "todos_user_id_do_date_idx" ON "todos"("user_id", "do_date");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_items" ADD CONSTRAINT "capture_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_planning_preferences" ADD CONSTRAINT "user_planning_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
