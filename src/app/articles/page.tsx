import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { ArticleCard } from "@/components/article/ArticleCard";
import { ArticleGrid } from "@/components/article/ArticleGrid";

export const metadata = {
  title: "아티클",
  description: "Press Vault에서 발행된 아티클 모아보기",
};

interface ArticlesPageProps {
  searchParams: Promise<{ page?: string; category?: string }>;
}

export default async function ArticlesPage({ searchParams }: ArticlesPageProps) {
  const { page: pageParam, category } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const limit = 12;

  const supabase = await createClient();

  let query = supabase
    .from("admin_articles")
    .select("slug, title, summary, category, tags, thumbnail_url, created_at", {
      count: "exact",
    })
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (category) {
    query = query.eq("category", category);
  }

  const { data: articles, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit);

  // Get unique categories for filter
  const { data: allArticles } = await supabase
    .from("admin_articles")
    .select("category")
    .eq("status", "published")
    .not("category", "is", null);

  const categories = [
    ...new Set((allArticles ?? []).map((a) => a.category).filter(Boolean)),
  ] as string[];

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer>
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-[length:var(--text-display)] font-serif font-bold italic tracking-[-2px] mb-4">
            아티클
          </h1>
          <p className="text-[length:var(--text-small)] text-text-secondary max-w-lg">
            Press Vault에서 발행된 아티클을 둘러보세요.
          </p>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-4 mb-8 border-b border-border pb-4">
            <a
              href="/articles"
              className={`text-[length:var(--text-button)] font-medium uppercase tracking-[1px] transition-colors ${
                !category
                  ? "text-text-primary"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              전체
            </a>
            {categories.map((cat) => (
              <a
                key={cat}
                href={`/articles?category=${encodeURIComponent(cat)}`}
                className={`text-[length:var(--text-button)] font-medium uppercase tracking-[1px] transition-colors ${
                  category === cat
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                {cat}
              </a>
            ))}
          </div>
        )}

        {/* Article grid */}
        {articles && articles.length > 0 ? (
          <ArticleGrid>
            {articles.map((article) => (
              <ArticleCard
                key={article.slug}
                slug={article.slug}
                title={article.title}
                category={article.category}
                summary={article.summary}
                thumbnail_url={article.thumbnail_url}
                created_at={article.created_at}
                tags={article.tags}
              />
            ))}
          </ArticleGrid>
        ) : (
          <div className="py-20 text-center">
            <p className="text-text-secondary text-[length:var(--text-body)]">
              아직 발행된 아티클이 없습니다.
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-12 pt-8 border-t border-border">
            {page > 1 && (
              <a
                href={`/articles?page=${page - 1}${category ? `&category=${encodeURIComponent(category)}` : ""}`}
                className="px-3 py-1.5 text-[length:var(--text-button)] text-text-secondary hover:text-text-primary transition-colors"
              >
                ← 이전
              </a>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`/articles?page=${p}${category ? `&category=${encodeURIComponent(category)}` : ""}`}
                className={`px-3 py-1.5 text-[length:var(--text-button)] transition-colors ${
                  p === page
                    ? "bg-accent text-text-inverted font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {p}
              </a>
            ))}
            {page < totalPages && (
              <a
                href={`/articles?page=${page + 1}${category ? `&category=${encodeURIComponent(category)}` : ""}`}
                className="px-3 py-1.5 text-[length:var(--text-button)] text-text-secondary hover:text-text-primary transition-colors"
              >
                다음 →
              </a>
            )}
          </nav>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
