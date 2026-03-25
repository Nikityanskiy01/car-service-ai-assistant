-- Drop FK to allow nullable client_id
ALTER TABLE "consultation_sessions" DROP CONSTRAINT "consultation_sessions_client_id_fkey";

-- Guest sessions: optional client, secret token for anonymous access
ALTER TABLE "consultation_sessions" ALTER COLUMN "client_id" DROP NOT NULL;

ALTER TABLE "consultation_sessions" ADD COLUMN "guest_token" TEXT;

CREATE UNIQUE INDEX "consultation_sessions_guest_token_key" ON "consultation_sessions"("guest_token");

ALTER TABLE "consultation_sessions" ADD CONSTRAINT "consultation_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
