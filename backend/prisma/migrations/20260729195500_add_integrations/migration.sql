-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('ONE_C', 'AUTODEALER_DESKTOP', 'AUTODEALER_WEB', 'AUTODEALER_ONLINE', 'BITRIX24', 'AMOCRM', 'YCLIENTS', 'MOYSKLAD', 'MEGAPLAN', 'GENERIC_REST', 'GENERIC_WEBHOOK', 'FILE_EXCHANGE');

-- CreateEnum
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('NOT_CONFIGURED', 'REQUIRES_SETUP', 'TESTING', 'CONNECTED', 'LIMITED', 'AUTH_ERROR', 'UNAVAILABLE', 'PAUSED');

-- CreateEnum
CREATE TYPE "IntegrationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'RETRYING', 'FAILED', 'DEAD_LETTER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntegrationConflictStatus" AS ENUM ('OPEN', 'RESOLVED_LOCAL', 'RESOLVED_EXTERNAL', 'RESOLVED_MERGED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "IntegrationDirection" AS ENUM ('OUTBOUND', 'INBOUND', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "IntegrationSourceOfTruth" AS ENUM ('LOCAL', 'EXTERNAL', 'LATEST_UPDATE', 'MANUAL_CONFIRMATION');

-- CreateEnum
CREATE TYPE "IntegrationOutboxStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "version_label" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'api',
    "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'REQUIRES_SETUP',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "capabilities_json" JSONB,
    "config_json" JSONB,
    "last_sync_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "masked_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_status_mappings" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "internal_status" TEXT NOT NULL,
    "external_status" TEXT NOT NULL,
    "direction" "IntegrationDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "sourceOfTruth" "IntegrationSourceOfTruth" NOT NULL DEFAULT 'MANUAL_CONFIRMATION',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_status_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_jobs" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "IntegrationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_attempts" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "error_message" TEXT,
    "http_status" INTEGER,
    "duration_ms" INTEGER,

    CONSTRAINT "integration_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_entity_links" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "internal_entity_type" TEXT NOT NULL,
    "internal_entity_id" TEXT NOT NULL,
    "external_entity_type" TEXT NOT NULL,
    "external_entity_id" TEXT NOT NULL,
    "external_url" TEXT,
    "synchronized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "external_version" TEXT,

    CONSTRAINT "external_entity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_webhook_events" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "event_id" TEXT,
    "payload_json" JSONB,
    "headers_json" JSONB,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "integration_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_conflicts" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "internal_entity_id" TEXT NOT NULL,
    "external_entity_id" TEXT,
    "field" TEXT NOT NULL,
    "local_value" TEXT,
    "external_value" TEXT,
    "status" "IntegrationConflictStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_audit_events" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_cursors" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "cursor_key" TEXT NOT NULL,
    "cursor_value" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_sync_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_outbox_events" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_json" JSONB,
    "status" "IntegrationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "integration_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_connections_tenant_id_provider_idx" ON "integration_connections"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "integration_connections_tenant_id_status_idx" ON "integration_connections"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_connection_id_key_key" ON "integration_credentials"("connection_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "integration_status_mappings_connection_id_entity_type_inter_key" ON "integration_status_mappings"("connection_id", "entity_type", "internal_status", "external_status");

-- CreateIndex
CREATE INDEX "integration_jobs_status_next_attempt_at_idx" ON "integration_jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "integration_jobs_entity_type_entity_id_idx" ON "integration_jobs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_jobs_connection_id_idempotency_key_key" ON "integration_jobs"("connection_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "integration_attempts_job_id_started_at_idx" ON "integration_attempts"("job_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "external_entity_links_connection_id_external_entity_id_idx" ON "external_entity_links"("connection_id", "external_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_entity_links_connection_id_internal_entity_type_in_key" ON "external_entity_links"("connection_id", "internal_entity_type", "internal_entity_id", "external_entity_type");

-- CreateIndex
CREATE INDEX "integration_webhook_events_connection_id_received_at_idx" ON "integration_webhook_events"("connection_id", "received_at" DESC);

-- CreateIndex
CREATE INDEX "integration_conflicts_connection_id_status_idx" ON "integration_conflicts"("connection_id", "status");

-- CreateIndex
CREATE INDEX "integration_conflicts_entity_type_internal_entity_id_idx" ON "integration_conflicts"("entity_type", "internal_entity_id");

-- CreateIndex
CREATE INDEX "integration_audit_events_connection_id_created_at_idx" ON "integration_audit_events"("connection_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "integration_audit_events_action_created_at_idx" ON "integration_audit_events"("action", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "integration_sync_cursors_connection_id_cursor_key_key" ON "integration_sync_cursors"("connection_id", "cursor_key");

-- CreateIndex
CREATE INDEX "integration_outbox_events_status_created_at_idx" ON "integration_outbox_events"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_outbox_events_connection_id_idempotency_key_key" ON "integration_outbox_events"("connection_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_status_mappings" ADD CONSTRAINT "integration_status_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_jobs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_attempts" ADD CONSTRAINT "integration_attempts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "integration_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_entity_links" ADD CONSTRAINT "external_entity_links_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_webhook_events" ADD CONSTRAINT "integration_webhook_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_conflicts" ADD CONSTRAINT "integration_conflicts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_audit_events" ADD CONSTRAINT "integration_audit_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_sync_cursors" ADD CONSTRAINT "integration_sync_cursors_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_outbox_events" ADD CONSTRAINT "integration_outbox_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

