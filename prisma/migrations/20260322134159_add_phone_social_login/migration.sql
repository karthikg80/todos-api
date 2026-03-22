-- AlterTable: make email and password nullable for social/phone login
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- AddColumn: phone number for phone login
ALTER TABLE "users" ADD COLUMN "phone_e164" VARCHAR(20);

-- AddColumn: onboarding tracking
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "onboarding_step" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users"("phone_e164");
