-- Security hardening: lockout, consent log, refresh family, verified phone uniqueness.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "consent_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "subject_key" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "policy_version" TEXT NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consent_events_user_id_idx" ON "consent_events"("user_id");
CREATE INDEX IF NOT EXISTS "consent_events_subject_key_idx" ON "consent_events"("subject_key");
CREATE INDEX IF NOT EXISTS "consent_events_created_at_idx" ON "consent_events"("created_at" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'consent_events_user_id_fkey'
  ) THEN
    ALTER TABLE "consent_events"
      ADD CONSTRAINT "consent_events_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "refresh_tokens"
  ADD COLUMN IF NOT EXISTS "family_id" TEXT,
  ADD COLUMN IF NOT EXISTS "consumed_at" TIMESTAMP(3);

UPDATE "refresh_tokens" SET "family_id" = "id" WHERE "family_id" IS NULL;

ALTER TABLE "refresh_tokens" ALTER COLUMN "family_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_verified_unique"
  ON "users" ("phone")
  WHERE "phone_verified_at" IS NOT NULL;
