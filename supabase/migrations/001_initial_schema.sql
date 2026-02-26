CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  press_is_public BOOLEAN DEFAULT true,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  ai_provider TEXT CHECK (ai_provider IN ('openai', 'anthropic')),
  ai_api_key_encrypted TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.admin_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  published_revision_id UUID,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.admin_article_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.admin_articles(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  rendered_html TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.admin_articles
  ADD CONSTRAINT fk_published_revision
  FOREIGN KEY (published_revision_id)
  REFERENCES public.admin_article_revisions(id);

CREATE TABLE public.admin_article_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL REFERENCES public.admin_article_revisions(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  block_type TEXT NOT NULL,
  plain_text TEXT,
  markdown_text TEXT,
  order_index INTEGER NOT NULL
);

CREATE INDEX idx_blocks_revision ON public.admin_article_blocks(revision_id);

CREATE TABLE public.scraps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_revision_id UUID NOT NULL REFERENCES public.admin_article_revisions(id),
  source_block_id TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  exact_quote TEXT NOT NULL,
  prefix TEXT,
  suffix TEXT,
  user_note TEXT,
  selector JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scraps_user ON public.scraps(user_id);

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_collections_user ON public.collections(user_id);

CREATE TABLE public.collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  scrap_id UUID NOT NULL REFERENCES public.scraps(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.material_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_markdown TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.writing_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id),
  persona TEXT,
  direction JSONB,
  model_provider TEXT NOT NULL CHECK (model_provider IN ('openai', 'anthropic')),
  model_name TEXT NOT NULL,
  status TEXT DEFAULT 'drafting' CHECK (status IN ('drafting', 'done', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.writing_session_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.writing_sessions(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('materials_analysis', 'topic_suggestions', 'outline', 'draft')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.user_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  markdown TEXT NOT NULL,
  rendered_html TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unlisted')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, slug)
);

CREATE TABLE public.post_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.user_posts(id) ON DELETE CASCADE,
  scrap_id UUID NOT NULL REFERENCES public.scraps(id),
  usage TEXT NOT NULL CHECK (usage IN ('inspiration', 'quoted', 'key_point'))
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_admin_articles_updated_at
BEFORE UPDATE ON public.admin_articles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_collections_updated_at
BEFORE UPDATE ON public.collections
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_material_notes_updated_at
BEFORE UPDATE ON public.material_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_writing_sessions_updated_at
BEFORE UPDATE ON public.writing_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_posts_updated_at
BEFORE UPDATE ON public.user_posts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_handle TEXT;
BEGIN
  generated_handle := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'handle', ''),
    NULLIF(NEW.raw_user_meta_data->>'user_name', ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, handle, display_name)
  VALUES (
    NEW.id,
    generated_handle,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''))
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_article_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_article_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writing_session_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "admin_articles_select_published"
ON public.admin_articles
FOR SELECT
USING (status = 'published' OR public.is_admin());

CREATE POLICY "admin_articles_admin_write"
ON public.admin_articles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "admin_article_revisions_select_published"
ON public.admin_article_revisions
FOR SELECT
USING (
  public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.admin_articles a
    WHERE a.published_revision_id = admin_article_revisions.id
      AND a.status = 'published'
  )
);

CREATE POLICY "admin_article_revisions_admin_write"
ON public.admin_article_revisions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "admin_article_blocks_select_published"
ON public.admin_article_blocks
FOR SELECT
USING (
  public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.admin_article_revisions r
    JOIN public.admin_articles a ON a.published_revision_id = r.id
    WHERE r.id = admin_article_blocks.revision_id
      AND a.status = 'published'
  )
);

CREATE POLICY "admin_article_blocks_admin_write"
ON public.admin_article_blocks
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "scraps_select_own"
ON public.scraps
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "scraps_insert_own"
ON public.scraps
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "scraps_update_own"
ON public.scraps
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "scraps_delete_own"
ON public.scraps
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "collections_select_own"
ON public.collections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "collections_insert_own"
ON public.collections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_update_own"
ON public.collections
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_delete_own"
ON public.collections
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "collection_items_select_own"
ON public.collection_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "collection_items_insert_own"
ON public.collection_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "collection_items_update_own"
ON public.collection_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "collection_items_delete_own"
ON public.collection_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.collections c
    WHERE c.id = collection_items.collection_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "material_notes_select_own"
ON public.material_notes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "material_notes_insert_own"
ON public.material_notes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "material_notes_update_own"
ON public.material_notes
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "material_notes_delete_own"
ON public.material_notes
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "writing_sessions_select_own"
ON public.writing_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "writing_sessions_insert_own"
ON public.writing_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "writing_sessions_update_own"
ON public.writing_sessions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "writing_sessions_delete_own"
ON public.writing_sessions
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "writing_session_artifacts_select_own"
ON public.writing_session_artifacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.writing_sessions ws
    WHERE ws.id = writing_session_artifacts.session_id
      AND ws.user_id = auth.uid()
  )
);

CREATE POLICY "writing_session_artifacts_insert_own"
ON public.writing_session_artifacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.writing_sessions ws
    WHERE ws.id = writing_session_artifacts.session_id
      AND ws.user_id = auth.uid()
  )
);

CREATE POLICY "writing_session_artifacts_update_own"
ON public.writing_session_artifacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.writing_sessions ws
    WHERE ws.id = writing_session_artifacts.session_id
      AND ws.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.writing_sessions ws
    WHERE ws.id = writing_session_artifacts.session_id
      AND ws.user_id = auth.uid()
  )
);

CREATE POLICY "writing_session_artifacts_delete_own"
ON public.writing_session_artifacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.writing_sessions ws
    WHERE ws.id = writing_session_artifacts.session_id
      AND ws.user_id = auth.uid()
  )
);

CREATE POLICY "user_posts_select_owner_or_published"
ON public.user_posts
FOR SELECT
USING (auth.uid() = user_id OR status = 'published');

CREATE POLICY "user_posts_insert_own"
ON public.user_posts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_posts_update_own"
ON public.user_posts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_posts_delete_own"
ON public.user_posts
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "post_sources_select_owner_or_published"
ON public.post_sources
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_posts p
    WHERE p.id = post_sources.post_id
      AND (p.user_id = auth.uid() OR p.status = 'published')
  )
);

CREATE POLICY "post_sources_insert_own"
ON public.post_sources
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_posts p
    WHERE p.id = post_sources.post_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "post_sources_update_own"
ON public.post_sources
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_posts p
    WHERE p.id = post_sources.post_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_posts p
    WHERE p.id = post_sources.post_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "post_sources_delete_own"
ON public.post_sources
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_posts p
    WHERE p.id = post_sources.post_id
      AND p.user_id = auth.uid()
  )
);
