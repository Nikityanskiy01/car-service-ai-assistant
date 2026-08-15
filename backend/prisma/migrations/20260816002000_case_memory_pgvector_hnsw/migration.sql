-- HNSW must run in a later transaction than ADD COLUMN vector(768).
-- Same-transaction index builds fail with: column does not have dimensions.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'skipping hnsw index: vector extension missing';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultation_case_embeddings'
      AND column_name = 'embedding_vec'
  ) THEN
    RAISE NOTICE 'skipping hnsw index: embedding_vec missing';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'consultation_case_embeddings_embedding_vec_hnsw'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX consultation_case_embeddings_embedding_vec_hnsw
      ON consultation_case_embeddings
      USING hnsw (embedding_vec vector_cosine_ops);
  END IF;
END
$$;
