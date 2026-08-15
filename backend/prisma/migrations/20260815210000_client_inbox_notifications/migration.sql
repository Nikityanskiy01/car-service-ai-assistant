CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
    "user_id" TEXT NOT NULL,
    "booking_reminders" BOOLEAN NOT NULL DEFAULT true,
    "message_alerts" BOOLEAN NOT NULL DEFAULT true,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "channel_email" BOOLEAN NOT NULL DEFAULT true,
    "channel_telegram" BOOLEAN NOT NULL DEFAULT true,
    "channel_sms" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("user_id")
);

DO $$ BEGIN
  ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inbox_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbox_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inbox_notifications_dedupe_key_key" ON "inbox_notifications"("dedupe_key");
CREATE INDEX IF NOT EXISTS "inbox_notifications_user_id_created_at_idx" ON "inbox_notifications"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "inbox_notifications_user_id_read_at_idx" ON "inbox_notifications"("user_id", "read_at");

DO $$ BEGIN
  ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "inbox_notification_deliveries" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbox_notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inbox_notification_deliveries_notification_id_idx" ON "inbox_notification_deliveries"("notification_id");

DO $$ BEGIN
  ALTER TABLE "inbox_notification_deliveries" ADD CONSTRAINT "inbox_notification_deliveries_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "inbox_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
