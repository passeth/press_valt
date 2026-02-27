import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: collections } = await supabase.from("collections").select("id").eq("user_id", user.id);

    if (!collections || collections.length === 0) {
      return NextResponse.json({ articles: [] });
    }

    const collectionIds = collections.map((collection) => collection.id);

    const { data: items } = await supabase
      .from("collection_items")
      .select("article_id, created_at")
      .in("collection_id", collectionIds)
      .not("article_id", "is", null);

    if (!items || items.length === 0) {
      return NextResponse.json({ articles: [] });
    }

    const articleIds = [...new Set(items.map((item) => item.article_id).filter((id): id is string => id !== null))];

    if (articleIds.length === 0) {
      return NextResponse.json({ articles: [] });
    }

    const { data: articles, error: articlesError } = await supabase
      .from("admin_articles")
      .select("id, slug, title, summary, thumbnail_url, category, status")
      .in("id", articleIds)
      .eq("status", "published");

    if (articlesError) {
      return NextResponse.json({ error: articlesError.message }, { status: 500 });
    }

    const bookmarkDates = new Map<string, string>();
    for (const item of items) {
      if (item.article_id) {
        const existing = bookmarkDates.get(item.article_id);
        if (!existing || item.created_at < existing) {
          bookmarkDates.set(item.article_id, item.created_at);
        }
      }
    }

    const result = (articles ?? [])
      .map((article) => ({
        ...article,
        bookmarked_at: bookmarkDates.get(article.id) ?? new Date(0).toISOString(),
      }))
      .sort((a, b) => new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime());

    return NextResponse.json({ articles: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
