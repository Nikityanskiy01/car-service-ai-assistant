-- CreateEnum
CREATE TYPE "ContactSubmissionStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CONVERTED', 'CLOSED');

-- AlterTable contact_submissions
ALTER TABLE "contact_submissions" ADD COLUMN "status" "ContactSubmissionStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "contact_submissions" ADD COLUMN "processed_at" TIMESTAMP(3);
ALTER TABLE "contact_submissions" ADD COLUMN "converted_request_id" TEXT;
ALTER TABLE "contact_submissions" ADD COLUMN "closed_reason" TEXT;

CREATE INDEX "contact_submissions_status_idx" ON "contact_submissions"("status");

-- AlterTable service_requests
ALTER TABLE "service_requests" ADD COLUMN "assigned_manager_id" TEXT;
ALTER TABLE "service_requests" ADD COLUMN "first_response_at" TIMESTAMP(3);

CREATE INDEX "service_requests_assigned_manager_id_idx" ON "service_requests"("assigned_manager_id");

ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_manager_id_fkey" FOREIGN KEY ("assigned_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
