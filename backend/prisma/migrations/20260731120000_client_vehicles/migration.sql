-- CreateTable
CREATE TABLE "client_vehicles" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "vin" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_vehicles_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "consultation_sessions" ADD COLUMN "vehicle_id" TEXT;

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN "vehicle_id" TEXT;

-- CreateIndex
CREATE INDEX "client_vehicles_client_id_idx" ON "client_vehicles"("client_id");

-- CreateIndex
CREATE INDEX "consultation_sessions_vehicle_id_idx" ON "consultation_sessions"("vehicle_id");

-- CreateIndex
CREATE INDEX "service_requests_vehicle_id_idx" ON "service_requests"("vehicle_id");

-- AddForeignKey
ALTER TABLE "client_vehicles" ADD CONSTRAINT "client_vehicles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_sessions" ADD CONSTRAINT "consultation_sessions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "client_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "client_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
