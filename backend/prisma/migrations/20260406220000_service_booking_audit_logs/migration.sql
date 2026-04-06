-- CreateTable
CREATE TABLE "service_booking_audit_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_booking_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_booking_audit_logs_booking_id_created_at_idx" ON "service_booking_audit_logs"("booking_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "service_booking_audit_logs" ADD CONSTRAINT "service_booking_audit_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "service_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_booking_audit_logs" ADD CONSTRAINT "service_booking_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
