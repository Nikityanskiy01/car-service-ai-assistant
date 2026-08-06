-- AlterTable
ALTER TABLE "client_vehicles" ADD COLUMN "current_mileage_km" INTEGER;

-- CreateTable
CREATE TABLE "vehicle_service_records" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "performed_at" TIMESTAMP(3) NOT NULL,
    "mileage_km" INTEGER,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "works_done" TEXT,
    "work_order_number" TEXT,
    "amount_minor" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'client_manual',
    "service_request_id" TEXT,
    "consultation_feedback_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_service_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_service_records_vehicle_id_performed_at_idx" ON "vehicle_service_records"("vehicle_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "vehicle_service_records_client_id_performed_at_idx" ON "vehicle_service_records"("client_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "vehicle_service_records_category_vehicle_id_idx" ON "vehicle_service_records"("category", "vehicle_id");

-- CreateIndex
CREATE INDEX "vehicle_service_records_consultation_feedback_id_idx" ON "vehicle_service_records"("consultation_feedback_id");

-- AddForeignKey
ALTER TABLE "vehicle_service_records" ADD CONSTRAINT "vehicle_service_records_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "client_vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_service_records" ADD CONSTRAINT "vehicle_service_records_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_service_records" ADD CONSTRAINT "vehicle_service_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_service_records" ADD CONSTRAINT "vehicle_service_records_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_service_records" ADD CONSTRAINT "vehicle_service_records_consultation_feedback_id_fkey" FOREIGN KEY ("consultation_feedback_id") REFERENCES "consultation_feedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from consultation feedback linked to vehicles
INSERT INTO "vehicle_service_records" (
  "id",
  "vehicle_id",
  "client_id",
  "performed_at",
  "mileage_km",
  "title",
  "category",
  "works_done",
  "work_order_number",
  "amount_minor",
  "source",
  "service_request_id",
  "consultation_feedback_id",
  "created_by_id",
  "created_at",
  "updated_at"
)
SELECT
  'bf-' || cf."id",
  sr."vehicle_id",
  sr."client_id",
  COALESCE(cf."repair_completed_at", cf."created_at"),
  ed."mileage",
  CASE
    WHEN LOWER(COALESCE(cf."works_done", '')) LIKE '%масл%' THEN 'Замена масла ДВС'
    ELSE COALESCE(NULLIF(TRIM(cf."works_done"), ''), 'Выполненные работы')
  END,
  CASE
    WHEN LOWER(COALESCE(cf."works_done", '')) LIKE '%масл%' THEN 'oil_change'
    ELSE 'other'
  END,
  cf."works_done",
  cf."work_order_number",
  cf."repair_amount_minor",
  'manager_feedback',
  sr."id",
  cf."id",
  cf."manager_id",
  cf."created_at",
  cf."updated_at"
FROM "consultation_feedback" cf
JOIN "consultation_sessions" cs ON cs."id" = cf."session_id"
JOIN "service_requests" sr ON sr."consultation_session_id" = cs."id"
LEFT JOIN "extracted_diagnostic_data" ed ON ed."session_id" = cs."id"
WHERE sr."vehicle_id" IS NOT NULL
  AND sr."client_id" IS NOT NULL
  AND (
    cf."works_done" IS NOT NULL
    OR cf."repair_completed_at" IS NOT NULL
    OR cf."work_order_number" IS NOT NULL
    OR cf."repair_amount_minor" IS NOT NULL
  );

-- Sync current mileage from latest records
UPDATE "client_vehicles" cv
SET "current_mileage_km" = sub.max_mileage
FROM (
  SELECT "vehicle_id", MAX("mileage_km") AS max_mileage
  FROM "vehicle_service_records"
  WHERE "mileage_km" IS NOT NULL
  GROUP BY "vehicle_id"
) sub
WHERE cv."id" = sub."vehicle_id";
