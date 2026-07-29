-- Phase C: repair outcome on feedback, SLA escalation timestamp
ALTER TABLE "consultation_feedback" ADD COLUMN "repair_amount_minor" INTEGER;
ALTER TABLE "consultation_feedback" ADD COLUMN "work_order_number" TEXT;
ALTER TABLE "consultation_feedback" ADD COLUMN "repair_completed_at" TIMESTAMP(3);

ALTER TABLE "service_requests" ADD COLUMN "sla_notified_at" TIMESTAMP(3);
