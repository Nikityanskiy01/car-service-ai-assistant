-- Consultation case embeddings for semantic memory (Phase 1)

CREATE TABLE "consultation_case_embeddings" (
    "session_id" TEXT NOT NULL,
    "symptom_category" TEXT,
    "make" TEXT,
    "model" TEXT,
    "top_recommendations" JSONB NOT NULL DEFAULT '[]',
    "cost_from_minor" INTEGER,
    "embedding" JSONB NOT NULL,
    "dimensions" INTEGER NOT NULL DEFAULT 768,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_case_embeddings_pkey" PRIMARY KEY ("session_id")
);

CREATE INDEX "consultation_case_embeddings_symptom_category_idx" ON "consultation_case_embeddings"("symptom_category");
CREATE INDEX "consultation_case_embeddings_updated_at_idx" ON "consultation_case_embeddings"("updated_at" DESC);

ALTER TABLE "consultation_case_embeddings" ADD CONSTRAINT "consultation_case_embeddings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "consultation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
