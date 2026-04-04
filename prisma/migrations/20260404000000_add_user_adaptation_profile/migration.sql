-- CreateEnum values for adaptation signals (append to existing ActivityEventType)
-- Note: Prisma handles enum additions automatically on migrate

-- CreateTable
CREATE TABLE "user_adaptation_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "profile_version" INTEGER NOT NULL DEFAULT 1,
    "policy_version" INTEGER NOT NULL DEFAULT 1,
    "eligibility" VARCHAR(20) NOT NULL DEFAULT 'none',
    "structure_appetite" VARCHAR(20) NOT NULL,
    "insight_affinity" VARCHAR(20) NOT NULL,
    "date_discipline" VARCHAR(20) NOT NULL,
    "organization_style" VARCHAR(20) NOT NULL,
    "guidance_need" VARCHAR(20) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "confidence_reason" VARCHAR(255),
    "signals_snapshot" JSONB,
    "scores_snapshot" JSONB,
    "signals_window_days" INTEGER NOT NULL DEFAULT 60,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_adaptation_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_adaptation_profiles_user_id_key" ON "user_adaptation_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_adaptation_profiles_user_id_idx" ON "user_adaptation_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "user_adaptation_profiles" ADD CONSTRAINT "user_adaptation_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
