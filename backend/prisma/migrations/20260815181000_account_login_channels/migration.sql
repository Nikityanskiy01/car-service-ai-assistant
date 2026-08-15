ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_linked_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_email_otp_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_sms_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_telegram_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_chat_id_key" ON "users"("telegram_chat_id");
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");

CREATE TABLE IF NOT EXISTS "auth_otp_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "purpose" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_otp_challenges_token_key" ON "auth_otp_challenges"("token");
CREATE INDEX IF NOT EXISTS "auth_otp_challenges_user_id_purpose_created_at_idx" ON "auth_otp_challenges"("user_id", "purpose", "created_at");
CREATE INDEX IF NOT EXISTS "auth_otp_challenges_expires_at_idx" ON "auth_otp_challenges"("expires_at");

DO $$ BEGIN
  ALTER TABLE "auth_otp_challenges" ADD CONSTRAINT "auth_otp_challenges_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
