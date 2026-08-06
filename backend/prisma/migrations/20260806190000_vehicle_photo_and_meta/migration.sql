-- AlterTable
ALTER TABLE "client_vehicles" ADD COLUMN IF NOT EXISTS "photo_url" TEXT;
ALTER TABLE "client_vehicles" ADD COLUMN IF NOT EXISTS "license_plate" TEXT;
ALTER TABLE "client_vehicles" ADD COLUMN IF NOT EXISTS "color" TEXT;
