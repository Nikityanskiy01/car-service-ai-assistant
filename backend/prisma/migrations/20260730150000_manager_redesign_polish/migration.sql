-- Booking extended statuses
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'ARRIVED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

-- Service request status audit log
CREATE TABLE "service_request_status_logs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_status_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_request_status_logs_request_id_created_at_idx" ON "service_request_status_logs"("request_id", "created_at" DESC);

ALTER TABLE "service_request_status_logs" ADD CONSTRAINT "service_request_status_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_request_status_logs" ADD CONSTRAINT "service_request_status_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
