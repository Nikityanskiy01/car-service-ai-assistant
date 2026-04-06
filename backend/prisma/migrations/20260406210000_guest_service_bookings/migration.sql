-- AlterTable
ALTER TABLE "service_bookings" ALTER COLUMN "client_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "service_bookings" ADD COLUMN "guest_name" TEXT,
ADD COLUMN "guest_phone" TEXT,
ADD COLUMN "guest_email" TEXT;
