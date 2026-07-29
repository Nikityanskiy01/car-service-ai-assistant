-- Contact submission source
ALTER TABLE "contact_submissions" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'contact_form';

-- Message attachments
ALTER TABLE "request_follow_up_messages" ALTER COLUMN "body" SET DEFAULT '';

CREATE TABLE IF NOT EXISTS "request_follow_up_attachments" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_follow_up_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "request_follow_up_attachments_message_id_idx" ON "request_follow_up_attachments"("message_id");

ALTER TABLE "request_follow_up_attachments" DROP CONSTRAINT IF EXISTS "request_follow_up_attachments_message_id_fkey";
ALTER TABLE "request_follow_up_attachments" ADD CONSTRAINT "request_follow_up_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "request_follow_up_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
