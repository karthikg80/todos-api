-- Issue #351: learning recommendation storage

CREATE TABLE "learning_recommendations" (
    "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"        TEXT        NOT NULL,
    "type"           VARCHAR(30) NOT NULL,
    "target"         VARCHAR(100) NOT NULL,
    "current_value"  JSONB       NOT NULL,
    "suggested_value" JSONB      NOT NULL,
    "confidence"     DOUBLE PRECISION NOT NULL,
    "why"            TEXT        NOT NULL,
    "evidence"       JSONB,
    "status"         VARCHAR(20) NOT NULL DEFAULT 'pending',
    "applied_at"     TIMESTAMP(3),
    "dismissed_at"   TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "learning_recommendations_user_id_status_idx"
    ON "learning_recommendations"("user_id", "status");

CREATE INDEX "learning_recommendations_user_id_created_at_idx"
    ON "learning_recommendations"("user_id", "created_at");

ALTER TABLE "learning_recommendations"
    ADD CONSTRAINT "learning_recommendations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
