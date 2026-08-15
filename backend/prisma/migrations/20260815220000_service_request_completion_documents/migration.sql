CREATE TABLE "service_request_completion_documents" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_completion_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_request_completion_documents_request_id_created_at_idx" ON "service_request_completion_documents"("request_id", "created_at" DESC);

ALTER TABLE "service_request_completion_documents" ADD CONSTRAINT "service_request_completion_documents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_request_completion_documents" ADD CONSTRAINT "service_request_completion_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
