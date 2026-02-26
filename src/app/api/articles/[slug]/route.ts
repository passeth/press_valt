import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const supabase = await createClient();

    const { data: article, error: articleError } = await supabase
      .from("admin_articles")
      .select(
        "id, slug, title, summary, category, tags, thumbnail_url, status, published_revision_id, created_at, updated_at"
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (articleError) {
      return NextResponse.json({ error: articleError.message }, { status: 500 });
    }

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    if (!article.published_revision_id) {
      return NextResponse.json({ error: "Published revision not found" }, { status: 404 });
    }

    const { data: revision, error: revisionError } = await supabase
      .from("admin_article_revisions")
      .select("id, rendered_html, created_at")
      .eq("id", article.published_revision_id)
      .maybeSingle();

    if (revisionError) {
      return NextResponse.json({ error: revisionError.message }, { status: 500 });
    }

    if (!revision) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }

    const { data: blocks, error: blocksError } = await supabase
      .from("admin_article_blocks")
      .select("id, block_id, block_type, plain_text, markdown_text, order_index")
      .eq("revision_id", revision.id)
      .order("order_index", { ascending: true });

    if (blocksError) {
      return NextResponse.json({ error: blocksError.message }, { status: 500 });
    }

    return NextResponse.json({
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        category: article.category,
        tags: article.tags,
        thumbnail_url: article.thumbnail_url,
        created_at: article.created_at,
        updated_at: article.updated_at,
        rendered_html: revision.rendered_html,
      },
      blocks: blocks ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
