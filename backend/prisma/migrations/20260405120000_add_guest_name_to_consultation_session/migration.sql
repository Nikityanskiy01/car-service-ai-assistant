-- AlterTable: поля из schema.prisma (ConsultationSession) отсутствовали в БД после ранних миграций
ALTER TABLE "consultation_sessions" ADD COLUMN "guest_name" TEXT;
ALTER TABLE "consultation_sessions" ADD COLUMN "guest_phone" TEXT;
