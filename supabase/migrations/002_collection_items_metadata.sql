-- Migration: Extend collection_items with per-item metadata
-- Adds note, highlight_color, and updated_at fields for richer collection curation
-- Also adds article_id column to align schema with application types

-- Add article_id (nullable FK to admin_articles) if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'collection_items'
      AND column_name = 'article_id'
  ) THEN
    ALTER TABLE public.collection_items
      ADD COLUMN article_id UUID REFERENCES public.admin_articles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Per-item note: user annotation about why this item matters in this collection
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Per-item highlight color for visual categorization within a collection
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS highlight_color TEXT CHECK (
    highlight_color IS NULL OR highlight_color IN (
      'yellow', 'green', 'blue', 'pink', 'purple'
    )
  );

-- Track when item metadata was last edited
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger to auto-update updated_at on row changes
CREATE TRIGGER trg_collection_items_updated_at
BEFORE UPDATE ON public.collection_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
