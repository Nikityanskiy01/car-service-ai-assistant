-- pgvector for case-memory ANN. HNSW requires a fixed dimension (nomic-embed-text = 768).
-- Skip cleanly if the extension .so is missing (host Postgres without pgvector).

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension unavailable: %', SQLERRM;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'skipping embedding_vec: vector extension missing';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultation_case_embeddings'
      AND column_name = 'embedding_vec'
  ) THEN
    ALTER TABLE consultation_case_embeddings ADD COLUMN embedding_vec vector(768);
  END IF;

  UPDATE consultation_case_embeddings AS t
  SET embedding_vec = (
    SELECT ('[' || string_agg(trim(both '"' from elem::text), ',' ORDER BY ord) || ']')::vector(768)
    FROM jsonb_array_elements(t.embedding) WITH ORDINALITY AS e(elem, ord)
  )
  WHERE t.embedding_vec IS NULL
    AND jsonb_typeof(t.embedding) = 'array'
    AND jsonb_array_length(t.embedding) = 768;
END
$$;
