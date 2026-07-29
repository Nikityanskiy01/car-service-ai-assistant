-- CreateEnum
CREATE TYPE "ConsultationFeedbackVerdict" AS ENUM ('CORRECT', 'PARTIAL', 'INCORRECT');

-- CreateTable
CREATE TABLE "consultation_feedback" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "verdict" "ConsultationFeedbackVerdict" NOT NULL,
    "actual_cause" TEXT,
    "works_done" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consultation_feedback_session_id_key" ON "consultation_feedback"("session_id");

-- CreateIndex
CREATE INDEX "consultation_feedback_manager_id_idx" ON "consultation_feedback"("manager_id");

-- CreateIndex
CREATE INDEX "consultation_feedback_verdict_idx" ON "consultation_feedback"("verdict");

-- CreateIndex
CREATE INDEX "consultation_feedback_created_at_idx" ON "consultation_feedback"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "consultation_feedback" ADD CONSTRAINT "consultation_feedback_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "consultation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_feedback" ADD CONSTRAINT "consultation_feedback_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
