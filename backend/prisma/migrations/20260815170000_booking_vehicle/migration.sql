-- AlterTable
ALTER TABLE "service_bookings" ADD COLUMN "vehicle_id" TEXT;

-- CreateIndex
CREATE INDEX "service_bookings_vehicle_id_idx" ON "service_bookings"("vehicle_id");

-- AddForeignKey
ALTER TABLE "service_bookings" ADD CONSTRAINT "service_bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "client_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
