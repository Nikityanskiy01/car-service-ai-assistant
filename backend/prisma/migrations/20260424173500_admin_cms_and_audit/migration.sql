-- CreateTable
CREATE TABLE "site_content_blocks" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'general',
    "content" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_content_versions" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "site_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_events" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_content_blocks_key_key" ON "site_content_blocks"("key");
CREATE INDEX "site_content_blocks_section_updated_at_idx" ON "site_content_blocks"("section", "updated_at" DESC);
CREATE INDEX "site_content_versions_block_id_created_at_idx" ON "site_content_versions"("block_id", "created_at" DESC);
CREATE INDEX "admin_audit_events_entity_type_created_at_idx" ON "admin_audit_events"("entity_type", "created_at" DESC);
CREATE INDEX "admin_audit_events_action_created_at_idx" ON "admin_audit_events"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "site_content_versions"
ADD CONSTRAINT "site_content_versions_block_id_fkey"
FOREIGN KEY ("block_id") REFERENCES "site_content_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "site_content_versions"
ADD CONSTRAINT "site_content_versions_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_audit_events"
ADD CONSTRAINT "admin_audit_events_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
