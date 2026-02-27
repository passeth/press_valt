import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types";
import { NextResponse } from "next/server";

type Scrap = Database["public"]["Tables"]["scraps"]["Row"];
type ArticleMetadata = {
  id: string;
  slug: string;
  title: string;
  thumbnail_url: string | null;
  category: string | null;
};

type EnrichedScrap = Scrap & {
  article_title: string | null;
  article_slug: string | null;
  article_thumbnail_url: string | null;
  article_category: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 1: Get all scraps for the user
    const { data: scraps, error: scrapsError } = await supabase
      .from("scraps")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (scrapsError) {
      return NextResponse.json({ error: scrapsError.message }, { status: 500 });
    }

    // Handle empty results
    if (!scraps || scraps.length === 0) {
      return NextResponse.json({ scraps: [] });
    }

    // Step 2: Get unique source_revision_id values
    const revisionIds = Array.from(new Set(scraps.map((s) => s.source_revision_id)));

    // Step 3: Get revision -> article mapping
    const { data: revisions, error: revisionsError } = await supabase
      .from("admin_article_revisions")
      .select("id, article_id")
      .in("id", revisionIds);

    if (revisionsError) {
      return NextResponse.json({ error: revisionsError.message }, { status: 500 });
    }

    // Step 4: Get unique article_id values
    const articleIds = Array.from(new Set((revisions ?? []).map((r) => r.article_id)));

    // Step 5: Get article metadata
    const { data: articles, error: articlesError } = await supabase
      .from("admin_articles")
      .select("id, slug, title, thumbnail_url, category")
      .in("id", articleIds);

    if (articlesError) {
      return NextResponse.json({ error: articlesError.message }, { status: 500 });
    }

    // Step 6: Build lookup maps
    const revisionMap = new Map<string, string>();
    (revisions ?? []).forEach((r) => {
      revisionMap.set(r.id, r.article_id);
    });

    const articleMap = new Map<string, ArticleMetadata>();
    (articles ?? []).forEach((a) => {
      articleMap.set(a.id, a as ArticleMetadata);
    });

    // Enrich scraps with article metadata
    const enrichedScraps: EnrichedScrap[] = scraps.map((scrap) => {
      const articleId = revisionMap.get(scrap.source_revision_id);
      const article = articleId ? articleMap.get(articleId) : null;

      return {
        ...scrap,
        article_title: article?.title ?? null,
        article_slug: article?.slug ?? null,
        article_thumbnail_url: article?.thumbnail_url ?? null,
        article_category: article?.category ?? null,
      };
    });

    return NextResponse.json({ scraps: enrichedScraps });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
