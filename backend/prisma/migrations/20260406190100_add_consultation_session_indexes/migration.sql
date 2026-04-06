-- CreateIndex
CREATE INDEX "consultation_sessions_client_id_idx" ON "consultation_sessions"("client_id");

-- CreateIndex
CREATE INDEX "consultation_sessions_created_at_idx" ON "consultation_sessions"("created_at");
