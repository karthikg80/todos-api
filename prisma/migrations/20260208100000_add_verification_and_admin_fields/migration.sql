-- AlterTable: Add email verification fields
ALTER TABLE "users" ADD COLUMN "is_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "verification_token" VARCHAR(255);

-- AlterTable: Add password reset fields
ALTER TABLE "users" ADD COLUMN "reset_token" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "reset_token_expiry" TIMESTAMP(3);

-- AlterTable: Add role field
ALTER TABLE "users" ADD COLUMN "role" VARCHAR(20) NOT NULL DEFAULT 'user';

-- CreateIndex
CREATE UNIQUE INDEX "users_verification_token_key" ON "users"("verification_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");
