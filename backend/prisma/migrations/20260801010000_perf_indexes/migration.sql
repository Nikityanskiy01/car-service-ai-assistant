-- Hot-path indexes for list/order/filter queries
CREATE INDEX IF NOT EXISTS "consultation_sessions_updated_at_idx" ON "consultation_sessions" ("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "consultation_sessions_client_id_created_at_idx" ON "consultation_sessions" ("client_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "messages_session_id_created_at_idx" ON "messages" ("session_id", "created_at");

CREATE INDEX IF NOT EXISTS "service_requests_created_at_idx" ON "service_requests" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "service_requests_status_created_at_idx" ON "service_requests" ("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "service_requests_client_id_created_at_idx" ON "service_requests" ("client_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "request_follow_up_messages_request_id_created_at_idx" ON "request_follow_up_messages" ("request_id", "created_at");

CREATE INDEX IF NOT EXISTS "service_bookings_preferred_at_idx" ON "service_bookings" ("preferred_at");
CREATE INDEX IF NOT EXISTS "service_bookings_client_id_preferred_at_idx" ON "service_bookings" ("client_id", "preferred_at");

CREATE INDEX IF NOT EXISTS "consultation_feedback_verdict_updated_at_idx" ON "consultation_feedback" ("verdict", "updated_at" DESC);
