-- Migration 005: Add thumbnail_url to user_posts + post-images storage bucket

-- Add thumbnail_url column to user_posts
ALTER TABLE public.user_posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Create post-images storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload
CREATE POLICY "Authenticated users can upload post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-images');

-- Anyone can read (public bucket)
CREATE POLICY "Public read access for post images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- Users can delete their own images
CREATE POLICY "Users can delete own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
