-- Allow article-only collection items while preserving source integrity.

ALTER TABLE IF EXISTS public.collection_items
  ALTER COLUMN scrap_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'chk_item_has_source'
      AND n.nspname = 'public'
      AND t.relname = 'collection_items'
  ) THEN
    ALTER TABLE public.collection_items
      ADD CONSTRAINT chk_item_has_source
      CHECK (scrap_id IS NOT NULL OR article_id IS NOT NULL);
  END IF;
END $$;
