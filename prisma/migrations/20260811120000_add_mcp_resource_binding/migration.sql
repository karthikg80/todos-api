ALTER TABLE "mcp_assistant_sessions"
  ADD COLUMN "resource" VARCHAR(1000),
  ADD COLUMN "timezone" VARCHAR(100);

ALTER TABLE "mcp_authorization_codes"
  ADD COLUMN "resource" VARCHAR(1000),
  ADD COLUMN "timezone" VARCHAR(100);

ALTER TABLE "mcp_refresh_tokens"
  ADD COLUMN "resource" VARCHAR(1000),
  ADD COLUMN "timezone" VARCHAR(100);

CREATE INDEX "mcp_assistant_sessions_resource_idx"
  ON "mcp_assistant_sessions"("resource");
