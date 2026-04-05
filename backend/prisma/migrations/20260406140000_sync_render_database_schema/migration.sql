-- sync_render_database_schema
-- Идемпотентно выравнивает продовую БД с schema.prisma (без DROP, без потери данных).
-- consultation_sessions: гостевые поля (на случай если миграция 20260405120000 не применялась или hotfix вручную)
ALTER TABLE "consultation_sessions" ADD COLUMN IF NOT EXISTS "guest_name" TEXT;
ALTER TABLE "consultation_sessions" ADD COLUMN IF NOT EXISTS "guest_phone" TEXT;

-- service_requests: поля для гостевых заявок (в init их не было)
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "guest_name" TEXT;
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "guest_phone" TEXT;
ALTER TABLE "service_requests" ADD COLUMN IF NOT EXISTS "guest_email" TEXT;

-- schema.prisma: clientId String? — заявка может быть без пользователя (гость)
ALTER TABLE "service_requests" ALTER COLUMN "client_id" DROP NOT NULL;
