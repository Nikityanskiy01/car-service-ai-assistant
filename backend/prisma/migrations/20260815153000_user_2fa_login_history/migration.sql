ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret_enc" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_backup_hashes" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "user_login_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'password',
    "ip" TEXT,
    "user_agent" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_login_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_login_events_user_id_created_at_idx" ON "user_login_events"("user_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "user_login_events" ADD CONSTRAINT "user_login_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
