-- CreateTable
CREATE TABLE "agent_enrollments" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "user_id"         TEXT         NOT NULL,
    "refresh_token"   VARCHAR(128) NOT NULL,
    "daily_enabled"   BOOLEAN      NOT NULL DEFAULT true,
    "weekly_enabled"  BOOLEAN      NOT NULL DEFAULT true,
    "timezone"        VARCHAR(50)  NOT NULL DEFAULT 'America/New_York',
    "active"          BOOLEAN      NOT NULL DEFAULT true,
    "enrolled_at"     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_run_at"     TIMESTAMPTZ,
    "last_run_status" VARCHAR(20),
    "last_run_error"  VARCHAR(500),
    "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ  NOT NULL,

    CONSTRAINT "agent_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_enrollments_user_id_key" ON "agent_enrollments"("user_id");

-- CreateIndex
CREATE INDEX "agent_enrollments_active_idx" ON "agent_enrollments"("active");

-- AddForeignKey
ALTER TABLE "agent_enrollments"
    ADD CONSTRAINT "agent_enrollments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
