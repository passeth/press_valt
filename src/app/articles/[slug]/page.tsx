import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { ArticleContent } from "./ArticleContent";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("admin_articles")
    .select("title, summary")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) return { title: "Not Found" };

  return {
    title: article.title,
    description: article.summary,
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch article
  const { data: article, error: articleError } = await supabase
    .from("admin_articles")
    .select(
      "id, slug, title, summary, category, tags, thumbnail_url, status, published_revision_id, created_at, updated_at"
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (articleError || !article || !article.published_revision_id) {
    notFound();
  }

  // Fetch revision HTML
  const { data: revision } = await supabase
    .from("admin_article_revisions")
    .select("id, rendered_html, created_at")
    .eq("id", article.published_revision_id)
    .maybeSingle();

  if (!revision) {
    notFound();
  }

  // Fetch blocks for scrap references
  const { data: blocks } = await supabase
    .from("admin_article_blocks")
    .select("id, block_id, block_type, plain_text, markdown_text, order_index")
    .eq("revision_id", revision.id)
    .order("order_index", { ascending: true });

  const formattedDate = new Date(article.created_at).toLocaleDateString(
    "ko-KR",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer maxWidth="article" className="pt-16 pb-20">
        {/* Article header */}
        <header className="mb-12">
          {article.category && (
            <span className="inline-block text-[length:var(--text-badge)] font-medium uppercase tracking-[1px] text-text-secondary mb-4">
              {article.category}
            </span>
          )}
          <h1 className="text-[length:var(--text-display)] font-serif font-bold italic tracking-[-2px] leading-[1.05] mb-6">
            {article.title}
          </h1>
          {article.summary && (
            <p className="text-[length:var(--text-body)] text-text-secondary leading-relaxed max-w-2xl mb-6">
              {article.summary}
            </p>
          )}
          <div className="flex items-center gap-3 text-[length:var(--text-caption)] text-text-tertiary">
            <time dateTime={article.created_at}>{formattedDate}</time>
            {article.tags && article.tags.length > 0 && (
              <>
                <span>·</span>
                <span>{article.tags.join(", ")}</span>
              </>
            )}
          </div>
        </header>

        {/* Divider */}
        <div className="border-t border-border mb-10" />

        {/* Article body with text selection handler */}
        <ArticleContent
          renderedHtml={revision.rendered_html || ""}
          revisionId={revision.id}
          blocks={blocks ?? []}
        />
      </PageContainer>

      <Footer />
    </div>
  );
}
