-- CreateTable
CREATE TABLE "client_vehicle_exclusions" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_vehicle_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_vehicle_exclusions_client_id_idx" ON "client_vehicle_exclusions"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_vehicle_exclusions_client_id_fingerprint_key" ON "client_vehicle_exclusions"("client_id", "fingerprint");

-- AddForeignKey
ALTER TABLE "client_vehicle_exclusions" ADD CONSTRAINT "client_vehicle_exclusions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
