-- CreateEnum
CREATE TYPE "ConsultationDiagnosisJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "consultation_diagnosis_jobs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "status" "ConsultationDiagnosisJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload_json" JSONB NOT NULL,
    "result_json" JSONB,
    "error_message" TEXT,
    "bull_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_diagnosis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultation_diagnosis_jobs_session_id_key" ON "consultation_diagnosis_jobs"("session_id");

-- CreateIndex
CREATE INDEX "consultation_diagnosis_jobs_status_created_at_idx" ON "consultation_diagnosis_jobs"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "consultation_diagnosis_jobs" ADD CONSTRAINT "consultation_diagnosis_jobs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "consultation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
