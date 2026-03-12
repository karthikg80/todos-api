CREATE TABLE "mcp_authorization_codes" (
    "code" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "client_id" VARCHAR(5000) NOT NULL,
    "redirect_uri" VARCHAR(1000) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "assistant_name" VARCHAR(100),
    "state" VARCHAR(200),
    "code_challenge" VARCHAR(128) NOT NULL,
    "code_challenge_method" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_authorization_codes_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "mcp_refresh_tokens" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
    "assistant_name" VARCHAR(100),
    "client_id" VARCHAR(5000),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_idempotency_records" (
    "id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "user_id" TEXT NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "input_hash" VARCHAR(64) NOT NULL,
    "status" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_action_audits" (
    "id" UUID NOT NULL,
    "surface" VARCHAR(20) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "read_only" BOOLEAN NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "status" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_id" VARCHAR(255) NOT NULL,
    "actor" VARCHAR(255) NOT NULL,
    "idempotency_key" VARCHAR(255),
    "replayed" BOOLEAN NOT NULL DEFAULT false,
    "error_code" VARCHAR(100),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_action_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_refresh_tokens_token_hash_key" ON "mcp_refresh_tokens"("token_hash");
CREATE UNIQUE INDEX "agent_idempotency_records_action_user_id_idempotency_key_key" ON "agent_idempotency_records"("action", "user_id", "idempotency_key");

CREATE INDEX "mcp_authorization_codes_user_id_idx" ON "mcp_authorization_codes"("user_id");
CREATE INDEX "mcp_authorization_codes_expires_at_idx" ON "mcp_authorization_codes"("expires_at");
CREATE INDEX "mcp_refresh_tokens_user_id_idx" ON "mcp_refresh_tokens"("user_id");
CREATE INDEX "mcp_refresh_tokens_expires_at_idx" ON "mcp_refresh_tokens"("expires_at");
CREATE INDEX "agent_idempotency_records_expires_at_idx" ON "agent_idempotency_records"("expires_at");
CREATE INDEX "agent_idempotency_records_user_id_idx" ON "agent_idempotency_records"("user_id");
CREATE INDEX "agent_action_audits_user_id_created_at_idx" ON "agent_action_audits"("user_id", "created_at");
CREATE INDEX "agent_action_audits_request_id_idx" ON "agent_action_audits"("request_id");
CREATE INDEX "agent_action_audits_action_created_at_idx" ON "agent_action_audits"("action", "created_at");

ALTER TABLE "mcp_authorization_codes"
ADD CONSTRAINT "mcp_authorization_codes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_refresh_tokens"
ADD CONSTRAINT "mcp_refresh_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_idempotency_records"
ADD CONSTRAINT "agent_idempotency_records_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_action_audits"
ADD CONSTRAINT "agent_action_audits_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
