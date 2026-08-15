ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_agent" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMP(3);

UPDATE "refresh_tokens"
SET "last_used_at" = "created_at"
WHERE "last_used_at" IS NULL;
