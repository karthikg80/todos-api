CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "users"
ADD COLUMN "mcp_revoked_after" TIMESTAMP(3);

CREATE TABLE "mcp_assistant_sessions" (
  "id" UUID NOT NULL,
  "user_id" TEXT NOT NULL,
  "client_id" VARCHAR(5000),
  "assistant_name" VARCHAR(100),
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "source" VARCHAR(20) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "last_access_token_issued_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mcp_assistant_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mcp_refresh_tokens"
ADD COLUMN "session_id" UUID;

CREATE INDEX "mcp_assistant_sessions_user_id_revoked_at_idx"
ON "mcp_assistant_sessions"("user_id", "revoked_at");

CREATE INDEX "mcp_assistant_sessions_client_id_idx"
ON "mcp_assistant_sessions"("client_id");

CREATE INDEX "mcp_refresh_tokens_session_id_idx"
ON "mcp_refresh_tokens"("session_id");

ALTER TABLE "mcp_assistant_sessions"
ADD CONSTRAINT "mcp_assistant_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_refresh_tokens"
ADD CONSTRAINT "mcp_refresh_tokens_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "mcp_assistant_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
